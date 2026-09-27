/**
 * Test Password Reset with Existing User
 * Use this if you want to test with a real user from your database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testWithExistingUser() {
  console.log('🔍 Password Reset Test with Existing User\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aadhar');
    console.log('✅ Connected to database\n');

    const { User } = require('./models/User');
    const { createPasswordResetToken } = require('./utils/passwordReset');

    // Ask user for email (or use first donor found)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('This script will generate a password reset link for an existing user.');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // List some users
    const users = await User.find({ role: { $in: ['donor', 'volunteer', 'elderly'] } })
      .limit(5)
      .select('email name role');

    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('\n💡 Options:');
      console.log('   1. Register a user through the website first');
      console.log('   2. Run: node utils/seed.js (if available)');
      console.log('   3. Use test-real-reset-flow.js to create a test user\n');
      process.exit(1);
    }

    console.log('📋 Found users in database:\n');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.name}) - ${user.role}`);
    });
    console.log('');

    rl.question('Enter email address to generate reset link for: ', async (email) => {
      rl.close();

      const user = await User.findOne({ email: email.trim() });

      if (!user) {
        console.log(`\n❌ User with email "${email}" not found!`);
        console.log('\n💡 Please use one of the emails listed above.');
        process.exit(1);
      }

      console.log(`\n✅ Found user: ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}\n`);

      // Generate reset token
      console.log('🔐 Generating password reset token...');
      const { token, expiresAt } = await createPasswordResetToken(user._id);
      console.log(`✅ Token generated successfully`);
      console.log(`   Expires: ${expiresAt}\n`);

      // Build reset URL
      const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('🔗 PASSWORD RESET LINK GENERATED');
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('User:', user.name);
      console.log('Email:', user.email);
      console.log('\nReset URL:\n');
      console.log(`   ${resetUrl}\n`);
      console.log('═══════════════════════════════════════════════════════════════\n');

      console.log('📋 TESTING INSTRUCTIONS:\n');
      console.log('1️⃣  Make sure server is running:');
      console.log('   Open another terminal and run: npm start\n');

      console.log('2️⃣  Copy the URL above and paste it in your browser\n');

      console.log('3️⃣  You should see:');
      console.log(`   ✓ "Set new password" page`);
      console.log(`   ✓ "Hi ${user.name}, enter your new password..."`);
      console.log(`   ✓ Two password input fields`);
      console.log(`   ✓ "Reset password" button\n`);

      console.log('4️⃣  Enter a new password:');
      console.log('   - Minimum 8 characters');
      console.log('   - Must contain letters and numbers');
      console.log('   - Both fields must match\n');

      console.log('5️⃣  After submitting:');
      console.log('   ✓ Should redirect to login page');
      console.log('   ✓ Shows success message');
      console.log(`   ✓ Login with email: ${user.email}`);
      console.log('   ✓ Use your NEW password\n');

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('⚠️  IMPORTANT NOTES:');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('• This link expires in 1 hour');
      console.log('• This link can only be used ONCE');
      console.log('• If page doesn\'t load:');
      console.log('  - Verify server is running on port 3000');
      console.log('  - Copy the COMPLETE URL including token');
      console.log('  - Try in incognito/private mode');
      console.log('• After using the link, your current password will change!\n');

      await mongoose.connection.close();
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

testWithExistingUser();
