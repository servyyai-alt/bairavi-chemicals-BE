const User = require('../models/User');

const normalizeEmail = (email) => email?.trim().toLowerCase();

async function ensureAdminUser() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('Admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing');
    return;
  }

  const existingUser = await User.findOne({ email: adminEmail }).select('+password');

  if (!existingUser) {
    await User.create({
      name: process.env.ADMIN_NAME || 'Admin User',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: process.env.ADMIN_PHONE || ''
    });
    console.log(`Admin user created for ${adminEmail}`);
    return;
  }

  let shouldSave = false;

  if (existingUser.role !== 'admin') {
    existingUser.role = 'admin';
    shouldSave = true;
  }

  if (!existingUser.phone && process.env.ADMIN_PHONE) {
    existingUser.phone = process.env.ADMIN_PHONE;
    shouldSave = true;
  }

  if (shouldSave) {
    await existingUser.save();
    console.log(`Admin privileges ensured for ${adminEmail}`);
  }
}

module.exports = ensureAdminUser;
