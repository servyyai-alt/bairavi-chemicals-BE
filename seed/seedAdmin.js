require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');

const adminName = process.env.ADMIN_NAME || 'Sri Bairavi Admin';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sribairavichemicals.com').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

const ensureAdmin = async () => {
  await connectDB();

  const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');

  if (existingAdmin) {
    existingAdmin.name = adminName;
    existingAdmin.role = 'admin';
    existingAdmin.isActive = true;
    existingAdmin.password = adminPassword;
    await existingAdmin.save();

    console.log(`Updated admin user: ${adminEmail}`);
    return;
  }

  await User.create({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    isActive: true
  });

  console.log(`Created admin user: ${adminEmail}`);
};

ensureAdmin()
  .then(() => {
    console.log('Admin seeding complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin seeding failed', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
