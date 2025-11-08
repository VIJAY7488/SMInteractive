import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
// import { User } from './models/User';`


export let io: Server;


export function initSocket(server: HttpServer) {
io = new Server(server, { cors: { origin: '*' } });


io.use(async (socket: Socket, next) => {
const token = socket.handshake.auth?.token;
if (!token) return next();
try {
const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'change_this_secret');
// const user = await User.findById(payload.id);
// if (user) {
// (socket as any).user = user;
// }
next();
} catch (err) {
next();
}
});


io.on('connection', (socket) => {
console.log('socket connected', socket.id);


socket.on('join_wheel_room', (data: { wheelId: string }) => {
socket.join(data.wheelId);
console.log(`socket ${socket.id} joined ${data.wheelId}`);
});


socket.on('leave_wheel_room', (data: { wheelId: string }) => {
socket.leave(data.wheelId);
});


socket.on('disconnect', () => {
console.log('socket disconnect', socket.id);
});
});
}