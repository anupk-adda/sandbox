# R42 Garmin Authentication — Execution Steps (PKCE OAuth, no password capture)

## Brief approach (for the coding agent)

**Do not ask users for their Garmin username/password.** Garmin Connect’s developer program uses **OAuth 2.0 with PKCE**: your app redirects the user to Garmin’s login + consent screen, receives an **authorization code**, then exchanges it for **access + refresh tokens**. PKCE prevents intercepted-code attacks and keeps credentials with Garmin. fileciteturn0file0L1-L12

**Persist only tokens (especially the refresh token)**, not user passwords. Use the refresh token to mint fresh access tokens for future data fetches. fileciteturn0file0L1-L12 fileciteturn0file0L1-L15

---

## Target outcome

1. User clicks **“Connect Garmin”** in your R42 app.
2. R42 sends the user to Garmin consent/login (hosted by Garmin).
3. Garmin redirects back to R42 with `code` (+ optional `state`).
4. R42 backend exchanges `code` + `code_verifier` for tokens.
5. R42 stores **refresh_token** securely; uses it to refresh access tokens and fetch data later.
6. R42 can also fetch and store the Garmin **API User ID** to link Garmin data to your internal user. fileciteturn0file0L1-L16

---

## Prereqs (one-time setup)

### 1) Enroll and create a Garmin “consumer”
- Create your app in Garmin Connect Developer Program.
- Obtain:
  - `GARMIN_CLIENT_ID` (consumer key / client id)
  - `GARMIN_CLIENT_SECRET` (consumer secret)
- Confirm which API product(s) you are enabled for (e.g., Wellness API).

### 2) Decide redirect URI(s)
Examples:
- Local dev: `http://localhost:3000/auth/garmin/callback`
- Prod: `https://r42.yourdomain.com/auth/garmin/callback`

> The `redirect_uri` must match the one used in the authorization request when exchanging the code. fileciteturn0file0L1-L24 fileciteturn0file0L1-L16

### 3) Decide token storage strategy
- **Backend-only storage is strongly recommended.**
- Store at minimum:
  - `refresh_token`
  - `refresh_token_expires_at` (or seconds)
  - `access_token` (optional cache)
  - `access_token_expires_at`
  - `garmin_user_id` (from Wellness API user id endpoint)
  - `scope` (optional)
- Encrypt tokens at rest (KMS / envelope encryption) and restrict access by service role.

---

## Step-by-step execution (implementation)

## Step A — R42 UI: “Connect Garmin” button
1. Add button: **Connect Garmin**
2. On click, call your backend endpoint: `POST /api/auth/garmin/start`
   - Backend returns a `redirectUrl` to Garmin’s authorization endpoint.
3. Browser navigates to `redirectUrl`.

**Why backend creates the URL**
- Prevents leaking PKCE verifier in the browser.
- Lets you bind `state` to the logged-in R42 user.

---

## Step B — Backend: Start PKCE authorization

### B1) Generate PKCE values
On `POST /api/auth/garmin/start`:

1. Generate a **code_verifier**:
   - random string, length **43–128**
   - allowed chars: `A-Z a-z 0-9 - . _ ~` fileciteturn0file0L1-L9
2. Compute **code_challenge**:
   - `base64url(sha256(code_verifier))` fileciteturn0file0L1-L11
3. Generate a **state** value (random, unguessable) and store it server-side.

### B2) Persist transient auth session
Store a short-lived “auth session” row keyed by `state`:
- `state`
- `r42_user_id`
- `code_verifier` (encrypted or in-memory store)
- `created_at`
- TTL: 10–15 minutes

### B3) Build the Garmin authorization URL
Garmin authorization endpoint:  
`GET https://connect.garmin.com/oauth2Confirm` fileciteturn0file0L1-L16

Required parameters:
- `response_type=code` fileciteturn0file0L1-L19
- `client_id=<GARMIN_CLIENT_ID>` fileciteturn0file0L1-L21
- `code_challenge=<code_challenge>` fileciteturn0file0L1-L23
- `code_challenge_method=S256` fileciteturn0file0L1-L26

Optional (recommended):
- `redirect_uri=<your_callback_uri>` fileciteturn0file0L1-L28
- `state=<state>` fileciteturn0file0L1-L31

Return this URL to the browser.

> Note: Garmin notes CORS preflight (OPTIONS) is not supported, so do this via normal browser redirect + backend POSTs, not a frontend fetch to Garmin. fileciteturn0file0L1-L14

---

## Step C — Garmin redirect → R42 callback

### C1) Create callback route
Frontend route or server route:
- `GET /auth/garmin/callback?code=...&state=...`

### C2) Validate `state`
1. Backend endpoint receives `code` and `state` (from query).
2. Look up the stored auth session for `state`.
3. Reject if:
   - missing
   - expired
   - already used
4. This prevents spoofed redirects. fileciteturn0file0L1-L33

---

## Step D — Backend: Exchange authorization code for tokens

