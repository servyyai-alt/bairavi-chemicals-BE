const cloudinary = require('cloudinary').v2;

const getMissingCloudinaryEnv = () => ([
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
].filter((key) => !process.env[key]));

let configured = false;

const configureCloudinary = () => {
  const missing = getMissingCloudinaryEnv();

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary environment variables: ${missing.join(', ')}`);
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    configured = true;
  }

  return cloudinary;
};

module.exports = {
  cloudinary,
  configureCloudinary,
  getMissingCloudinaryEnv
};
