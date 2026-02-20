#!/bin/bash
# ============================================================
# Vault Initialization Script for pace42
# Run this after a cold start or when Vault data is reset
# ============================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VAULT_DIR="$PROJECT_ROOT/vault"
ENV_FILE="$PROJECT_ROOT/config/.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 HashiCorp Vault Initialization for pace42"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required${NC}"
    exit 1
fi

if [ ! -f "$VAULT_DIR/vault" ]; then
    echo -e "${RED}❌ Vault binary not found at $VAULT_DIR/vault${NC}"
    echo "Please ensure Vault is installed"
    exit 1
fi

export VAULT_ADDR='http://127.0.0.1:8200'

# ============================================
# 1. Start Vault Server
# ============================================
echo -e "${BLUE}1. Starting Vault server...${NC}"

if pgrep -f "vault server" > /dev/null; then
    echo -e "${GREEN}   ✓ Vault server already running${NC}"
else
    cd "$VAULT_DIR"
    nohup ./vault server -config=vault-config.hcl > vault.log 2>&1 &
    sleep 3
    
    if ! pgrep -f "vault server" > /dev/null; then
        echo -e "${RED}   ❌ Failed to start Vault server${NC}"
        exit 1
    fi
    echo -e "${GREEN}   ✓ Vault server started${NC}"
fi

# ============================================
# 2. Check if Vault is already initialized
# ============================================
cd "$VAULT_DIR"
INIT_STATUS=$(./vault status -format=json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('initialized') else 'false')" || echo "false")

if [ "$INIT_STATUS" = "true" ]; then
    echo -e "${YELLOW}   ⚠ Vault is already initialized${NC}"
    
    # Check if we have the init file
    if [ -f "vault-init.json" ] && [ -s "vault-init.json" ]; then
        echo -e "${GREEN}   ✓ Found vault-init.json${NC}"
    else
        echo -e "${RED}   ❌ Vault initialized but vault-init.json is missing!${NC}"
        echo "      You may need to reset Vault data: rm -rf vault/data vault/vault-init.json"
        exit 1
    fi
else
    # ============================================
    # 3. Initialize Vault
    # ============================================
    echo -e "${BLUE}2. Initializing Vault...${NC}"
    ./vault operator init -key-shares=1 -key-threshold=1 -format=json > vault-init.json
    echo -e "${GREEN}   ✓ Vault initialized${NC}"
fi

# ============================================
# 4. Extract credentials
# ============================================
echo -e "${BLUE}3. Extracting credentials...${NC}"
UNSEAL_KEY=$(cat vault-init.json | python3 -c "import json,sys; print(json.load(sys.stdin)['unseal_keys_b64'][0])")
ROOT_TOKEN=$(cat vault-init.json | python3 -c "import json,sys; print(json.load(sys.stdin)['root_token'])")
export VAULT_TOKEN="$ROOT_TOKEN"

# ============================================
# 5. Unseal Vault
# ============================================
echo -e "${BLUE}4. Unsealing Vault...${NC}"
./vault operator unseal "$UNSEAL_KEY" > /dev/null 2>&1
echo -e "${GREEN}   ✓ Vault unsealed${NC}"

# ============================================
# 6. Configure Secrets Engines
# ============================================
echo -e "${BLUE}5. Configuring secrets engines...${NC}"

# Enable KV v2
./vault secrets enable -path=pace42 -version=2 kv 2>/dev/null || echo "   KV engine already enabled"

# Enable Transit
./vault secrets enable transit 2>/dev/null || echo "   Transit engine already enabled"

echo -e "${GREEN}   ✓ Secrets engines configured${NC}"

# ============================================
# 7. Create Encryption Keys
# ============================================
echo -e "${BLUE}6. Creating encryption keys...${NC}"
./vault write -f transit/keys/pace42-jwt-signing 2>/dev/null || echo "   JWT signing key exists"
./vault write -f transit/keys/pace42-data-encryption 2>/dev/null || echo "   Data encryption key exists"
echo -e "${GREEN}   ✓ Encryption keys created${NC}"

# ============================================
# 8. Store JWT Configuration
# ============================================
echo -e "${BLUE}7. Storing JWT configuration...${NC}"
JWT_SECRET=$(openssl rand -base64 64)
REFRESH_SECRET=$(openssl rand -base64 64)
./vault kv put pace42/jwt-config \
    secret="$JWT_SECRET" \
    refresh_secret="$REFRESH_SECRET" \
    issuer="pace42-running-coach" \
    audience="pace42-users" > /dev/null
