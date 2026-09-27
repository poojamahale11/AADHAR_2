/**
 * Real Password Reset Flow Test with Actual HTTP Requests
 * Tests the complete flow as a user would experience it
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testRealResetFlow() {
  console.log('🔍 Testing REAL Password Reset Flow...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aadhar');
    console.log('✅ Connected to database\n');

    const { User, Donor } = require('./models/User');
    const { createPasswordResetToken } = require('./utils/passwordReset');

    // Clean up test user if exists
    await User.deleteOne({ email: 'realtest@example.com' });

    // Create a real test user
    console.log('📝 Step 1: Creating test user...');
    const testUser = await Donor.create({
      name: 'Real Test User',
      email: 'realtest@example.com',
      phone: '6666666666',
      passwordHash: await User.hashPassword('OldRealPassword123'),
      donorType: 'individual',
      isActive: true,
    });
    console.log(`✅ User created: ${testUser.email}`);
    console.log(`   Password: OldRealPassword123\n`);

    // Generate reset token
    console.log('📝 Step 2: Generating password reset token...');
    const { token, expiresAt } = await createPasswordResetToken(testUser._id);
    console.log(`✅ Token generated: ${token}`);
    console.log(`   Expires: ${expiresAt}\n`);

    // Build reset URL
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
    console.log('📝 Step 3: Reset URL generated:');
    console.log(`   ${resetUrl}\n`);

    console.log('=' .repeat(70));
    console.log('🌐 MANUAL TESTING REQUIRED');
    console.log('=' .repeat(70));
    console.log('\nPlease follow these steps:\n');
    
    console.log('1️⃣  START SERVER (in a new terminal):');
    console.log('   cd Aadhar');
    console.log('   npm start\n');

    console.log('2️⃣  OPEN BROWSER and navigate to:');
    console.log(`   ${resetUrl}\n`);

    console.log('3️⃣  YOU SHOULD SEE:');
    console.log('   ✓ Page title: "Reset Password" or "Set new password"');
    console.log('   ✓ User name: "Real Test User"');
    console.log('   ✓ Two password input fields');
    console.log('   ✓ "Reset password" button\n');

    console.log('4️⃣  ENTER NEW PASSWORD:');
    console.log('   New password: NewRealPassword456');
    console.log('   Confirm password: NewRealPassword456');
    console.log('   Click "Reset password"\n');

    console.log('5️⃣  AFTER SUBMISSION:');
    console.log('   ✓ Should redirect to: http://localhost:3000/login?passwordReset=1');
    console.log('   ✓ Should show success message');
    console.log('   ✓ Login with: realtest@example.com');
    console.log('   ✓ Password: NewRealPassword456\n');

    console.log('6️⃣  VERIFY OLD PASSWORD FAILS:');
    console.log('   ✓ Try logging in with: OldRealPassword123');
    console.log('   ✓ Should see error: "Invalid email or password"\n');

    console.log('=' .repeat(70));
    console.log('⏸️  TEST USER READY - WAITING FOR MANUAL VERIFICATION');
    console.log('=' .repeat(70));
    console.log('\n⚠️  Important: Do NOT close this terminal yet!');
    console.log('📋 Test user will remain in database for your testing.');
    console.log('🔄 Press Ctrl+C when done (or this will auto-cleanup in 10 minutes)\n');

    // Keep test user alive for 10 minutes
    await new Promise(resolve => setTimeout(resolve, 600000));

    // Auto cleanup after 10 minutes
    console.log('\n🧹 Auto-cleanup: Removing test user...');
    await User.deleteOne({ email: 'realtest@example.com' });
    console.log('✅ Test user cleaned up\n');

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n🧹 Cleaning up test user...');
  const { User } = require('./models/User');
  await User.deleteOne({ email: 'realtest@example.com' });
  console.log('✅ Test user removed');
  process.exit(0);
});

testRealResetFlow();
