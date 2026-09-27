# AADHAR Security Features Documentation

## 🔒 Overview

This document describes the enhanced security features implemented in AADHAR, including Forgot Password functionality and Google OAuth integration. All features are designed to maintain backward compatibility while significantly improving security and user experience.

---

## Table of Contents

1. [Forgot Password Flow](#forgot-password-flow)
2. [Google OAuth Authentication](#google-oauth-authentication)
3. [Security Enhancements](#security-enhancements)
4. [Configuration Guide](#configuration-guide)
5. [API Endpoints](#api-endpoints)
6. [Troubleshooting](#troubleshooting)

---

## Forgot Password Flow

### Overview

Users can securely reset their password if they forget it by receiving a time-limited reset link via email.

### Features

✅ **Secure Token Generation**: Cryptographically secure 64-character tokens  
✅ **Time-Limited Links**: Reset links expire after 1 hour  
✅ **Email Enumeration Protection**: Always shows success message to prevent email discovery  
✅ **One-Time Use Tokens**: Tokens can only be used once  
✅ **Automatic Cleanup**: Expired tokens are automatically deleted from database  
✅ **Rate Limiting**: 5 password reset requests per IP per hour  
✅ **CAPTCHA Protection**: reCAPTCHA verification on both request and reset forms  

### User Flow

1. **Request Reset**
   - User clicks "Forgot password?" link on login page
   - Enters their registered email address
   - Completes CAPTCHA verification
   - Receives confirmation message (regardless of email existence)

2. **Receive Email**
   - If email exists in system, user receives reset email
   - Email contains secure reset link valid for 1 hour
   - Link includes unique token

3. **Reset Password**
   - User clicks link in email
   - Enters new password (minimum 8 characters)
   - Confirms new password
   - Submits form

4. **Confirmation**
   - Password is updated securely (bcrypt hashed)
   - Token is marked as used
   - User is redirected to login with success message

### Security Considerations

**Email Enumeration Protection**: The system always displays a success message even if the email doesn't exist, preventing attackers from discovering valid email addresses.

**Token Security**:
- Tokens are 64 characters (256 bits of entropy)
- Stored in MongoDB with expiry timestamp
- Automatically deleted after use or expiry
- Cannot be reused

**Rate Limiting**:
- Maximum 5 password reset requests per hour per IP
- Prevents abuse and brute force attempts
- Custom error messages for rate limit exceeded

### Database Schema

```javascript
{
  userId: ObjectId,        // Reference to User
  token: String,           // Unique 64-char hex token
  expiresAt: Date,         // Expiry timestamp (1 hour)
  used: Boolean,           // Prevents token reuse
  createdAt: Date,         // Auto-generated
  updatedAt: Date          // Auto-generated
}
```

### Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/forgot-password` | Display password reset request form |
| POST | `/forgot-password` | Process reset request and send email |
| GET | `/reset-password?token=...` | Display new password form |
| POST | `/reset-password` | Update password with new value |

---

## Google OAuth Authentication

### Overview

Users can sign in or sign up using their Google account, providing a seamless and secure authentication experience.

### Features

✅ **One-Click Login**: Sign in with existing Google account  
✅ **Account Linking**: Automatically links Google account to existing email  
✅ **Profile Sync**: Imports name and profile picture from Google  
✅ **Secure Session Management**: Uses Passport.js with MongoDB session store  
✅ **Dual Authentication Support**: Works alongside existing email/password auth  
✅ **Rate Limiting**: 30 OAuth attempts per IP per 15 minutes  

### User Flow

1. **Initiate OAuth**
   - User clicks "Continue with Google" button
   - Redirected to Google account selector

2. **Google Authentication**
   - User selects or logs into Google account
   - Grants permission to AADHAR

3. **Account Handling**
   - **New User**: Creates new account with Google profile data (defaults to Donor role)
   - **Existing Email**: Links Google account to existing local account
   - **Existing Google User**: Logs in immediately

4. **Profile Completion**
   - If phone number is missing, user is redirected to profile page
   - User completes any required information
   - Redirected to appropriate dashboard

### Configuration Steps

#### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing project
3. Click "Create Credentials" → "OAuth 2.0 Client ID"
4. Configure OAuth consent screen:
   - User Type: External (for public access)
   - App Name: AADHAR
   - User support email: Your email
   - Developer contact: Your email
5. Create OAuth Client ID:
   - Application type: Web application
   - Name: AADHAR Web Client
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Client Secret

#### 2. Update Environment Variables

Add to `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Secret (required for OAuth)
SESSION_SECRET=your_secure_random_string_here
```

**For Production**:
- Update `GOOGLE_CALLBACK_URL` to production domain
- Add production domain to authorized redirect URIs in Google Console
- Use strong, random SESSION_SECRET (minimum 32 characters)

### User Model Updates

The User model now supports OAuth authentication:

```javascript
{
  // New fields for OAuth
  googleId: String,              // Google unique identifier (indexed)
  authProvider: String,          // 'local' or 'google'
  
  // Modified fields
  phone: String,                 // Optional for OAuth users initially
  passwordHash: String,          // Optional for OAuth users
  
  // Existing fields remain unchanged
  name, email, role, isActive, etc.
}
```

### Authentication Flow

**Dual Authentication Support**: The middleware checks JWT tokens first, then falls back to Passport sessions for OAuth users.

```javascript
// Authentication priority:
1. Check JWT cookie (existing email/password auth)
2. Check Passport session (Google OAuth)
3. Continue as guest if neither exists
```

### Session Management

- **Storage**: MongoDB (via connect-mongo)
- **Duration**: 24 hours
- **Security**: httpOnly cookies, secure in production
- **Cleanup**: Automatic session cleanup via MongoDB TTL

### Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Initiates Google OAuth flow |
| GET | `/auth/google/callback` | Handles Google OAuth callback |

---

## Security Enhancements

### Rate Limiting

Three types of rate limiters protect different endpoints:

#### 1. Auth Limiter
- **Applies to**: `/login`, `/signup`
- **Limit**: 20 requests per IP per 15 minutes
- **Purpose**: Prevents brute force login attempts

#### 2. Password Reset Limiter
- **Applies to**: `/forgot-password`, `/reset-password`
- **Limit**: 5 requests per IP per hour
- **Purpose**: Prevents password reset abuse

#### 3. OAuth Limiter
- **Applies to**: `/auth/google`, `/auth/google/callback`
- **Limit**: 30 requests per IP per 15 minutes
- **Purpose**: Prevents OAuth flow abuse

### Content Security Policy (CSP)

Updated Helmet.js configuration to allow Google OAuth domains:

```javascript
- https://accounts.google.com
- https://www.google.com
- https://www.gstatic.com
- https://*.googleusercontent.com
- https://*.ggpht.com
```

### Security Utilities

New `utils/security.js` provides:

- **Password Strength Checker**: Scores passwords 0-4, provides feedback
- **Email Validator**: Comprehensive email format validation
- **XSS Sanitization**: Basic input sanitization helpers
- **Timed Tokens**: Time-limited token generation and verification
- **Rate Limiter Class**: In-memory rate limiting for custom use cases

### Password Requirements

- Minimum 8 characters
- Recommended: Mix of uppercase, lowercase, numbers, special characters
- Common patterns detected and scored lower
- Real-time validation in browser

### Session Security

- **httpOnly cookies**: Prevents JavaScript access to auth tokens
- **Secure flag**: Enabled in production (HTTPS only)
- **SameSite**: Prevents CSRF attacks
- **Session rotation**: New session on login
- **Proper logout**: Clears both JWT and Passport sessions

---

## Configuration Guide

### Required Environment Variables

```env
# Database
MONGO_URI=mongodb://127.0.0.1:27017/aadhar_dev

# JWT Authentication
JWT_SECRET=your_secure_random_string_minimum_32_chars
SESSION_SECRET=another_secure_random_string_minimum_32_chars

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM="AADHAR Community Support <your_email@gmail.com>"

# Google OAuth (optional but recommended)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# reCAPTCHA (optional but recommended)
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### Generating Secure Secrets

Use Node.js crypto module:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### SMTP Configuration

#### Gmail Setup:
1. Enable 2-Factor Authentication on Google Account
2. Generate App Password: Account → Security → 2-Step Verification → App passwords
3. Use app password in `SMTP_PASS`

#### Other Providers:
- **SendGrid**: Use API key as password
- **Mailgun**: Use SMTP credentials
- **AWS SES**: Use SMTP credentials with IAM user

### Testing Configuration

Run the included test script:

```bash
node test-auth-features.js
```

This validates:
- Environment variables
- Password reset utilities
- Email configuration
- Security utilities
- User model updates
- Passport configuration
- Rate limiters
- Route loading

---

## API Endpoints

### Password Reset Endpoints

#### Request Password Reset

```http
POST /forgot-password
Content-Type: application/x-www-form-urlencoded

email=user@example.com
g-recaptcha-response=captcha_token
```

**Response** (200 OK - always):
```html
Success message displayed (prevents email enumeration)
```

#### Reset Password

```http
POST /reset-password
Content-Type: application/x-www-form-urlencoded

token=64_char_hex_token
newPassword=MyNewSecurePass123
confirmPassword=MyNewSecurePass123
```

**Response** (302 Redirect):
```
Location: /login?passwordReset=1
```

**Error Responses**:
- `400`: Invalid/expired token, passwords don't match, weak password
- `429`: Rate limit exceeded
- `500`: Server error

### Google OAuth Endpoints

#### Initiate OAuth

```http
GET /auth/google?returnTo=/donor/dashboard
```

Redirects to Google for authentication.

#### OAuth Callback

```http
GET /auth/google/callback?code=...&state=...
```

Automatically handled by Passport. Sets JWT cookie and redirects to dashboard.

---

## Troubleshooting

### Password Reset Issues

**Problem**: Reset email not received

**Solutions**:
1. Check spam/junk folder
2. Verify SMTP credentials in `.env`
3. Check server logs for email sending errors
4. Test SMTP connection manually
5. Ensure firewall allows outbound SMTP connections

**Problem**: "Link expired or invalid"

**Solutions**:
1. Request new reset link (links expire after 1 hour)
2. Check if link was already used (one-time use)
3. Verify token in URL is complete (no truncation)

**Problem**: "Too many password reset requests"

**Solution**:
- Wait 1 hour before trying again
- Rate limit is 5 requests per hour per IP
- Contact administrator if legitimate need

### Google OAuth Issues

**Problem**: "Google authentication failed"

**Solutions**:
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Check redirect URI matches exactly in Google Console
3. Ensure OAuth consent screen is published
4. Check browser console for CSP errors
5. Verify callback URL is accessible

**Problem**: "Redirect URI mismatch"

**Solutions**:
1. Check authorized redirect URIs in Google Console
2. Ensure exact match including protocol, domain, port, and path
3. Add both `http://localhost:3000/auth/google/callback` (dev) and production URL

**Problem**: OAuth works but user not logged in

**Solutions**:
1. Check `SESSION_SECRET` is set in `.env`
2. Verify MongoDB is running for session storage
3. Clear browser cookies and try again
4. Check server logs for session errors

### General Security Issues

**Problem**: Rate limit preventing legitimate users

**Solutions**:
1. Adjust rate limits in `middleware/rateLimiters.js`
2. Implement IP whitelist for trusted networks
3. Use Redis for distributed rate limiting in production

**Problem**: CAPTCHA not appearing

**Solutions**:
1. Set `RECAPTCHA_SITE_KEY` in `.env`
2. Check Content Security Policy allows Google reCAPTCHA
3. Verify reCAPTCHA domain is registered in Google Console

---

## Best Practices

### For Development

1. **Use different secrets** for each environment
2. **Don't commit `.env`** file to version control
3. **Test password reset flow** with real email address
4. **Verify rate limiting** doesn't block development
5. **Use HTTPS** even in development (self-signed cert OK)

### For Production

1. **Use strong, random secrets** (minimum 32 characters)
2. **Enable HTTPS** for all endpoints (required for secure cookies)
3. **Configure proper SMTP** service (not personal Gmail)
4. **Set up monitoring** for failed login attempts
5. **Regular security audits** using `npm audit`
6. **Implement Redis** for distributed rate limiting
7. **Enable logging** for authentication events
8. **Set up alerts** for suspicious activity
9. **Regular backup** of user database
10. **Keep dependencies updated** with security patches

### Security Checklist

- [ ] All secrets are strong and unique
- [ ] HTTPS enabled in production
- [ ] SMTP credentials are secure (app password, not account password)
- [ ] Google OAuth credentials are production-ready
- [ ] Rate limiters configured appropriately
- [ ] Error messages don't leak sensitive information
- [ ] Logs don't contain passwords or tokens
- [ ] Database has proper indexes for performance
- [ ] Session store is persistent (MongoDB, not memory)
- [ ] CAPTCHA is enabled on all auth forms
- [ ] CSP headers configured correctly
- [ ] Password requirements are enforced
- [ ] Failed login attempts are monitored
- [ ] Regular security audits scheduled

---

## Migration Notes

### Existing Users

**No action required**. Existing email/password authentication continues to work exactly as before.

**Optional**: Users can link their Google account by:
1. Log in with email/password
2. Log out
3. Click "Continue with Google" with same email
4. Google account is automatically linked

### Database Migration

**Automatic**: New fields (`googleId`, `authProvider`) are added automatically. No manual migration needed.

**Indexes**: Run this command once after deployment:

```javascript
db.users.createIndex({ googleId: 1 }, { sparse: true, unique: true });
db.passwordresets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 7200 });
```

### Backward Compatibility

✅ All existing routes work unchanged  
✅ Existing authentication flow preserved  
✅ JWT tokens remain valid  
✅ No breaking changes to User model  
✅ Existing dashboards and features work normally  

---

## Support and Maintenance

### Monitoring

Key metrics to monitor:
- Failed login attempts by IP
- Password reset request rate
- OAuth authentication failures
- Session creation/destruction rate
- Database query performance
- Email delivery success rate

### Logs

Important log messages:
- `[auth] Password reset email sent to <email>`
- `[passport] Google OAuth strategy configured`
- `[google-auth] User logged in via Google: <email>`
- `[email] Password reset email sent successfully`
- `[auth] Password successfully reset for user: <email>`

### Maintenance Tasks

**Weekly**:
- Review failed authentication logs
- Check rate limiter effectiveness
- Monitor email delivery rates

**Monthly**:
- Update dependencies (`npm audit fix`)
- Review and rotate secrets if needed
- Clean up old sessions manually if needed

**Quarterly**:
- Security audit of authentication flow
- Review and update rate limiting rules
- Test disaster recovery procedures

---

## Version History

### Version 2.0.0 (Current)

**Added**:
- Forgot Password flow with email verification
- Google OAuth "Continue with Google" authentication
- Enhanced rate limiting (3 types)
- Security utility functions
- Dual authentication support (JWT + Session)
- Improved CSP headers
- Password strength validation
- Email enumeration protection

**Security Improvements**:
- Time-limited password reset tokens
- One-time use token enforcement
- Automatic token cleanup
- OAuth session security
- Enhanced logout (clears both JWT and sessions)

**Backward Compatible**: Yes, all existing features work unchanged

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Express Rate Limit](https://github.com/nfriedly/express-rate-limit)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## Contact

For security issues or questions:
- Review this documentation
- Run `node test-auth-features.js` to diagnose issues
- Check server logs for error messages
- Consult troubleshooting section above

**Security Vulnerabilities**: Report privately to maintainers, do not create public issues.

---

*Last Updated: 2026*
*AADHAR — The Soul Serves*
