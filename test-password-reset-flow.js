/**
 * Test script for Password Reset Flow
 * Tests the complete flow: Email → Reset Link → New Password → Login
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testPasswordResetFlow() {
  console.log('🧪 Testing Password Reset Flow...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aadhar');
    console.log('✅ Connected to database\n');

    const { User, Donor } = require('./models/User');
    const PasswordReset = require('./models/PasswordReset');
    const { createPasswordResetToken, verifyResetToken } = require('./utils/passwordReset');

    // Clean up test user if exists
    await User.deleteOne({ email: 'test-reset@example.com' });
    await PasswordReset.deleteMany({ });

    console.log('📝 Step 1: Creating test user...');
    const testUser = await Donor.create({
      name: 'Test Reset User',
      email: 'test-reset@example.com',
      phone: '9999999999',
      passwordHash: await User.hashPassword('OldPassword123'),
      donorType: 'individual',
    });
    console.log(`✅ Test user created: ${testUser.email}\n`);

    console.log('📝 Step 2: Generating reset token...');
    const { token, expiresAt } = await createPasswordResetToken(testUser._id);
    console.log(`✅ Reset token generated: ${token.substring(0, 16)}...`);
    console.log(`✅ Expires at: ${expiresAt}\n`);

    console.log('📝 Step 3: Verifying reset token...');
    const resetDoc = await verifyResetToken(token);
    if (!resetDoc) {
      console.log('❌ Token verification failed!');
      return false;
    }
    console.log('✅ Token verified successfully');
    console.log(`   User: ${resetDoc.userId.name}`);
    console.log(`   Email: ${resetDoc.userId.email}\n`);

    console.log('📝 Step 4: Simulating password reset...');
    const newPassword = 'NewPassword456';
    
    // Update password (simulating POST /reset-password)
    const userToUpdate = await User.findById(resetDoc.userId._id).select('+passwordHash');
    userToUpdate.passwordHash = await User.hashPassword(newPassword);
    await userToUpdate.save();
    
    // Mark token as used
    await resetDoc.markAsUsed();
    console.log('✅ Password updated and token marked as used\n');

    console.log('📝 Step 5: Testing old password (should fail)...');
    const userCheck1 = await User.findById(testUser._id).select('+passwordHash');
    const oldPasswordWorks = await userCheck1.comparePassword('OldPassword123');
    if (oldPasswordWorks) {
      console.log('❌ Old password still works! Password was not updated properly.');
      return false;
    }
    console.log('✅ Old password rejected (as expected)\n');

    console.log('📝 Step 6: Testing new password (should work)...');
    const userCheck2 = await User.findById(testUser._id).select('+passwordHash');
    const newPasswordWorks = await userCheck2.comparePassword('NewPassword456');
    if (!newPasswordWorks) {
      console.log('❌ New password does not work! Password was not saved correctly.');
      return false;
    }
    console.log('✅ New password works correctly\n');

    console.log('📝 Step 7: Testing token reuse (should fail)...');
    const reusedToken = await verifyResetToken(token);
    if (reusedToken) {
      console.log('❌ Token can be reused! Token was not marked as used properly.');
      return false;
    }
    console.log('✅ Token cannot be reused (as expected)\n');

    console.log('📝 Step 8: Testing expired token...');
    // Create an expired token
    const expiredTokenData = await PasswordReset.create({
      userId: testUser._id,
      token: 'expired-token-12345',
      expiresAt: new Date(Date.now() - 1000), // Already expired
      used: false,
    });
    const expiredTokenCheck = await verifyResetToken('expired-token-12345');
    if (expiredTokenCheck) {
      console.log('❌ Expired token was accepted! Token expiry check not working.');
      return false;
    }
    console.log('✅ Expired token rejected (as expected)\n');

    console.log('📝 Step 9: Testing invalid token...');
    const invalidTokenCheck = await verifyResetToken('invalid-random-token-xyz');
    if (invalidTokenCheck) {
      console.log('❌ Invalid token was accepted!');
      return false;
    }
    console.log('✅ Invalid token rejected (as expected)\n');

    console.log('📝 Step 10: Testing multiple reset requests...');
    const { token: token1 } = await createPasswordResetToken(testUser._id);
    console.log('   First token created');
    
    const { token: token2 } = await createPasswordResetToken(testUser._id);
    console.log('   Second token created (should invalidate first)\n');
    
    const firstTokenCheck = await verifyResetToken(token1);
    if (firstTokenCheck) {
      console.log('❌ First token still valid after second request!');
      return false;
    }
    console.log('✅ First token invalidated');
    
    const secondTokenCheck = await verifyResetToken(token2);
    if (!secondTokenCheck) {
      console.log('❌ Second token not valid!');
      return false;
    }
    console.log('✅ Second token is valid\n');

    // Clean up
    console.log('🧹 Cleaning up test data...');
    await User.deleteOne({ email: 'test-reset@example.com' });
    await PasswordReset.deleteMany({ userId: testUser._id });
    console.log('✅ Test data cleaned up\n');

    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('=' .repeat(60));
    console.log('\n📋 Password Reset Flow Summary:');
    console.log('   ✓ Reset token generation works');
    console.log('   ✓ Token verification works');
    console.log('   ✓ Password update works');
    console.log('   ✓ Old password is rejected');
    console.log('   ✓ New password is accepted');
    console.log('   ✓ Used tokens cannot be reused');
    console.log('   ✓ Expired tokens are rejected');
    console.log('   ✓ Invalid tokens are rejected');
    console.log('   ✓ Multiple requests invalidate previous tokens');
    console.log('\n🎉 Password reset functionality is working correctly!\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    return false;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testPasswordResetFlow().then(success => {
  process.exit(success ? 0 : 1);
});
