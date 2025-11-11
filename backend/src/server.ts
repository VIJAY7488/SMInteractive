import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import app from './app';
import connectDB from './config/database.config';
import { initSocket } from './socket';


const PORT = process.env.PORT || 4000;


async function start() {
await connectDB();
const server = http.createServer(app);
initSocket(server);
server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
}


start().catch(err => {
console.error('Failed to start server', err);
process.exit(1);
});

