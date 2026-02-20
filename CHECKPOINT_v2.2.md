# pace42 Checkpoint v2.2

**Date:** 2026-02-20  
**Version:** 2.2  
**Status:** 🟡 In Progress - Multi-User Garmin Account Architecture

---

## Overview

This checkpoint documents the implementation of a multi-user Garmin account architecture that allows multiple users to connect their individual Garmin accounts and receive isolated data access.

### Problem Statement

**Original Issue:** When User A disconnected their Garmin account and User B connected a different account, data was still being fetched from User A's account. This was because:
1. OAuth tokens were stored in a shared filesystem location (`~/.garminconnect`)
2. The MCP server singleton maintained cached credentials
3. No per-user token isolation existed

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Multiple users can connect Garmin accounts | Must |
| FR2 | Each user only sees their own Garmin data | Must |
| FR3 | Users can disconnect and reconnect different accounts | Must |
| FR4 | Credential storage is secure (encrypted at rest) | Must |
| FR5 | Token exchange happens on-demand (not stored) | Must |
| FR6 | Support 50-100 concurrent users | Should |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR1 | Token exchange latency < 5 seconds | Should |
| NFR2 | No filesystem token storage conflicts | Must |
| NFR3 | Memory usage scales gracefully | Should |
| NFR4 | Backward compatible with existing code | Must |

---

## Architecture Options Considered

### Option A: User-Scoped Persistent Clients (Rejected)

**Approach:** Maintain persistent MCP client per user with isolated token directories

```
~/.garminconnect/user_a/
~/.garminconnect/user_b/
```

**Pros:**
- Fast subsequent requests (client already authenticated)

**Cons:**
- High memory usage (50-100MB per user)
- 100 users = 5-10GB RAM
- Complex client lifecycle management
- Process cleanup issues

**Verdict:** Rejected due to resource constraints

---

### Option B: Per-Request Token Exchange (Selected)

**Approach:** Store credentials in Vault, exchange for tokens on each request

```
User Request → Get Creds from Vault → Exchange for Tokens → Fetch Data
```

**Pros:**
- No persistent state per user
- Constant memory usage
- Simple architecture
- Tokens always fresh

**Cons:**
- ~2-3s latency per request (login time)
- More Vault operations

**Verdict:** Selected for implementation

---

### Option C: Stateless (No Caching) (Rejected)

**Approach:** Login to Garmin on every request without any credential storage

**Pros:**
- Simplest implementation
- Most secure

**Cons:**
- Requires users to enter credentials on every query
- Poor UX

**Verdict:** Rejected due to poor user experience

---

## Final Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ User connects Garmin → POST /validate-garmin               │   │
│  │ User queries data → POST /chat                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Node.js)                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Auth middleware validates JWT token                     │   │
│  │ 2. Extracts userId from token                             │   │
│  │ 3. Stores/retrieves credentials from Vault                │   │
│  │ 4. Passes userId to Agent Service via X-User-ID header   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VAULT (HashiCorp)                              │
│  Path: pace42/garmin-credentials/{userId}                          │
│  Data: { username, password, created_at }                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT SERVICE (Python)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Receives X-User-ID header                                │   │
│  │ 2. Retrieves credentials from Vault                        │   │
│  │ 3. Spawns MCP server with credentials in env               │   │
│  │ 4. Returns data to Backend                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP SERVER (Python)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Reads GARMINTOKENS env var (base64 tokens)              │   │
│  │ 2. Authenticates with Garmin Connect API                   │   │
│  │ 3. Fetches user-specific data                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Store credentials, not tokens | Tokens expire; credentials are permanent |
| Vault KV v2 for storage | Encrypted at rest, access controlled |
| On-demand token exchange | Fresh tokens every time, no expiration issues |
| Environment variable injection | No filesystem conflicts between users |
| Per-request MCP spawn | Isolated state, no cleanup complexity |

---

## Implementation Progress

### ✅ Completed

#### Phase 1: Backend Vault Integration
- [x] Added Vault methods for Garmin credentials (store/get/delete)
- [x] Created `GarminTokenService` for credential management
- [x] Support for direct Vault token auth (development mode)

#### Phase 2: Auth Routes Update
- [x] `POST /validate-garmin` - Tests credentials, stores in Vault
- [x] `POST /disconnect-garmin` - Deletes credentials from Vault
- [x] Added authentication middleware to chat routes

#### Phase 3: Agent Service Updates
- [x] Extended `vault_client.py` with `get_garmin_credentials()`
- [x] Created `garmin_client_v2.py` - User-scoped MCP client
- [x] Updated agent endpoints to accept `X-User-ID` header
- [x] Updated `CurrentRunAnalyzer`, `LastRunsComparator`, `FitnessTrendAnalyzer`

