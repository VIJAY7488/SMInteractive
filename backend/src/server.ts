import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import app from './app';
import connectDB from './config/database.config';
import logger from './utils/logger';
import { initializeSocketServer } from './config/socket.config';
import { getScheduler } from './services/scheduler.service';
import path from 'path';
import fs from 'fs';



// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}


const PORT = process.env.PORT || 4000;



async function start() {
await connectDB();
const server = http.createServer(app);
// Initialize Socket.io
const socketServer = initializeSocketServer(server);
logger.info('Socket.io server initialized');

// Initialize scheduler
const scheduler = getScheduler();
scheduler.initialize();
logger.info('Spin wheel scheduler initialized');


server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
}


start().catch(err => {
console.error('Failed to start server', err);
process.exit(1);
});

