const express = require('express');
const multer = require('multer');
const streamifier = require('streamifier');
const { configureCloudinary } = require('../config/cloudinary.js');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const cloudinary = configureCloudinary();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'vallal-products',
          quality: 'auto:good',
          fetch_format: 'auto'
        },
        (error, uploadedFile) => {
          if (error) {
            return reject(error);
          }

          return resolve(uploadedFile);
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error('Upload error', {
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, message: err.message || 'Image upload failed' });
  }
});

module.exports = router;
