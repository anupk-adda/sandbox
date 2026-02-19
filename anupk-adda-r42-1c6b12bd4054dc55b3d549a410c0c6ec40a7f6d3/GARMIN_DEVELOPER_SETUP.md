# Garmin Developer Account Setup Guide

**Date:** 2026-01-31  
**Status:** 📋 Prerequisites for OAuth Implementation

---

## 🎯 Objective

Set up a Garmin Connect Developer account and register the R42 Running Coach application to obtain OAuth credentials required for implementation.

---

## 📋 Prerequisites Checklist

Before implementing the OAuth flow, you need:

- [ ] Garmin Connect Developer account
- [ ] Registered application in Garmin Developer Portal
- [ ] `GARMIN_CLIENT_ID` (Consumer Key)
- [ ] `GARMIN_CLIENT_SECRET` (Consumer Secret)
- [ ] Approved API access (Wellness API)
- [ ] Configured redirect URIs

---

## 🚀 Step-by-Step Setup

### Step 1: Create Garmin Connect Account

1. Go to [Garmin Connect](https://connect.garmin.com/)
2. Create a personal Garmin Connect account if you don't have one
3. Verify your email address

### Step 2: Enroll in Garmin Developer Program

1. Visit [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/overview/)
2. Click "Sign Up" or "Get Started"
3. Sign in with your Garmin Connect credentials
4. Complete the developer enrollment form:
   - Company/Organization name: "R42 Running Coach" (or your company name)
   - Developer type: Individual or Company
   - Intended use: Running coaching and fitness analysis
   - Contact information

### Step 3: Register Your Application

1. Log in to [Garmin Connect Developer Portal](https://developer.garmin.com/)
2. Navigate to "My Apps" or "Applications"
3. Click "Create New Application"
4. Fill in application details:

   **Application Information:**
   - **Application Name:** R42 Running Coach
   - **Description:** AI-powered running coach that analyzes Garmin activity data to provide personalized coaching insights and training recommendations
   - **Application Type:** Web Application
   - **Category:** Health & Fitness

   **OAuth Configuration:**
   - **Redirect URIs:**
     - Development: `http://localhost:3000/api/auth/garmin/callback`
     - Production: `https://yourdomain.com/api/auth/garmin/callback`
   
   **API Access:**
   - Request access to: **Wellness API**
   - Scopes needed:
     - Read activities
     - Read user profile
     - Read fitness metrics
     - Read heart rate data

5. Submit application for review

### Step 4: Wait for Approval

- Garmin typically reviews applications within 1-2 business days
- You'll receive an email notification when approved
- Check your application status in the developer portal

### Step 5: Obtain Credentials

Once approved:

1. Go to your application in the developer portal
2. Navigate to "OAuth Credentials" or "API Keys" section
3. Copy the following credentials:
   - **Consumer Key** (Client ID)
   - **Consumer Secret** (Client Secret)

**⚠️ Security Warning:** Keep these credentials secure and never commit them to version control!

### Step 6: Configure R42 Application

1. Create or update `config/.env` file:

```bash
# Garmin OAuth Configuration
GARMIN_CLIENT_ID=your_consumer_key_here
GARMIN_CLIENT_SECRET=your_consumer_secret_here

# Development
GARMIN_REDIRECT_URI=http://localhost:3000/api/auth/garmin/callback

# Production (update when deploying)
# GARMIN_REDIRECT_URI=https://yourdomain.com/api/auth/garmin/callback

# Token Encryption
CREDENTIAL_MASTER_KEY=generate_a_secure_random_key_here
```

2. Generate a secure master key:
```bash
# On macOS/Linux
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. Add to `.gitignore` (should already be there):
```
config/.env
config/*.credentials.txt
```

---

## 📚 Garmin API Documentation

### Essential Resources

1. **OAuth 2.0 Documentation:**
   - [Garmin OAuth Guide](https://developer.garmin.com/gc-developer-program/oauth/)
   - Authorization endpoint: `https://connect.garmin.com/oauth2Confirm`
   - Token endpoint: `https://diauth.garmin.com/di-oauth2-service/oauth/token`

2. **Wellness API Documentation:**
   - [Wellness API Overview](https://developer.garmin.com/gc-developer-program/wellness-api/)
   - Base URL: `https://apis.garmin.com/wellness-api/rest`
   - Key endpoints:
     - `/user/id` - Get Garmin user ID
     - `/user/permissions` - Check permissions
     - `/activities` - Get activities
     - `/dailies` - Get daily summaries

3. **API Rate Limits:**
   - Check current rate limits in developer portal
   - Typical limits: 60 requests/minute, 1000 requests/hour
   - Implement rate limiting in your application

---

## 🧪 Testing Your Setup

### Test 1: Verify Credentials

Create a simple test script to verify your credentials work:

```bash
# Test token endpoint accessibility
curl -X POST https://diauth.garmin.com/di-oauth2-service/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### Test 2: OAuth Flow

1. Start your R42 application
2. Click "Connect Garmin" button
3. Verify redirect to Garmin login page
4. Login and grant permissions
5. Verify successful callback and token storage

---

## 🔒 Security Best Practices

### Credential Management

1. **Never commit credentials to Git:**
   ```bash
   # Verify .gitignore includes:
   config/.env
   config/*.credentials.txt
   *.key
   *.pem
   ```

2. **Use environment variables:**
   - Development: `.env` file
   - Production: Secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

3. **Rotate credentials regularly:**
   - Set reminder to rotate every 90 days
   - Update in both Garmin portal and your application

### Token Security

1. **Encrypt tokens at rest:**
   - Use AES-256-GCM encryption
   - Store encryption keys separately
   - Never log tokens

2. **Implement token refresh:**
   - Refresh before expiry (600 seconds buffer)
   - Store new refresh token on each refresh
   - Handle refresh failures gracefully

---

## 🐛 Troubleshooting

### Common Issues

**Issue 1: Application Not Approved**
- **Solution:** Provide more detailed description of your use case
- Contact Garmin developer support if delayed

**Issue 2: Invalid Redirect URI**
- **Solution:** Ensure redirect URI in code exactly matches registered URI
- Check for trailing slashes, http vs https

**Issue 3: Invalid Client Credentials**
- **Solution:** Verify you're using Consumer Key (not Consumer Secret) as client_id
- Check for copy-paste errors (extra spaces, line breaks)

**Issue 4: Scope Errors**
- **Solution:** Ensure requested scopes match approved API access
- Request additional API access if needed

**Issue 5: CORS Errors**
- **Solution:** All OAuth calls must be server-to-server (backend)
- Never call Garmin OAuth endpoints directly from frontend

---

## 📞 Support Resources

### Garmin Developer Support

- **Developer Portal:** https://developer.garmin.com/
- **Support Email:** developersupport@garmin.com
- **Developer Forums:** https://forums.garmin.com/developer/
- **API Status:** Check for service outages

### Documentation

- **OAuth 2.0 Spec:** https://oauth.net/2/
- **PKCE Spec:** https://oauth.net/2/pkce/
- **Garmin API Docs:** https://developer.garmin.com/gc-developer-program/

---

## ✅ Completion Checklist

Before proceeding with implementation:

- [ ] Garmin Connect account created
- [ ] Developer program enrollment complete
- [ ] Application registered and approved
- [ ] Consumer Key (Client ID) obtained
- [ ] Consumer Secret obtained
- [ ] Redirect URIs configured
- [ ] Wellness API access approved
- [ ] Credentials added to `.env` file
- [ ] Master encryption key generated
- [ ] `.gitignore` configured correctly
- [ ] Test OAuth flow works
- [ ] Documentation reviewed

---

## 🚀 Next Steps

Once all prerequisites are complete:

1. Review [`GARMIN_OAUTH_IMPLEMENTATION_PLAN.md`](GARMIN_OAUTH_IMPLEMENTATION_PLAN.md:1)
2. Begin Phase 1: Database & Backend Core
3. Follow implementation checklist
4. Test each component thoroughly
5. Deploy to production

---

## 📝 Notes

### Development vs Production

**Development Setup:**
- Use `http://localhost:3000` for redirect URI
- Test with your personal Garmin account
- Use development credentials

**Production Setup:**
- Use `https://` for redirect URI
- Register production domain
- Use production credentials
- Implement proper secrets management

### API Limitations

- **Rate Limits:** Respect Garmin's rate limits
- **Data Retention:** Follow Garmin's data retention policies
- **User Privacy:** Comply with privacy requirements
- **Terms of Service:** Review and comply with Garmin's TOS

---

**Document Created By:** IBM Bob  
**Status:** 📋 Prerequisites Guide  
**Next Action:** Complete Garmin developer setup before implementation