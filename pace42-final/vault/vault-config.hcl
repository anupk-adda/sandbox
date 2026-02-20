# HashiCorp Vault Configuration for pace42
# Development mode configuration

# Storage backend - using file for development
# For production, use Consul, etcd, or cloud storage
storage "file" {
  path = "./data"
}

# Listener configuration
listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true  # Set to false in production with proper certificates
}

# UI configuration
ui = true

# API address
api_addr = "http://127.0.0.1:8200"

# Default lease and max lease TTL
default_lease_ttl = "768h"  # 32 days
max_lease_ttl     = "8760h" # 1 year

# Plugin directory (if needed)
# plugin_directory = "/usr/local/lib/vault/plugins"
