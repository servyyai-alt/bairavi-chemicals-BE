require('dotenv').config();
const app = require('./server');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start backend', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
