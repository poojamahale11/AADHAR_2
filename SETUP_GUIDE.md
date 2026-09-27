# AADHAR Enhanced Authentication - Quick Setup Guide

## 🚀 Quick Start (5 Minutes)

This guide will help you set up the new Forgot Password and Google OAuth features.

---

## Prerequisites

- ✅ Node.js v18+ installed
- ✅ MongoDB running locally or remotely
- ✅ Gmail account for SMTP (or other email service)
- ✅ Google account for OAuth setup (optional)

---

## Step 1: Update Environment Variables

Open your `.env` file and add/update these values:

### Essential (Required for Password Reset)

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=paste_generated_secret_here
SESSION_SECRET=paste_another_generated_secret_here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM="AADHAR Support <your_email@gmail.com>"
```

### Optional (For Google OAuth)

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

---

## Step 2: Generate Secure Secrets

Run these commands and paste the output into your `.env`:

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3: Set Up Gmail SMTP

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Create new app password:
   - Select "Mail" and "Other (Custom name)"
   - Name it "AADHAR"
   - Copy the 16-character password
5. Paste into `.env` as `SMTP_PASS` (remove spaces)

---

## Step 4: Set Up Google OAuth (Optional)

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Navigate to **APIs & Services** → **Credentials**

### Configure OAuth Consent Screen

1. Click **OAuth consent screen**
2. Choose **External** user type
3. Fill in:
   - App name: `AADHAR`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue** (skip scopes and test users)

### Create OAuth Client ID

1. Click **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `AADHAR Web Client`
4. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   ```
5. **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/google/callback
   ```
6. Click **Create**
7. Copy **Client ID** and **Client Secret**
8. Paste into `.env`

---

## Step 5: Install Dependencies

Dependencies are already installed, but to verify:

```bash
npm install
```

---

## Step 6: Test Configuration

Run the test script to verify everything is set up correctly:

```bash
node test-auth-features.js
```

Expected output:
```
✓ Configured: MONGO_URI, JWT_SECRET, SESSION_SECRET, SMTP_HOST, SMTP_USER, SMTP_PASS
✓ Google OAuth credentials configured (if you set them up)
✓ Password reset token generation works
✓ Email sending configured
✓ All security utilities loaded
```

---

## Step 7: Start the Server

```bash
npm start
```

Server will start at: `http://localhost:3000`

---

## Step 8: Test Features

### Test Forgot Password

1. Open `http://localhost:3000/login`
2. Click **"Forgot password?"** link
3. Enter a registered email address
4. Check your email for reset link
5. Click link and set new password
6. Log in with new password

### Test Google OAuth (if configured)

1. Open `http://localhost:3000/login`
2. Click **"Continue with Google"** button
3. Select your Google account
4. Grant permissions
5. Complete profile if needed (add phone number)
6. Verify you're logged in

### Test Existing Login

1. Open `http://localhost:3000/login`
2. Enter email and password
3. Complete CAPTCHA
4. Click **"Log in"**
5. Verify existing functionality works

---

## Troubleshooting

### "Email not sent"

**Check**:
- SMTP credentials in `.env` are correct
- App password (not regular password) is used
- No spaces in app password
- Gmail 2FA is enabled

**Test manually**:
```bash
node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'your_email@gmail.com', pass: 'your_app_password' }
});
transport.verify().then(() => console.log('✓ SMTP works!'))
  .catch(err => console.log('✗ SMTP error:', err.message));
"
```

### "Google auth failed"

**Check**:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Redirect URI matches exactly: `http://localhost:3000/auth/google/callback`
- OAuth consent screen is configured
- No extra spaces in credentials

### "MongoDB connection failed"

**Start MongoDB**:
```bash
# Windows (if installed as service)
net start MongoDB

# Mac (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### "Rate limit exceeded"

**Wait and retry**:
- Password reset: Wait 1 hour
- Login: Wait 15 minutes
- OAuth: Wait 15 minutes

Or temporarily increase limits in `middleware/rateLimiters.js`

---

## Production Deployment

### Update Environment Variables

```env
# Use production values
NODE_ENV=production
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Use production email service
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

### Update Google OAuth

1. Add production domain to authorized origins
2. Add production callback URL
3. Publish OAuth consent screen

### Security Checklist

- [ ] HTTPS enabled
- [ ] Strong secrets in production `.env`
- [ ] Production email service configured
- [ ] Google OAuth production URLs added
- [ ] Rate limits reviewed
- [ ] MongoDB backups scheduled
- [ ] Monitoring set up

---

## File Structure

```
Aadhar/
├── config/
│   └── passport.js              # Google OAuth configuration
├── controllers/
│   └── authController.js        # Password reset + OAuth controllers
├── middleware/
│   ├── auth.js                  # JWT + Session authentication
│   └── rateLimiters.js          # Rate limiting rules
├── models/
│   ├── User.js                  # Updated with OAuth fields
│   └── PasswordReset.js         # Password reset tokens
├── routes/
│   ├── authRoutes.js            # Password reset routes
│   └── googleAuthRoutes.js      # OAuth routes
├── utils/
│   ├── email.js                 # Email sending (password reset)
│   ├── passwordReset.js         # Token generation/validation
│   └── security.js              # Security utilities
├── views/
│   └── auth/
│       ├── forgot-password.ejs  # Request reset form
│       ├── reset-password.ejs   # New password form
│       ├── login.ejs            # Updated with OAuth button
│       └── signup.ejs           # Updated with OAuth button
├── .env                         # Environment configuration
├── test-auth-features.js        # Test script
└── SECURITY_FEATURES.md         # Full documentation
```

---

## Next Steps

1. ✅ **Test all features** in development
2. ✅ **Review security documentation** in `SECURITY_FEATURES.md`
3. ✅ **Set up monitoring** for production
4. ✅ **Configure backups** for MongoDB
5. ✅ **Plan production deployment**

---

## Getting Help

1. **Read full documentation**: `SECURITY_FEATURES.md`
2. **Run test script**: `node test-auth-features.js`
3. **Check server logs** for detailed errors
4. **Review troubleshooting** section above

---

## Summary

✅ **Forgot Password**: Users can reset passwords via email  
✅ **Google OAuth**: One-click sign in with Google  
✅ **Enhanced Security**: Rate limiting, token management, dual auth  
✅ **Backward Compatible**: Existing login/signup unchanged  
✅ **Production Ready**: Tested and documented  

**Setup Time**: 5-10 minutes  
**Testing Time**: 5 minutes  
**Total Time**: ~15 minutes  

---

*AADHAR — The Soul Serves*
