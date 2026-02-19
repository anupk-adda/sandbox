# Configuration File Templates

This document provides detailed templates for all configuration files needed for the Running Coach application.

---

## 1. Application Configuration

**File:** `config/app.config.json`

```json
{
  "app": {
    "name": "Running Coach",
    "version": "1.0.0",
    "environment": "development",
    "description": "AI-powered running coach with multi-agent analysis"
  },
  "api": {
    "port": 3000,
    "host": "localhost",
    "baseUrl": "/api/v1",
    "cors": {
      "enabled": true,
      "origins": [
        "http://localhost:5173",
        "http://localhost:3000"
      ],
      "credentials": true
    },
    "rateLimit": {
      "windowMs": 900000,
      "maxRequests": 100
    },
    "timeout": 30000
  },
  "agentService": {
    "host": "localhost",
    "port": 5000,
    "protocol": "http",
    "endpoints": {
      "analyze": "/analyze",
      "generatePlan": "/generate-plan",
      "health": "/health"
    },
    "timeout": 60000,
    "retries": 3
  },
  "database": {
    "type": "sqlite",
    "path": "./database/running_coach.db",
    "options": {
      "busyTimeout": 5000,
      "enableWAL": true
    },
    "backup": {
      "enabled": true,
      "interval": "daily",
      "retention": 7
    }
  },
  "mcp": {
    "garmin": {
      "name": "garmin-mcp",
      "command": "/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python",
      "args": [
        "/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py"
      ],
      "timeout": 30000,
      "retries": 3,
      "healthCheck": {
        "enabled": true,
        "interval": 60000
      }
    }
  },
  "security": {
    "tokenEncryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "keyDerivation": "pbkdf2"
    },
    "session": {
      "secret": "${SESSION_SECRET}",
      "maxAge": 86400000,
      "secure": false,
      "httpOnly": true
    },
    "dataPrivacy": {
      "enableExport": true,
      "enableDeletion": true,
      "retentionDays": 365
    }
  },
  "observability": {
    "logging": {
      "level": "info",
      "format": "json",
      "destination": "./logs",
      "rotation": {
        "enabled": true,
        "maxSize": "10m",
        "maxFiles": 10
      }
    },
    "tracking": {
      "promptVersions": true,
      "modelVersions": true,
      "dataQuality": true,
      "performance": true
    },
    "metrics": {
      "enabled": true,
      "interval": 60000,
      "endpoint": "/metrics"
    }
  },
  "features": {
    "autoSync": false,
    "weeklyAdaptation": false,
    "multiSport": false
  }
}
```

---

## 2. LLM Configuration

**File:** `config/llm.config.json`

```json
{
  "provider": "openai",
  "openai": {
    "apiKey": "${OPENAI_API_KEY}",
    "organization": "${OPENAI_ORG_ID}",
    "baseUrl": "https://api.openai.com/v1",
    "models": {
      "currentRunAnalyzer": {
        "name": "gpt-4-turbo-preview",
        "version": "2024-01-01"
      },
      "recentRunsComparator": {
        "name": "gpt-4-turbo-preview",
        "version": "2024-01-01"
      },
      "fitnessTrendAnalyzer": {
        "name": "gpt-4-turbo-preview",
        "version": "2024-01-01"
      },
      "coachAgent": {
        "name": "gpt-4-turbo-preview",
        "version": "2024-01-01"
      }
    },
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 2000,
      "topP": 1.0,
      "frequencyPenalty": 0.0,
      "presencePenalty": 0.0
    },
    "features": {
      "structuredOutputs": true,
      "toolCalling": true,
      "streaming": true,
      "jsonMode": true
    },
    "timeout": 30000,
    "retries": 3
  },
  "fallback": {
    "enabled": false,
    "provider": "anthropic",
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "model": "claude-3-opus-20240229"
    }
  },
  "rateLimiting": {
    "requestsPerMinute": 60,
    "tokensPerMinute": 90000,
    "strategy": "sliding-window"
  },
  "caching": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 100
  },
  "monitoring": {
    "trackTokenUsage": true,
    "trackLatency": true,
    "trackErrors": true,
    "alertThresholds": {
      "errorRate": 0.05,
      "avgLatency": 5000
    }
  },
  "prompts": {
    "versioning": true,
    "versionFormat": "YYYY-MM-DD-v{number}",
    "storageLocation": "./agent-service/src/prompts"
  }
}
```

---

## 3. Garmin Credentials (v1)

**File:** `config/garmin.credentials.txt`

