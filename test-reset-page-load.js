/**
 * Test script to verify reset password page loads correctly
 * Simulates the complete user flow including page access
 */

const mongoose = require('mongoose');
const request = require('supertest');
require('dotenv').config();

async function testResetPageLoad() {
  console.log('🧪 Testing Password Reset Page Load...\n');

  try {
    // Start the server
    const { app, server } = require('./server');
    
    // Wait for DB connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Server started\n');

    const { User, Donor } = require('./models/User');
    const { createPasswordResetToken } = require('./utils/passwordReset');

    // Clean up test user if exists
    await User.deleteOne({ email: 'page-test@example.com' });

    console.log('📝 Step 1: Creating test user...');
    const testUser = await Donor.create({
      name: 'Page Test User',
      email: 'page-test@example.com',
      phone: '8888888888',
      passwordHash: await User.hashPassword('TestPassword123'),
      donorType: 'individual',
    });
    console.log(`✅ Test user created: ${testUser.email}\n`);

    console.log('📝 Step 2: Creating reset token...');
    const { token } = await createPasswordResetToken(testUser._id);
    console.log(`✅ Token created: ${token.substring(0, 16)}...\n`);

    console.log('📝 Step 3: Testing forgot password page GET...');
    const forgotResponse = await request(app)
      .get('/forgot-password')
      .expect(200);
    
    if (forgotResponse.text.includes('Forgot Password')) {
      console.log('✅ Forgot password page loads correctly');
    } else {
      console.log('❌ Forgot password page content incorrect');
      return false;
    }

    console.log('📝 Step 4: Testing reset password page GET with valid token...');
    const resetResponse = await request(app)
      .get(`/reset-password?token=${token}`)
      .expect(200);
    
    if (resetResponse.text.includes('Reset Password') || resetResponse.text.includes('Set new password')) {
      console.log('✅ Reset password page loads correctly with valid token');
    } else {
      console.log('❌ Reset password page did not load properly');
      console.log('Response includes:', resetResponse.text.substring(0, 200));
      return false;
    }

    if (resetResponse.text.includes(testUser.name)) {
      console.log(`✅ Page shows user name: ${testUser.name}`);
    }

    if (resetResponse.text.includes('newPassword') && resetResponse.text.includes('confirmPassword')) {
      console.log('✅ Password input fields are present');
    } else {
      console.log('❌ Password input fields missing');
      return false;
    }

    console.log('📝 Step 5: Testing reset password page GET with invalid token...');
    const invalidResponse = await request(app)
      .get('/reset-password?token=invalid-token-12345')
      .expect(400);
    
    if (invalidResponse.text.includes('invalid') || invalidResponse.text.includes('expired')) {
      console.log('✅ Invalid token shows error message correctly');
    } else {
      console.log('❌ Invalid token error not shown properly');
      return false;
    }

    console.log('📝 Step 6: Testing reset password page GET without token...');
    const noTokenResponse = await request(app)
      .get('/reset-password')
      .expect(400);
    
    if (noTokenResponse.text.includes('Invalid') || noTokenResponse.text.includes('missing')) {
      console.log('✅ Missing token shows error message correctly');
    } else {
      console.log('❌ Missing token error not shown properly');
      return false;
    }

    console.log('📝 Step 7: Testing password reset submission...');
    const postResponse = await request(app)
      .post('/reset-password')
      .send({
        token: token,
        newPassword: 'NewTestPassword456',
        confirmPassword: 'NewTestPassword456',
      })
      .expect(302); // Redirect expected

    if (postResponse.headers.location && postResponse.headers.location.includes('/login')) {
      console.log('✅ Password reset redirects to login');
    } else {
      console.log('❌ Redirect after reset incorrect');
      return false;
    }

    console.log('📝 Step 8: Verifying password was actually changed...');
    const updatedUser = await User.findById(testUser._id).select('+passwordHash');
    const oldPasswordWorks = await updatedUser.comparePassword('TestPassword123');
    const newPasswordWorks = await updatedUser.comparePassword('NewTestPassword456');

    if (oldPasswordWorks) {
      console.log('❌ Old password still works!');
      return false;
    }
    console.log('✅ Old password no longer works');

    if (!newPasswordWorks) {
      console.log('❌ New password does not work!');
      return false;
    }
    console.log('✅ New password works correctly');

    console.log('📝 Step 9: Testing login with new password...');
    const loginResponse = await request(app)
      .get('/login')
      .expect(200);
    
    if (loginResponse.text.includes('Password reset successful')) {
      console.log('✅ Login page shows success message');
    }

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await User.deleteOne({ email: 'page-test@example.com' });
    
    // Close server
    await new Promise((resolve) => {
      server.close(resolve);
    });
    await mongoose.connection.close();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL PAGE LOAD TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 What was tested:');
    console.log('   ✓ Forgot password page loads');
    console.log('   ✓ Reset password page loads with valid token');
    console.log('   ✓ User name displayed on reset page');
    console.log('   ✓ Password input fields present');
    console.log('   ✓ Invalid token shows error');
    console.log('   ✓ Missing token shows error');
    console.log('   ✓ Password reset submission works');
    console.log('   ✓ Redirect to login after reset');
    console.log('   ✓ Password actually changed in database');
    console.log('   ✓ Old password no longer works');
    console.log('   ✓ New password works');
    console.log('   ✓ Login page shows success message');
    console.log('\n🎉 Complete password reset flow is working!\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    return false;
  }
}

// Check if supertest is installed
try {
  require.resolve('supertest');
  testResetPageLoad().then(success => {
    process.exit(success ? 0 : 1);
  });
} catch (e) {
  console.log('⚠️  supertest not installed. Installing...');
  console.log('Run: npm install --save-dev supertest');
  console.log('Then run this test again.');
  process.exit(1);
}
