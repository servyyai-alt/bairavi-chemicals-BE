const express = require('express');
const multer = require('multer');
const streamifier = require('streamifier');

const { configureCloudinary } = require('../config/cloudinary');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', protect, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const cloudinary = configureCloudinary();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'sri-bairavi-chemicals/products' },
        (error, response) => {
          if (error) return reject(error);
          return resolve(response);
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    res.status(201).json({
      success: true,
      url: result.secure_url
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
