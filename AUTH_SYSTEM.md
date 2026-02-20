# Enhanced Authentication System

## Overview

This document describes the enhanced authentication system for pace42, which includes:

- **HashiCorp Vault OSS** integration for secure credential management
- **Password recovery** with email reset tokens
- **Persistent sessions** with refresh tokens
- **Password strength** requirements and validation
- **Session management** with active session tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           pace42 Auth System                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │   Frontend   │────▶│   Backend    │────▶│    Vault     │           │
│  │   (React)    │◄────│   (Node.js)  │◄────│    (OSS)     │           │
│  └──────────────┘     └──────────────┘     └──────────────┘           │
│         │                    │                    │                    │
│         │                    │                    │                    │
│         ▼                    ▼                    ▼                    │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │                    SQLite Database                        │         │
│  │  - users, user_sessions, password_reset_tokens           │         │
│  └──────────────────────────────────────────────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. HashiCorp Vault OSS

**Location:** `/pace42-final/vault/`

Vault provides secure storage for:
- JWT signing secrets (rotatable)
- API keys (OpenAI, Garmin)
- Refresh tokens
- Encrypted sensitive data

**Setup:**
```bash
cd pace42-final/vault
./setup-vault.sh
```

**Access:**
- UI: http://localhost:8200/ui
- API: http://localhost:8200/v1/

### 2. Backend Services

#### Token Service (`/backend/src/services/auth/token-service.ts`)
Manages JWT tokens and refresh tokens:
- Access tokens (15 min expiry)
- Refresh tokens (7-30 days based on "Remember Me")
- Password reset tokens (1 hour expiry)
- Token rotation on refresh

#### Vault Service (`/backend/src/services/vault/vault-service.ts`)
Integrates with HashiCorp Vault:
- AppRole authentication
- KV secrets engine (v2)
- Transit encryption engine
- Automatic token refresh

#### Auth Routes (`/backend/src/routes/auth.routes.ts`)
Enhanced endpoints:
- `POST /api/v1/auth/signup` - User registration with password strength
- `POST /api/v1/auth/login` - Login with "Remember Me" option
- `POST /api/v1/auth/refresh` - Token refresh endpoint
- `POST /api/v1/auth/logout` - Session revocation
- `POST /api/v1/auth/forgot-password` - Password reset request
- `GET /api/v1/auth/verify-reset-token` - Token validation
- `POST /api/v1/auth/reset-password` - Password reset
- `POST /api/v1/auth/change-password` - Password change (authenticated)
- `GET /api/v1/auth/sessions` - List active sessions
- `POST /api/v1/auth/sessions/:id/revoke` - Revoke specific session

### 3. Frontend Services

#### Auth Service (`/frontend/src/services/authService.ts`)
Enhanced client-side auth:
- Automatic token refresh before expiry
- Persistent sessions with localStorage
- Password strength validation
- Session management UI

#### UI Components
- **LoginForm** - Login with "Remember Me" and "Forgot Password" link
- **SignupForm** - Registration with password strength indicator
- **ForgotPasswordForm** - Password reset request
- **ResetPasswordForm** - New password with strength validation

---

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

### Token Security
- Access tokens: 15-minute expiry (short-lived)
- Refresh tokens: 7 days (default) or 30 days (with "Remember Me")
- Refresh tokens are hashed (SHA-256) before storage
- Tokens are invalidated on password change
- Automatic token rotation on refresh

### Session Management
- Each device gets a unique session
- Sessions track last used timestamp
- Users can view and revoke active sessions
- All sessions revoked on password change

### Password Reset Security
- Tokens expire after 1 hour
- Single-use tokens
- Previous tokens invalidated on new request
- Rate limiting on reset endpoints

---

## Database Schema

### New Tables

```sql
-- Password Reset Tokens
CREATE TABLE password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Sessions (for refresh tokens)
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password History (optional, for preventing reuse)
CREATE TABLE password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Environment Variables

Add to `/pace42-final/config/.env`:

```bash
# HashiCorp Vault Configuration
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROLE_ID=<role-id-from-setup>
VAULT_SECRET_ID=<secret-id-from-setup>
VAULT_TOKEN=<root-token-for-dev>