Token endpoint:  
`POST https://diauth.garmin.com/di-oauth2-service/oauth/token` fileciteturn0file0L1-L4

Form parameters (x-www-form-urlencoded): fileciteturn0file0L1-L14
- `grant_type=authorization_code` (required)
- `client_id=<GARMIN_CLIENT_ID>` (required)
- `client_secret=<GARMIN_CLIENT_SECRET>` (required)
- `code=<authorization_code>` (required)
- `code_verifier=<code_verifier from Step B>` (required)
- `redirect_uri=<must match Step B if used>`

Expected response includes: fileciteturn0file0L1-L16
- `access_token`
- `expires_in`
- `refresh_token`
- `refresh_token_expires_in`
- `scope`

### D1) Store tokens securely
Persist in your DB (recommended schema):
- `r42_user_id`
- `garmin_refresh_token` (encrypted)
- `garmin_refresh_token_expires_at = now + refresh_token_expires_in`
- `garmin_access_token` (optional cache, encrypted)
- `garmin_access_token_expires_at = now + expires_in - safety_buffer`
- `garmin_scope` (optional)
- `updated_at`

**Safety buffer:** Garmin recommends subtracting ~600 seconds from expiry to refresh early. fileciteturn0file0L1-L4

### D2) Cleanup
- Mark auth session `state` as used; delete the stored `code_verifier`.

---

## Step E — Fetch Garmin User ID (linking)

After you have an access token, fetch Garmin API User ID:

`GET https://apis.garmin.com/wellness-api/rest/user/id` fileciteturn0file0L1-L11

- Header: `Authorization: Bearer <access_token>` fileciteturn0file0L1-L10
- Response: `{"userId": "<id>"}` fileciteturn0file0L1-L14

Store `garmin_user_id` on the R42 user record.

---

## Step F — Ongoing data fetch (using refresh tokens)

### F1) Access token refresh flow
When an API call is needed:
1. If access token is missing/expired (or within buffer), refresh it.
2. Refresh endpoint is the same token endpoint: fileciteturn0file0L1-L7  
   `POST https://diauth.garmin.com/di-oauth2-service/oauth/token`

Form params:
- `grant_type=refresh_token`
- `client_id`
- `client_secret`
- `refresh_token=<latest refresh token>`

Response returns **a new access token and a new refresh token**; store the **new refresh token**. fileciteturn0file0L1-L8 fileciteturn0file0L1-L16

### F2) Calling Garmin APIs
Include:
- `Authorization: Bearer <access_token>` fileciteturn0file0L1-L10

Example permission check endpoint (useful for debugging):
`GET https://apis.garmin.com/wellness-api/rest/user/permissions` fileciteturn0file0L1-L10

---

## Step G — Disconnect / Delete registration

If R42 offers “Disconnect Garmin” or “Delete my account”, call:

`DELETE https://apis.garmin.com/wellness-api/rest/user/registration` fileciteturn0file0L1-L9

Then remove tokens from your DB.

---

## Security and UX requirements (non-negotiable)

1. **Never collect Garmin passwords** (no username/password fields).
2. PKCE verifier must be generated server-side and never logged.
3. Store tokens encrypted at rest; do not store in localStorage.
4. Rotate refresh token on every refresh (Garmin issues a new one). fileciteturn0file0L1-L8
5. Add auditing:
   - last successful sync time
   - last token refresh time
   - last error code
6. Implement robust error handling:
   - user declines consent (no `code`)
   - invalid/expired `state`
   - token exchange failures
   - revoked consent → re-auth required

---

## Suggested R42 API endpoints (minimal contract)

### Auth
- `POST /api/auth/garmin/start` → `{ redirectUrl }`
- `GET /api/auth/garmin/callback?code&state` → redirects to UI success page
- `POST /api/auth/garmin/disconnect` → `{ ok: true }`

### Data
- `POST /api/garmin/sync` → triggers fetch using stored tokens
- `GET /api/garmin/status` → connection + last sync status

---

## Implementation checklist (quick)

- [ ] Garmin client id/secret configured in secrets manager
- [ ] Redirect URI registered + matches environment
- [ ] PKCE verifier/challenge implemented
- [ ] State stored/validated with TTL
- [ ] Token exchange implemented (authorization_code + refresh_token)
- [ ] Token encryption + rotation implemented
- [ ] User ID fetched and stored
- [ ] Disconnect implemented (DELETE registration)
- [ ] Logging is sanitized (no tokens, no verifier, no codes)
- [ ] E2E test: connect → fetch user id → fetch permissions → refresh token → disconnect

---

## Notes for your coding agent

- This spec follows Garmin’s OAuth2 PKCE flow: authorization request to `https://connect.garmin.com/oauth2Confirm`, code exchange at `https://diauth.garmin.com/di-oauth2-service/oauth/token`, and data access using `Authorization: Bearer`. fileciteturn0file0L1-L16 fileciteturn0file0L1-L14
- Treat all Garmin calls as backend-to-Garmin (server-to-server) to avoid CORS issues. fileciteturn0file0L1-L14
