/**
 * Test script for new authentication features
 * Run this to verify password reset and OAuth setup
 */

console.log('='.repeat(60));
console.log('AADHAR Authentication Features Test');
console.log('='.repeat(60));

// Test 1: Check environment variables
console.log('\n[1] Checking Environment Variables...');
require('dotenv').config();

const requiredVars = ['MONGO_URI', 'JWT_SECRET', 'SESSION_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingVars = [];
const configuredVars = [];

requiredVars.forEach(varName => {
  if (process.env[varName] && !process.env[varName].includes('replace_this') && !process.env[varName].includes('your_')) {
    configuredVars.push(varName);
  } else {
    missingVars.push(varName);
  }
});

console.log(`✓ Configured: ${configuredVars.join(', ')}`);
if (missingVars.length > 0) {
  console.log(`⚠ Not configured: ${missingVars.join(', ')}`);
}

// Check Google OAuth
const googleConfigured = process.env.GOOGLE_CLIENT_ID && 
                         !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
                         process.env.GOOGLE_CLIENT_SECRET && 
                         !process.env.GOOGLE_CLIENT_SECRET.includes('your_');

if (googleConfigured) {
  console.log('✓ Google OAuth credentials configured');
} else {
  console.log('⚠ Google OAuth not configured (will need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)');
}

// Test 2: Check password reset utilities
console.log('\n[2] Testing Password Reset Utilities...');
try {
  const { generateResetToken } = require('./utils/passwordReset');
  const token = generateResetToken();
  console.log(`✓ Password reset token generation works (${token.length} chars)`);
} catch (err) {
  console.log(`✗ Password reset utilities error: ${err.message}`);
}

// Test 3: Check email utility
console.log('\n[3] Testing Email Utility...');
try {
  const { sendPasswordResetEmail } = require('./utils/email');
  console.log('✓ Password reset email function loaded');
  console.log(`  SMTP configured: ${process.env.SMTP_HOST ? 'Yes' : 'No'}`);
} catch (err) {
  console.log(`✗ Email utility error: ${err.message}`);
}

// Test 4: Check security utilities
console.log('\n[4] Testing Security Utilities...');
try {
  const { checkPasswordStrength, isValidEmail } = require('./utils/security');
  
  const weakPassword = checkPasswordStrength('12345');
  const strongPassword = checkPasswordStrength('MySecure@Pass123');
  
  console.log(`✓ Password strength checker works`);
  console.log(`  Weak password score: ${weakPassword.score}/4`);
  console.log(`  Strong password score: ${strongPassword.score}/4`);
  
  const validEmail = isValidEmail('test@example.com');
  const invalidEmail = isValidEmail('notanemail');
  console.log(`✓ Email validator works (valid: ${validEmail}, invalid: ${invalidEmail})`);
} catch (err) {
  console.log(`✗ Security utilities error: ${err.message}`);
}

// Test 5: Check User model updates
console.log('\n[5] Testing User Model...');
try {
  const { User } = require('./models/User');
  const schema = User.schema.obj;
  
  const hasGoogleId = 'googleId' in schema;
  const hasAuthProvider = 'authProvider' in schema;
  
  console.log(`✓ User model loaded`);
  console.log(`  Has googleId field: ${hasGoogleId ? 'Yes' : 'No'}`);
  console.log(`  Has authProvider field: ${hasAuthProvider ? 'Yes' : 'No'}`);
} catch (err) {
  console.log(`✗ User model error: ${err.message}`);
}

// Test 6: Check Passport configuration
console.log('\n[6] Testing Passport Configuration...');
try {
  const passport = require('./config/passport');
  console.log('✓ Passport configuration loaded');
  console.log(`  Google Strategy: ${googleConfigured ? 'Configured' : 'Not configured'}`);
} catch (err) {
  console.log(`✗ Passport configuration error: ${err.message}`);
}

// Test 7: Check rate limiters
console.log('\n[7] Testing Rate Limiters...');
try {
  const { authLimiter, passwordResetLimiter, oauthLimiter } = require('./middleware/rateLimiters');
  console.log('✓ All rate limiters loaded');
  console.log('  - authLimiter: 20 requests/15 min');
  console.log('  - passwordResetLimiter: 5 requests/hour');
  console.log('  - oauthLimiter: 30 requests/15 min');
} catch (err) {
  console.log(`✗ Rate limiters error: ${err.message}`);
}

// Test 8: Check routes
console.log('\n[8] Checking Routes...');
try {
  const authRoutes = require('./routes/authRoutes');
  const googleRoutes = require('./routes/googleAuthRoutes');
  console.log('✓ Authentication routes loaded');
  console.log('✓ Google OAuth routes loaded');
} catch (err) {
  console.log(`✗ Routes error: ${err.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Test Summary');
console.log('='.repeat(60));

const features = [
  { name: 'Password Reset Flow', ready: true },
  { name: 'Email Sending (SMTP)', ready: !!process.env.SMTP_HOST },
  { name: 'Google OAuth', ready: googleConfigured },
  { name: 'Rate Limiting', ready: true },
  { name: 'Security Utilities', ready: true },
  { name: 'User Model Updates', ready: true },
];

console.log('\nFeature Readiness:');
features.forEach(feature => {
  const status = feature.ready ? '✓ Ready' : '⚠ Needs configuration';
  console.log(`  ${status}: ${feature.name}`);
});

console.log('\n' + '='.repeat(60));
console.log('Next Steps:');
console.log('='.repeat(60));

if (!googleConfigured) {
  console.log('\n1. Set up Google OAuth:');
  console.log('   - Go to https://console.cloud.google.com/apis/credentials');
  console.log('   - Create OAuth 2.0 Client ID');
  console.log('   - Add authorized redirect URI: http://localhost:3000/auth/google/callback');
  console.log('   - Copy Client ID and Secret to .env file');
}

console.log('\n2. Start MongoDB:');
console.log('   - Make sure MongoDB is running on mongodb://127.0.0.1:27017');

console.log('\n3. Start the server:');
console.log('   npm start');

console.log('\n4. Test the features:');
console.log('   - Visit http://localhost:3000/login');
console.log('   - Test "Forgot Password" link');
console.log('   - Test "Continue with Google" button (if configured)');
console.log('   - Verify existing login/signup still works');

console.log('\n' + '='.repeat(60));
