require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const ensureAdminUser = require('./utils/ensureAdminUser');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const missingRequiredEnv = ['MONGO_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
const missingCloudinaryEnv = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  .filter((key) => !process.env[key]);
const missingRazorpayEnv = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
  .filter((key) => !process.env[key]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
};

let bootstrapPromise;

const validateRuntimeEnv = () => {
  if (missingRequiredEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequiredEnv.join(', ')}`);
  }

  if (missingCloudinaryEnv.length > 0) {
    console.warn(`Cloudinary routes are disabled until these env vars are set: ${missingCloudinaryEnv.join(', ')}`);
  }

  if (missingRazorpayEnv.length > 0) {
    console.warn(`Razorpay routes are partially disabled until these env vars are set: ${missingRazorpayEnv.join(', ')}`);
  }
};

const bootstrap = async () => {
  validateRuntimeEnv();
  await connectDB();
  await ensureAdminUser();
  console.log('Backend bootstrap completed');
};

const ensureBootstrap = () => {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      console.error('Bootstrap failed', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    });
  }

  return bootstrapPromise;
};

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(async (req, res, next) => {
  try {
    await ensureBootstrap();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', require('./routes/upload'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API is working'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'FreshMart API is running',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});

app.use(errorHandler);

ensureBootstrap().catch(() => {});

module.exports = app;
module.exports.default = app;
