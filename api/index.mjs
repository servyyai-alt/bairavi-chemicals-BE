import connectDB from '../config/db.js';
import app from '../server.js';

await connectDB();

export default app;
