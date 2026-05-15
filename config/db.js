const mongoose = require('mongoose');

let cached = global.__mongooseConnection;

if (!cached) {
  cached = global.__mongooseConnection = { conn: null, promise: null };
}

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('Missing required environment variable: MONGO_URI');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    console.log('Connecting to MongoDB');
    cached.promise = mongoose.connect(mongoUri, {
      bufferCommands: false
    }).then((connection) => {
      console.log(`MongoDB connected: ${connection.connection.host}`);
      return connection;
    }).catch((error) => {
      cached.promise = null;
      console.error('MongoDB connection failed', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