```bash
# ============================================
# Garmin OAuth Credentials
# ============================================
# 
# SECURITY NOTICE:
# This file contains sensitive credentials.
# - Keep this file secure (chmod 600)
# - Never commit to version control
# - Will be migrated to vault in v1.1
#
# ============================================

# OAuth Consumer Credentials
# Obtain from: https://connect.garmin.com/oauthConfirm
GARMIN_CONSUMER_KEY=your_consumer_key_here
GARMIN_CONSUMER_SECRET=your_consumer_secret_here

# OAuth Access Tokens
# These are auto-updated by the MCP server
GARMIN_ACCESS_TOKEN=
GARMIN_ACCESS_TOKEN_SECRET=
GARMIN_TOKEN_EXPIRY=

# User Information
# Auto-populated after first successful authentication
GARMIN_USER_ID=
GARMIN_USER_EMAIL=
GARMIN_USER_DISPLAY_NAME=

# API Configuration
GARMIN_API_BASE_URL=https://apis.garmin.com
GARMIN_CONNECT_URL=https://connect.garmin.com

# Rate Limiting
GARMIN_RATE_LIMIT_PER_MINUTE=60
GARMIN_RATE_LIMIT_PER_HOUR=1000

# Data Sync Settings
GARMIN_SYNC_LOOKBACK_DAYS=90
GARMIN_SYNC_BATCH_SIZE=50

# ============================================
# Migration Plan (v1.1)
# ============================================
# 
# Target: HashiCorp Vault or AWS Secrets Manager
# 
# Vault Path Structure:
# - secret/running-coach/garmin/consumer-key
# - secret/running-coach/garmin/consumer-secret
# - secret/running-coach/garmin/access-token
# - secret/running-coach/garmin/access-token-secret
#
# Migration Script: ./scripts/migrate-to-vault.sh
#
# ============================================

# Last Updated: [AUTO-GENERATED]
# Updated By: [MCP Server]
```

---

## 4. Environment Variables

**File:** `config/.env.example`

```bash
# ============================================
# Running Coach App - Environment Variables
# ============================================

# Environment
NODE_ENV=development

# API Server
API_PORT=3000
API_HOST=localhost

# Agent Service
AGENT_SERVICE_PORT=5000
AGENT_SERVICE_HOST=localhost

# Database
DATABASE_PATH=./database/running_coach.db

# OpenAI API
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_ORG_ID=org-your-org-id-here

# Session Security
SESSION_SECRET=your-session-secret-here-change-in-production

# Encryption Keys
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ENCRYPTION_SALT=your-encryption-salt-here

# Garmin MCP Server
GARMIN_MCP_PYTHON_PATH=/Users/anupk/devops/mcp/garmin_mcp/.venv/bin/python
GARMIN_MCP_SERVER_PATH=/Users/anupk/devops/mcp/garmin_mcp/garmin_mcp_server.py

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=./logs

# Feature Flags
FEATURE_AUTO_SYNC=false
FEATURE_WEEKLY_ADAPTATION=false
FEATURE_MULTI_SPORT=false

# Monitoring (Optional)
SENTRY_DSN=
DATADOG_API_KEY=

# ============================================
# Production Overrides
# ============================================
# 
# For production, create a .env.production file with:
# - NODE_ENV=production
# - Secure SESSION_SECRET
# - Strong ENCRYPTION_KEY
# - Production API keys
# - HTTPS enabled
#
# ============================================
```

---

## 5. Database Configuration

**File:** `config/database.config.json`

```json
{
  "sqlite": {
    "filename": "./database/running_coach.db",
    "options": {
      "busyTimeout": 5000,
      "enableWAL": true,
      "cacheSize": -2000,
      "pageSize": 4096,
      "synchronous": "NORMAL",
      "journalMode": "WAL",
      "foreignKeys": true
    }
  },
  "migrations": {
    "directory": "./database/migrations",
    "tableName": "migrations",
    "autoRun": false
  },
  "seeds": {
    "directory": "./database/seeds",
    "enabled": false
  },
  "backup": {
    "enabled": true,
    "directory": "./database/backups",
    "schedule": "0 2 * * *",
    "retention": {
      "daily": 7,
      "weekly": 4,
      "monthly": 12
    },
    "compression": true
  },
  "performance": {
    "poolSize": 5,
    "idleTimeout": 10000,
    "connectionTimeout": 5000,
    "queryTimeout": 30000
  },
  "monitoring": {
    "slowQueryThreshold": 1000,
    "logQueries": false,
    "logSlowQueries": true
  }
}
```

---

## 6. Agent Configuration

**File:** `config/agents.config.json`