#### Phase 4: Backend Agent Client
- [x] Updated `agent-client.ts` to pass `userId` to all methods
- [x] Chat routes extract `userId` from authenticated request
- [x] Pass `X-User-ID` header to Agent Service

### 🟡 In Progress / Issues Being Fixed

1. **Credential Validation Flow**
   - Issue: Credentials not being passed to test function initially
   - Status: Fixed - now passing credentials directly for validation

2. **Chat Route Authentication**
   - Issue: Chat routes didn't have auth middleware
   - Status: Fixed - added `authenticateToken` to chat routes

3. **User ID Propagation**
   - Issue: User ID not being passed through the chain
   - Status: Fixed - now extracting from JWT and passing to agent

### ⏳ Pending

- [ ] End-to-end testing with multiple users
- [ ] Performance testing (token exchange latency)
- [ ] Documentation update for API changes
- [ ] Frontend error handling improvements

---

## Files Modified

### Backend
```
src/services/vault/vault-service.ts      # Added Garmin credential methods
src/services/garmin/garmin-token-service.ts  # New: Token exchange service
src/routes/auth.routes.ts                # Updated validate/disconnect endpoints
src/routes/chat.routes.ts                # Added auth, pass userId
src/services/agent-client/agent-client.ts # Updated methods with userId
src/server.ts                            # Added auth middleware to chat
```

### Agent Service
```
src/vault_client.py                      # Extended with get_garmin_tokens
src/mcp/garmin_client_v2.py              # New: User-scoped MCP client
src/mcp/garmin_client_async.py           # Added reset function
src/agents/base_agent.py                 # Added user_id parameter
src/agents/current_run_analyzer.py       # Updated constructor
src/agents/last_runs_comparator.py       # Updated constructor
src/agents/fitness_trend_analyzer.py     # Updated constructor
src/main.py                              # Updated endpoints with Request param
```

---

## Testing Results

### Latest Test (2026-02-20)

**Status:** Services starting successfully

```
Agent Service (5001): ✅ Healthy
Backend (3000):       ✅ Healthy  
Frontend (5173):      ✅ Running
Vault (8200):         ✅ Unsealed
```

**Pending Verification:**
1. User A connects Garmin → Credentials stored in Vault
2. User A queries data → Gets User A's data
3. User B connects different Garmin → Credentials stored separately
4. User B queries data → Gets User B's data (not User A's)
5. User A queries again → Still gets User A's data

---

## Known Issues & Resolutions

| Issue | Cause | Resolution |
|-------|-------|------------|
| "No Garmin credentials found" | Credentials not passed to test function | Pass credentials directly during validation |
| "Failed to process request" | Chat routes lacked authentication | Add `authenticateToken` middleware |
| User ID undefined | Not extracting from auth token | Extract from `(req as any).user.userId` |
| Agent endpoint error | Missing Request parameter in endpoint | Add `request: Request` to function signature |
| TypeScript errors | userId type inference issues | Explicit type annotation `const userId: string` |

---

## Next Steps

1. **Complete Testing**
   - Test with 2 different Garmin accounts
   - Verify data isolation
   - Check error handling

2. **Performance Optimization** (if needed)
   - Consider credential caching (not tokens)
   - Parallel token exchange if multiple requests

3. **Documentation**
   - Update API docs with auth requirements
   - Deployment guide for Vault setup

4. **Production Readiness**
   - AppRole auth instead of root token
   - Vault TLS configuration
   - Credential rotation policy

---

## Technical Notes

### Vault Path Structure
```
pace42/
├── api-keys/              # OpenAI API key
├── jwt-config/            # JWT signing secrets
├── refresh-tokens/        # User refresh tokens
└── garmin-credentials/    # Garmin credentials per user
    ├── {userId-1}        # {username, password, created_at}
    ├── {userId-2}
    └── ...
```

### Environment Variables
```bash
# Backend
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=hvs.xxxxxx          # Development only

# Agent Service (reads from config/.env)
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=hvs.xxxxxx
```

### Token Exchange Flow
```
1. Backend receives request with userId
2. Backend retrieves credentials from Vault
3. Backend spawns MCP server process
4. Sets GARMINTOKENS env var with base64 tokens
   (Actually: sets GARMIN_EMAIL and GARMIN_PASSWORD)
5. MCP server logs in to Garmin
6. Fetches data
7. Process terminates
```

---

## References

- Garmin Connect Python Library: https://github.com/cyberjunky/python-garminconnect
- MCP Server: https://github.com/jazzband/mcp-garmin
- HashiCorp Vault KV v2: https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2

---

**Checkpoint created:** 2026-02-20  
**Next checkpoint expected:** After successful multi-user testing
