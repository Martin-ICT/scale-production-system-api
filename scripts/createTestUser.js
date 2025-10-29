/**
 * Script to create a test user for authentication testing
 * Run: node scripts/createTestUser.js
 */

require('dotenv').config();
const User = require('../models/user');

const createTestUser = async () => {
  try {
    console.log('🔄 Connecting to WMS database...');

    // Sync user table (create if not exists)
    await User.sequelize.sync();
    console.log('✅ Database synced');

    // Check if admin user exists
    const existingAdmin = await User.findOne({
      where: { name: 'admin' },
    });

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('Name:', existingAdmin.name);
      console.log('Email:', existingAdmin.email);
      console.log('Client ID:', existingAdmin.clientId);
      process.exit(0);
    }

    // Hash password manually
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create admin user
    const adminUser = await User.create({
      name: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      clientId: 0,
      isActive: true,
    });

    console.log('✅ Test user created successfully!');
    console.log('\n📋 User Details:');
    console.log('User ID:', adminUser.userId);
    console.log('Name:', adminUser.name);
    console.log('Email:', adminUser.email);
    console.log('Client ID:', adminUser.clientId);
    console.log('Password: admin123 (plain text for testing)');
    console.log('\n🔐 Use these credentials to login via GraphQL:');
    console.log('mutation {');
    console.log('  authLogin(input: {');
    console.log('    name: "admin"');
    console.log('    password: "admin123"');
    console.log('  }) {');
    console.log('    success');
    console.log('    message');
    console.log('    token');
    console.log('    user {');
    console.log('      userId');
    console.log('      name');
    console.log('      email');
    console.log('      clientId');
    console.log('    }');
    console.log('  }');
    console.log('}');

    // Hash password for test user
    const testHashedPassword = await bcrypt.hash('test123', salt);

    // Create test regular user
    const testUser = await User.create({
      name: 'testuser',
      password: testHashedPassword,
      email: 'test@example.com',
      clientId: 0,
      isActive: true,
    });

    console.log('\n✅ Additional test user created:');
    console.log('Name:', testUser.name);
    console.log('Password: test123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    console.error(error);
    process.exit(1);
  }
};

createTestUser();
