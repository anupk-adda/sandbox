# HashiCorp Vault for pace42

## Setup

The Vault binary is not included in the repository due to file size limits.

### Download Vault

```bash
cd pace42-final/vault
# Download Vault 1.18.5 for macOS ARM64
curl -fsSL https://releases.hashicorp.com/vault/1.18.5/vault_1.18.5_darwin_arm64.zip -o vault.zip
unzip vault.zip
rm vault.zip
chmod +x vault
```

For other platforms, visit: https://developer.hashicorp.com/vault/downloads

### Initialize Vault

```bash
./setup-vault.sh
```

This will:
1. Start Vault server
2. Initialize Vault (creates unseal key and root token)
3. Configure KV secrets engine
4. Configure Transit encryption engine
5. Create AppRole for backend authentication
6. Update config/.env with credentials

### Access

- Vault UI: http://localhost:8200/ui
- API: http://localhost:8200/v1/

### Configuration Files

- `vault-config.hcl` - Vault server configuration
- `setup-vault.sh` - Automated setup script
- `vault-init.json` - Generated after init (contains root token and unseal key)

**Note:** `vault-init.json` is generated after running setup and contains sensitive data. Keep it secure!