```json
{
  "orchestration": {
    "framework": "langgraph",
    "executionMode": "parallel",
    "timeout": 60000,
    "retries": 2
  },
  "agents": {
    "currentRunAnalyzer": {
      "name": "Current Run Analyzer",
      "version": "1.0.0",
      "enabled": true,
      "timeout": 15000,
      "maxRetries": 2,
      "outputSchema": "CurrentRunAnalysis",
      "systemPrompt": "You are an expert running coach analyzing a single run activity.",
      "capabilities": [
        "classify_run_type",
        "analyze_pacing",
        "analyze_heart_rate",
        "analyze_biomechanics"
      ]
    },
    "recentRunsComparator": {
      "name": "Recent Runs Comparator",
      "version": "1.0.0",
      "enabled": true,
      "timeout": 15000,
      "maxRetries": 2,
      "outputSchema": "RecentRunsComparison",
      "systemPrompt": "You are an expert running coach comparing recent training patterns.",
      "capabilities": [
        "compare_efficiency",
        "detect_consistency",
        "identify_risk_flags"
      ],
      "parameters": {
        "lookbackRuns": 3,
        "comparisonMetrics": [
          "pace",
          "heart_rate",
          "cadence",
          "efficiency"
        ]
      }
    },
    "fitnessTrendAnalyzer": {
      "name": "Fitness Trend Analyzer",
      "version": "1.0.0",
      "enabled": true,
      "timeout": 15000,
      "maxRetries": 2,
      "outputSchema": "FitnessTrendAnalysis",
      "systemPrompt": "You are an expert running coach analyzing long-term fitness trends.",
      "capabilities": [
        "analyze_vo2max_trend",
        "analyze_load_recovery",
        "assess_readiness"
      ],
      "parameters": {
        "lookbackDays": 90,
        "trendMetrics": [
          "vo2_max",
          "training_load",
          "recovery_time"
        ]
      }
    },
    "coachAgent": {
      "name": "Coach Agent",
      "version": "1.0.0",
      "enabled": true,
      "timeout": 30000,
      "maxRetries": 2,
      "outputSchema": "CoachingReport",
      "systemPrompt": "You are an expert running coach synthesizing insights and creating personalized training plans.",
      "capabilities": [
        "synthesize_insights",
        "generate_narrative",
        "generate_training_plans"
      ],
      "parameters": {
        "narrativeStyle": "encouraging",
        "planTypes": [
          "10k",
          "half_marathon",
          "marathon"
        ]
      }
    }
  },
  "trainingPlans": {
    "safetyConstraints": {
      "maxHardSessionsPerWeek": 2,
      "maxVolumeIncreasePercent": 12,
      "maxLongRunPercent": 35,
      "minRecoveryDays": 1,
      "maxConsecutiveHardDays": 2
    },
    "phases": {
      "base": {
        "durationWeeks": 4,
        "focusAreas": [
          "aerobic_base",
          "consistency"
        ]
      },
      "build": {
        "durationWeeks": 6,
        "focusAreas": [
          "threshold",
          "tempo"
        ]
      },
      "peak": {
        "durationWeeks": 3,
        "focusAreas": [
          "race_pace",
          "speed"
        ]
      },
      "taper": {
        "durationWeeks": 2,
        "focusAreas": [
          "recovery",
          "freshness"
        ]
      }
    },
    "workoutTypes": {
      "easy": {
        "intensity": "60-70% max HR",
        "purpose": "aerobic development"
      },
      "tempo": {
        "intensity": "80-85% max HR",
        "purpose": "lactate threshold"
      },
      "interval": {
        "intensity": "90-95% max HR",
        "purpose": "VO2 max"
      },
      "long": {
        "intensity": "65-75% max HR",
        "purpose": "endurance"
      },
      "recovery": {
        "intensity": "50-60% max HR",
        "purpose": "active recovery"
      }
    }
  },
  "dataQuality": {
    "requiredFields": [
      "distance",
      "duration",
      "avg_heart_rate"
    ],
    "optionalFields": [
      "cadence",
      "power",
      "elevation"
    ],
    "validationRules": {
      "minDistance": 1000,
      "maxDistance": 50000,
      "minDuration": 300,
      "maxDuration": 18000,
      "minHeartRate": 40,
      "maxHeartRate": 220
    }
  }
}
```

---

## Configuration Loading Priority

1. **Default values** (hardcoded in application)
2. **Config files** (`*.config.json`)
3. **Environment variables** (`.env`)
4. **Command-line arguments** (highest priority)

---

## Security Best Practices

### File Permissions
```bash
# Configuration files
chmod 644 config/*.config.json

# Credentials file
chmod 600 config/garmin.credentials.txt

# Environment file
chmod 600 config/.env
```

### Git Ignore
```gitignore
# Add to .gitignore
config/.env
config/.env.*
config/garmin.credentials.txt
config/*.local.json
```

### Encryption
- All sensitive values should use `${VARIABLE}` syntax
- Actual values stored in `.env` file
- Production: Use environment variables or secrets manager

---

## Configuration Validation

Each service should validate its configuration on startup:

```typescript
// Example validation
function validateConfig(config: AppConfig): void {
  if (!config.api.port) {
    throw new Error('API port is required');
  }
  if (!config.database.path) {
    throw new Error('Database path is required');
  }
  // ... more validations
}
```

---

## Migration to Vault (v1.1)

### Preparation Steps:
1. Set up HashiCorp Vault or AWS Secrets Manager
2. Create secret paths for all credentials
3. Update application to read from vault
4. Migrate existing credentials
5. Remove plain text credential files
6. Update documentation

### Vault Structure:
```
secret/
  running-coach/
    garmin/
      consumer-key
      consumer-secret
      access-token
      access-token-secret
    openai/
      api-key
      org-id
    encryption/
      master-key
      salt
```

---

## Notes

- All configuration files use JSON format for easy parsing
- Environment variables override config file values
- Sensitive data uses `${VARIABLE}` placeholders
- Configuration is validated on application startup
- Changes to config require service restart
- Production configs should be managed separately