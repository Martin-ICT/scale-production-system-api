/**
 * Script to check and fix user password
 * Run: node scripts/checkPassword.js
 */

require('dotenv').config();
const User = require('../models/user');
const bcrypt = require('bcrypt');

const checkPassword = async () => {
  try {
    console.log('🔍 Checking user password...\n');

    // Get user
    const userName = process.argv[2] || 'admin';
    const user = await User.findOne({
      where: { name: userName },
    });

    if (!user) {
      console.log(`❌ User '${userName}' not found`);
      console.log('💡 Usage: node scripts/checkPassword.js <username>');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log('   Name:', user.name);
    console.log('   User ID:', user.userId);
    console.log('   Email:', user.email);
    console.log('   Password Hash:', user.password);
    console.log('');

    // Check if password is bcrypt hash
    const isBcryptHash =
      user.password.startsWith('$2b$') || user.password.startsWith('$2a$');

    if (isBcryptHash) {
      console.log('✅ Password is bcrypt hashed');
      console.log('');

      // Test password
      const testPassword = process.argv[3];
      if (testPassword) {
        console.log(`🔐 Testing password: "${testPassword}"`);
        const isValid = await bcrypt.compare(testPassword, user.password);
        if (isValid) {
          console.log('✅ Password is CORRECT!');
        } else {
          console.log('❌ Password is INCORRECT');
          console.log('');
          console.log('💡 Need to update password? Run:');
          console.log(
            `   node scripts/updatePassword.js ${userName} <new_password>`
          );
        }
      } else {
        console.log('💡 To test password, run:');
        console.log(
          `   node scripts/checkPassword.js ${userName} <password_to_test>`
        );
      }
    } else {
      console.log(
        '⚠️  Password is NOT bcrypt hashed (might be plain text or other hash)'
      );
      console.log('');
      console.log('Current password value:', user.password);
      console.log('');
      console.log(
        '❓ Is this the plain text password? If yes, we can hash it.'
      );
      console.log('');
      console.log('💡 To hash this password with bcrypt, run:');
      console.log(
        `   node scripts/updatePassword.js ${userName} ${user.password}`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkPassword();



