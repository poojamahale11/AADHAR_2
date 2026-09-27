/**
 * Diagnostic Script for Password Reset Issue
 * This will help identify what's not working
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function diagnoseResetIssue() {
  console.log('🔍 DIAGNOSING PASSWORD RESET ISSUE\n');
  console.log('=' .repeat(70));

  const issues = [];
  const warnings = [];

  // Test 1: Check if required files exist
  console.log('\n📁 Test 1: Checking if required files exist...');
  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'routes/authRoutes.js',
    'controllers/authController.js',
    'models/PasswordReset.js',
    'utils/passwordReset.js',
    'utils/email.js',
    'views/auth/forgot-password.ejs',
    'views/auth/reset-password.ejs',
    'views/auth/login.ejs'
  ];

  requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    if (exists) {
      console.log(`   ✓ ${file}`);
    } else {
      console.log(`   ✗ ${file} MISSING!`);
      issues.push(`File missing: ${file}`);
    }
  });

  // Test 2: Check database connection
  console.log('\n🗄️  Test 2: Checking database connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aadhar');
    console.log('   ✓ Database connected');
  } catch (err) {
    console.log(`   ✗ Database connection failed: ${err.message}`);
    issues.push(`Database connection error: ${err.message}`);
  }

  // Test 3: Check if models load
  console.log('\n📦 Test 3: Checking if models load correctly...');
  try {
    const { User, Donor } = require('./models/User');
    const PasswordReset = require('./models/PasswordReset');
    console.log('   ✓ User model loaded');
    console.log('   ✓ PasswordReset model loaded');
  } catch (err) {
    console.log(`   ✗ Model loading failed: ${err.message}`);
    issues.push(`Model error: ${err.message}`);
  }

  // Test 4: Check if utilities load
  console.log('\n🛠️  Test 4: Checking if utilities load correctly...');
  try {
    const { createPasswordResetToken, verifyResetToken } = require('./utils/passwordReset');
    const { sendPasswordResetEmail } = require('./utils/email');
    console.log('   ✓ passwordReset utility loaded');
    console.log('   ✓ email utility loaded');
    console.log('   ✓ createPasswordResetToken function exists');
    console.log('   ✓ verifyResetToken function exists');
    console.log('   ✓ sendPasswordResetEmail function exists');
  } catch (err) {
    console.log(`   ✗ Utility loading failed: ${err.message}`);
    issues.push(`Utility error: ${err.message}`);
  }

  // Test 5: Check if controller functions exist
  console.log('\n🎮 Test 5: Checking if controller functions exist...');
  try {
    const authController = require('./controllers/authController');
    const requiredMethods = [
      'getForgotPassword',
      'postForgotPassword',
      'getResetPassword',
      'postResetPassword'
    ];
    
    requiredMethods.forEach(method => {
      if (typeof authController[method] === 'function') {
        console.log(`   ✓ authController.${method} exists`);
      } else {
        console.log(`   ✗ authController.${method} MISSING!`);
        issues.push(`Controller method missing: ${method}`);
      }
    });
  } catch (err) {
    console.log(`   ✗ Controller loading failed: ${err.message}`);
    issues.push(`Controller error: ${err.message}`);
  }

  // Test 6: Check routes file
  console.log('\n🛣️  Test 6: Checking routes configuration...');
  try {
    const routesContent = fs.readFileSync(path.join(__dirname, 'routes/authRoutes.js'), 'utf8');
    
    const routes = [
      { path: '/forgot-password', method: 'GET' },
      { path: '/forgot-password', method: 'POST' },
      { path: '/reset-password', method: 'GET' },
      { path: '/reset-password', method: 'POST' }
    ];

    routes.forEach(route => {
      const pattern = new RegExp(`router\\.${route.method.toLowerCase()}\\(['"]${route.path.replace('/', '\\/')}['"]`);
      if (pattern.test(routesContent)) {
        console.log(`   ✓ ${route.method} ${route.path} route configured`);
      } else {
        console.log(`   ✗ ${route.method} ${route.path} route MISSING!`);
        issues.push(`Route missing: ${route.method} ${route.path}`);
      }
    });
  } catch (err) {
    console.log(`   ✗ Routes check failed: ${err.message}`);
    issues.push(`Routes error: ${err.message}`);
  }

  // Test 7: Check environment variables
  console.log('\n⚙️  Test 7: Checking environment variables...');
  const requiredEnv = ['MONGODB_URI', 'COOKIE_SECRET'];
  const optionalEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

  requiredEnv.forEach(env => {
    if (process.env[env]) {
      console.log(`   ✓ ${env} is set`);
    } else {
      console.log(`   ✗ ${env} is MISSING!`);
      issues.push(`Environment variable missing: ${env}`);
    }
  });

  optionalEnv.forEach(env => {
    if (process.env[env]) {
      console.log(`   ✓ ${env} is set (optional)`);
    } else {
      console.log(`   ⚠ ${env} is not set (optional - reset URLs will log to console)`);
      warnings.push(`${env} not configured - emails won't be sent`);
    }
  });

  // Test 8: Test token generation
  console.log('\n🔐 Test 8: Testing token generation...');
  try {
    const { User, Donor } = require('./models/User');
    const { createPasswordResetToken, verifyResetToken } = require('./utils/passwordReset');

    // Create temporary test user
    await User.deleteOne({ email: 'diagnostic@test.com' });
    const testUser = await Donor.create({
      name: 'Diagnostic Test',
      email: 'diagnostic@test.com',
      phone: '5555555555',
      passwordHash: await User.hashPassword('TestPass123'),
      donorType: 'individual',
    });

    // Generate token
    const { token, expiresAt } = await createPasswordResetToken(testUser._id);
    console.log(`   ✓ Token generated: ${token.substring(0, 20)}...`);
    console.log(`   ✓ Token length: ${token.length} characters`);
    console.log(`   ✓ Expires: ${expiresAt}`);

    // Verify token
    const resetDoc = await verifyResetToken(token);
    if (resetDoc) {
      console.log(`   ✓ Token verified successfully`);
      console.log(`   ✓ User found: ${resetDoc.userId.email}`);
    } else {
      console.log(`   ✗ Token verification failed!`);
      issues.push('Token verification not working');
    }

    // Cleanup
    await User.deleteOne({ email: 'diagnostic@test.com' });
    console.log(`   ✓ Test cleanup completed`);

  } catch (err) {
    console.log(`   ✗ Token generation test failed: ${err.message}`);
    issues.push(`Token generation error: ${err.message}`);
  }

  // Final Report
  console.log('\n' + '=' .repeat(70));
  console.log('📊 DIAGNOSTIC REPORT');
  console.log('=' .repeat(70));

  if (issues.length === 0) {
    console.log('\n✅ NO CRITICAL ISSUES FOUND!');
    console.log('\nThe password reset system should be working correctly.');
    console.log('\n💡 If the page still doesn\'t load, the issue might be:');
    console.log('   1. Server not running - Start with: npm start');
    console.log('   2. Wrong URL - Use: http://localhost:3000/reset-password?token=...');
    console.log('   3. Browser cache - Try incognito/private mode');
    console.log('   4. Port conflict - Check if port 3000 is in use');
  } else {
    console.log('\n❌ CRITICAL ISSUES FOUND:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }

  console.log('\n' + '=' .repeat(70));

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }

  console.log('\n✅ Diagnosis complete!');
  console.log('\n📝 Next steps:');
  if (issues.length === 0) {
    console.log('   1. Start server: npm start');
    console.log('   2. Run: node test-real-reset-flow.js');
    console.log('   3. Open the URL shown in browser');
    console.log('   4. Test password reset');
  } else {
    console.log('   1. Fix the issues listed above');
    console.log('   2. Run this diagnostic again');
    console.log('   3. Then test password reset');
  }
  console.log('');

  process.exit(issues.length === 0 ? 0 : 1);
}

diagnoseResetIssue().catch(err => {
  console.error('\n❌ Diagnostic failed:', err);
  process.exit(1);
});