# JWT Secrets (fallback if Vault unavailable)
JWT_SECRET=<secure-random-string>
JWT_REFRESH_SECRET=<different-secure-random-string>
```

---

## User Flows

### 1. Sign Up
```
1. User enters email and password
2. Frontend validates password strength
3. Backend hashes password (bcrypt, 12 rounds)
4. Generate token pair (access + refresh)
5. Store refresh token hash in database
6. Return tokens to frontend
7. Frontend stores tokens in localStorage
```

### 2. Login with "Remember Me"
```
1. User enters credentials and checks "Remember Me"
2. Backend validates credentials
3. Generate token pair with extended refresh (30 days)
4. Store refresh token in database and Vault
5. Frontend stores tokens with remember flag
6. Token refresh scheduled before expiry
```

### 3. Password Reset
```
1. User clicks "Forgot Password"
2. Enters email address
3. Backend generates reset token (1 hour expiry)
4. Token hash stored in database
5. (Dev: Token returned in response)
6. (Prod: Email sent with reset link)
7. User clicks link: /reset-password?token=xxx
8. Frontend validates token with backend
9. User enters new password
10. Backend validates and updates password
11. All sessions revoked, user must re-login
```

### 4. Token Refresh
```
1. Frontend detects token nearing expiry (2 min buffer)
2. Calls /api/v1/auth/refresh with refresh token
3. Backend validates refresh token hash
4. Generates new token pair
5. Revokes old refresh token
6. Returns new tokens to frontend
7. Frontend updates storage
```

### 5. Session Management
```
1. User views "Active Sessions" in settings
2. Frontend fetches sessions from /api/v1/auth/sessions
3. User can revoke any session
4. Revoked session's refresh token becomes invalid
```

---

## API Endpoints

### Authentication

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/v1/auth/signup` | POST | No | Create new account |
| `/api/v1/auth/login` | POST | No | Login to account |
| `/api/v1/auth/refresh` | POST | No | Refresh access token |
| `/api/v1/auth/logout` | POST | Yes | Logout and revoke session |
| `/api/v1/auth/forgot-password` | POST | No | Request password reset |
| `/api/v1/auth/verify-reset-token` | GET | No | Validate reset token |
| `/api/v1/auth/reset-password` | POST | No | Reset password with token |
| `/api/v1/auth/change-password` | POST | Yes | Change password |
| `/api/v1/auth/me` | GET | Yes | Get current user info |
| `/api/v1/auth/sessions` | GET | Yes | List active sessions |
| `/api/v1/auth/sessions/:id/revoke` | POST | Yes | Revoke a session |
| `/api/v1/auth/vault-status` | GET | No | Check Vault health |

---

## Development vs Production

### Development Mode
- Vault UI accessible at http://localhost:8200/ui
- Password reset tokens returned in API response
- Email sending not implemented (console log instead)
- Session duration can be shortened for testing

### Production Considerations
- Use TLS certificates for Vault
- Configure email service (SendGrid, AWS SES, etc.)
- Set up Vault auto-unseal with cloud KMS
- Enable audit logging in Vault
- Use Redis for session storage (scale horizontally)
- Implement rate limiting on auth endpoints
- Add CAPTCHA for password reset
- Set up monitoring and alerting

---

## Troubleshooting

### Vault Not Starting
```bash
# Check Vault logs
tail -f pace42-final/logs/vault-setup.log

# Check if port 8200 is in use
lsof -i :8200

# Manually start Vault
cd pace42-final/vault
./vault server -config=vault-config.hcl
```

### Token Refresh Not Working
- Check browser console for errors
- Verify refresh token exists in localStorage
- Check backend logs for token validation errors
- Ensure database migrations applied

### Password Reset Token Invalid
- Tokens expire after 1 hour
- Only the most recent token is valid
- Check server time is correct

---

## Migration from v1.1

The database migrations are applied automatically on startup. To manually apply:

```bash
cd pace42-final/backend
cat ../database/migrations/002_auth_improvements.sql | sqlite3 database/running_coach.db
```

---

## Future Enhancements

- [ ] Email integration for password reset
- [ ] Two-factor authentication (2FA)
- [ ] OAuth providers (Google, Apple, Strava)
- [ ] Biometric authentication (WebAuthn)
- [ ] Session geo-location tracking
- [ ] Anomaly detection for suspicious logins
- [ ] Account lockout after failed attempts
- [ ] Password breach checking (Have I Been Pwned API)

---

**Document Version:** 1.1.1  
**Last Updated:** 2026-02-20