echo -e "${GREEN}   ✓ JWT configuration stored${NC}"

# ============================================
# 9. Store OpenAI API Key
# ============================================
echo -e "${BLUE}8. Storing OpenAI API key...${NC}"

# Read OpenAI key from config/.env
if [ -f "$ENV_FILE" ]; then
    OPENAI_KEY=$(grep "^OPENAI_API_KEY=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' || echo "")
    if [ -n "$OPENAI_KEY" ] && [ "$OPENAI_KEY" != "sk-your-openai-key-here" ]; then
        ./vault kv put pace42/api-keys openai_key="$OPENAI_KEY" > /dev/null
        echo -e "${GREEN}   ✓ OpenAI API key stored from config/.env${NC}"
    else
        echo -e "${YELLOW}   ⚠ No OpenAI API key found in config/.env${NC}"
        echo "      Set OPENAI_API_KEY in config/.env and run this script again"
        # Store placeholder
        ./vault kv put pace42/api-keys openai_key="placeholder" > /dev/null
    fi
else
    echo -e "${YELLOW}   ⚠ config/.env not found${NC}"
    ./vault kv put pace42/api-keys openai_key="placeholder" > /dev/null
fi

# ============================================
# 10. Create Policy and AppRole
# ============================================
echo -e "${BLUE}9. Creating policy and AppRole...${NC}"

# Create policy
cat > "$VAULT_DIR/pace42-policy.hcl" << 'EOF'
path "pace42/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "transit/encrypt/pace42-*" {
  capabilities = ["update"]
}
path "transit/decrypt/pace42-*" {
  capabilities = ["update"]
}
path "transit/sign/pace42-*" {
  capabilities = ["update"]
}
path "transit/verify/pace42-*" {
  capabilities = ["update"]
}
EOF
./vault policy write pace42-backend "$VAULT_DIR/pace42-policy.hcl" > /dev/null

# Enable AppRole
./vault auth enable approle 2>/dev/null || echo "   AppRole already enabled"

# Create AppRole
./vault write auth/approle/role/pace42-backend \
    token_policies="pace42-backend" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=24h \
    secret_id_num_uses=0 > /dev/null

# Get credentials
ROLE_ID=$(./vault read -field=role_id auth/approle/role/pace42-backend/role-id)
SECRET_ID=$(./vault write -f -field=secret_id auth/approle/role/pace42-backend/secret-id)

echo -e "${GREEN}   ✓ Policy and AppRole created${NC}"

# ============================================
# 11. Update config/.env
# ============================================
echo -e "${BLUE}10. Updating config/.env...${NC}"

if [ -f "$ENV_FILE" ]; then
    # Remove old Vault entries
    grep -v "^VAULT_" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || cp "$ENV_FILE" "$ENV_FILE.tmp"
    
    # Add new Vault config
    cat >> "$ENV_FILE.tmp" << EOF

# HashiCorp Vault Configuration (auto-generated by init-vault.sh)
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID
VAULT_TOKEN=$ROOT_TOKEN
EOF
    mv "$ENV_FILE.tmp" "$ENV_FILE"
    echo -e "${GREEN}   ✓ config/.env updated${NC}"
else
    echo -e "${YELLOW}   ⚠ config/.env not found, creating...${NC}"
    cat > "$ENV_FILE" << EOF
# pace42 Configuration

# OpenAI
OPENAI_API_KEY=placeholder

# Session
SESSION_SECRET=development-secret

# LLM Provider
LLM_PROVIDER=openai

# HashiCorp Vault Configuration (auto-generated by init-vault.sh)
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID
VAULT_TOKEN=$ROOT_TOKEN
EOF
fi

# ============================================
# Summary
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Vault initialization complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Vault Status:"
echo "   Initialized: true"
echo "   Sealed:      false"
echo "   Address:     http://127.0.0.1:8200"
echo ""
echo "🔑 Credentials stored in: vault/vault-init.json"
echo "   Root Token: ${ROOT_TOKEN:0:20}..."
echo ""
echo "🔐 Vault config added to: config/.env"
echo "   Role ID: ${ROLE_ID:0:20}..."
echo ""
echo "📦 Secrets stored:"
echo "   - pace42/api-keys (OpenAI API key)"
echo "   - pace42/jwt-config (JWT signing secrets)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "   1. If OpenAI key was not set, update config/.env and re-run this script"
echo "   2. Start the app: ./scripts/start.sh"
echo ""
