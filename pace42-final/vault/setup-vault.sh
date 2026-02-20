#!/bin/bash
# HashiCorp Vault Setup Script for pace42
# This script initializes and configures Vault for local development

set -e

VAULT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_BIN="$VAULT_DIR/vault"
VAULT_DATA="$VAULT_DIR/data"
ENV_FILE="/Users/anupk/devops/sandbox/Kimi_Agent_pac42/pace42-final/config/.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 HashiCorp Vault Setup for pace42"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if vault binary exists
if [ ! -f "$VAULT_BIN" ]; then
    echo "❌ Vault binary not found at $VAULT_BIN"
    echo "Please run: cd $VAULT_DIR && unzip vault.zip"
    exit 1
fi

# Create data directory
mkdir -p "$VAULT_DATA"

# Export Vault address
export VAULT_ADDR='http://127.0.0.1:8200'

# Check if Vault is already running
if pgrep -f "vault server" > /dev/null; then
    echo "✅ Vault is already running"
else
    echo "🚀 Starting Vault server..."
    nohup "$VAULT_BIN" server -config="$VAULT_DIR/vault-config.hcl" > "$VAULT_DIR/vault.log" 2>&1 &
    sleep 3
    
    if ! pgrep -f "vault server" > /dev/null; then
        echo "❌ Failed to start Vault server"
        exit 1
    fi
    echo "✅ Vault server started"
fi

# Check if Vault is initialized
INIT_STATUS=$($VAULT_BIN status -format=json 2>/dev/null | grep -o '"initialized":[a-z]*' | cut -d':' -f2 || echo "false")

if [ "$INIT_STATUS" = "true" ]; then
    echo "✅ Vault is already initialized"
    
    # Check if we have the unseal key
    if [ -f "$VAULT_DIR/vault-init.json" ]; then
        echo "🔓 Unsealing Vault..."
        UNSEAL_KEY=$(cat "$VAULT_DIR/vault-init.json" | grep -o '"unseal_keys_b64":\["[^"]*"\]' | cut -d'"' -f4)
        $VAULT_BIN operator unseal "$UNSEAL_KEY" > /dev/null 2>&1 || true
    fi
else
    echo "🆕 Initializing Vault..."
    $VAULT_BIN operator init -key-shares=1 -key-threshold=1 -format=json > "$VAULT_DIR/vault-init.json"
    
    UNSEAL_KEY=$(cat "$VAULT_DIR/vault-init.json" | grep -o '"unseal_keys_b64":\["[^"]*"\]' | cut -d'"' -f4)
    ROOT_TOKEN=$(cat "$VAULT_DIR/vault-init.json" | grep -o '"root_token":"[^"]*"' | cut -d'"' -f4)
    
    echo "🔓 Unsealing Vault..."
    $VAULT_BIN operator unseal "$UNSEAL_KEY"
    
    export VAULT_TOKEN="$ROOT_TOKEN"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔑 VAULT CREDENTIALS (SAVE THESE SECURELY!)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Root Token: $ROOT_TOKEN"
    echo "Unseal Key: $UNSEAL_KEY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Configure Vault for pace42
    echo "⚙️  Configuring Vault secrets engines..."
    
    # Enable KV v2 secrets engine for pace42
    $VAULT_BIN secrets enable -path=pace42 -version=2 kv 2>/dev/null || echo "KV engine already enabled"
    
    # Enable transit engine for encryption
    $VAULT_BIN secrets enable transit 2>/dev/null || echo "Transit engine already enabled"
    
    # Create encryption key for JWT signing
    $VAULT_BIN write -f transit/keys/pace42-jwt-signing 2>/dev/null || echo "JWT signing key already exists"
    
    # Create encryption key for sensitive data
    $VAULT_BIN write -f transit/keys/pace42-data-encryption 2>/dev/null || echo "Data encryption key already exists"
    
    # Store JWT configuration
    $VAULT_BIN kv put pace42/jwt-config \
        secret="$(openssl rand -base64 64)" \
        refresh_secret="$(openssl rand -base64 64)" \
        issuer="pace42-running-coach" \
        audience="pace42-users"
    
    # Store API keys placeholder (to be filled by user)
    $VAULT_BIN kv put pace42/api-keys \
        openai_key="placeholder" \
        garmin_client_id="placeholder" \
        garmin_client_secret="placeholder"
    
    # Create policy for pace42 backend
    cat > "$VAULT_DIR/pace42-policy.hcl" << 'EOF'
# Pace42 Backend Policy
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
    
    $VAULT_BIN policy write pace42-backend "$VAULT_DIR/pace42-policy.hcl"
    
    # Create AppRole for backend authentication
    $VAULT_BIN auth enable approle 2>/dev/null || echo "AppRole already enabled"
    
    $VAULT_BIN write auth/approle/role/pace42-backend \
        token_policies="pace42-backend" \
        token_ttl=1h \
        token_max_ttl=4h \
        secret_id_ttl=24h \
        secret_id_num_uses=0
    
    # Get AppRole credentials
    ROLE_ID=$($VAULT_BIN read -field=role_id auth/approle/role/pace42-backend/role-id)
    SECRET_ID=$($VAULT_BIN write -f -field=secret_id auth/approle/role/pace42-backend/secret-id)
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔐 APPROLE CREDENTIALS FOR BACKEND"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Role ID:    $ROLE_ID"
    echo "Secret ID:  $SECRET_ID"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Update .env file
    if [ -f "$ENV_FILE" ]; then
        # Remove old Vault entries
        grep -v "^VAULT_" "$ENV_FILE" > "$ENV_FILE.tmp" || true
        mv "$ENV_FILE.tmp" "$ENV_FILE"
    fi
    
    cat >> "$ENV_FILE" << EOF

# HashiCorp Vault Configuration
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID
VAULT_TOKEN=$ROOT_TOKEN
EOF
    
    echo "✅ Vault configuration added to $ENV_FILE"
fi

# Unseal if needed
SEAL_STATUS=$($VAULT_BIN status -format=json 2>/dev/null | grep -o '"sealed":[a-z]*' | cut -d':' -f2 || echo "true")
if [ "$SEAL_STATUS" = "true" ] && [ -f "$VAULT_DIR/vault-init.json" ]; then
    echo "🔓 Vault is sealed, unsealing..."
    UNSEAL_KEY=$(cat "$VAULT_DIR/vault-init.json" | grep -o '"unseal_keys_b64":\["[^"]*"\]' | cut -d'"' -f4)
    $VAULT_BIN operator unseal "$UNSEAL_KEY"
fi

echo ""
echo "✅ Vault setup complete!"
echo "📊 Vault UI: http://127.0.0.1:8200/ui"
echo ""
