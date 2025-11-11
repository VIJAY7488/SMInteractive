import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.models';
import { loggers } from '../utils/logger';

// Extend Socket type to include user
export interface AuthenticatedSocket extends Socket {
  user?: IUser;
  userId?: string;
}

export class SocketServer {
  private io: Server;
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:4000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    loggers.socket('Socket.io server initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
          userId: string;
          role: string;
        };

        // Get user from database
        const user = await User.findById(decoded.userId);

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        if (!user.isActive) {
          return next(new Error('Authentication error: Account is deactivated'));
        }

        // Attach user to socket
        socket.user = user;
        socket.userId = user._id.toString();

        loggers.socket('User authenticated', {
          userId: user._id.toString(),
          name: user.name,
          socketId: socket.id,
        });

        next();
      } catch (error: any) {
        loggers.socket('Authentication failed', { error: error.message });
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);

      // Event listeners
      socket.on('join:spinwheel', (data) => this.handleJoinSpinWheel(socket, data));
      socket.on('leave:spinwheel', (data) => this.handleLeaveSpinWheel(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('error', (error) => this.handleError(socket, error));
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Track connected socket
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, []);
    }
    this.connectedUsers.get(userId)!.push(socket.id);

    loggers.socket('User connected', {
      userId,
      name: socket.user?.name,
      socketId: socket.id,
      totalSockets: this.connectedUsers.get(userId)?.length,
    });

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected to Spin Wheel server',
      userId,
      name: socket.user?.name,
      socketId: socket.id,
    });

    // Send online status to other users
    this.io.emit('user:online', {
      userId,
      name: socket.user?.name,
    });
  }

  /**
   * Handle join spin wheel room
   */
  private handleJoinSpinWheel(socket: AuthenticatedSocket, data: { spinWheelId: string }): void {
    const { spinWheelId } = data;
    const roomName = `spinwheel:${spinWheelId}`;

    socket.join(roomName);

    loggers.socket('User joined spin wheel room', {
      userId: socket.userId,
      name: socket.user?.name,
      spinWheelId,
      roomName,
    });

    // Notify others in the room
    socket.to(roomName).emit('user:joined:room', {
      userId: socket.userId,
      name: socket.user?.name,
      spinWheelId,
    });

    // Confirm to the user
    socket.emit('joined:spinwheel', {
      message: 'Joined spin wheel room',
      spinWheelId,
      roomName,
    });
  }

  /**
   * Handle leave spin wheel room
   */
  private handleLeaveSpinWheel(socket: AuthenticatedSocket, data: { spinWheelId: string }): void {
    const { spinWheelId } = data;
    const roomName = `spinwheel:${spinWheelId}`;

    socket.leave(roomName);

    loggers.socket('User left spin wheel room', {
      userId: socket.userId,
      spinWheelId,
    });

    // Notify others
    socket.to(roomName).emit('user:left:room', {
      userId: socket.userId,
      name: socket.user?.name,
      spinWheelId,
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Remove socket from tracking
    if (this.connectedUsers.has(userId)) {
      const sockets = this.connectedUsers.get(userId)!;
      const index = sockets.indexOf(socket.id);
      if (index > -1) {
        sockets.splice(index, 1);
      }

      // If user has no more sockets, remove entry and emit offline
      if (sockets.length === 0) {
        this.connectedUsers.delete(userId);
        this.io.emit('user:offline', {
          userId,
          name: socket.user?.name,
        });
      }
    }

    loggers.socket('User disconnected', {
      userId,
      name: socket.user?.name,
      socketId: socket.id,
    });
  }

  /**
   * Handle socket error
   */
  private handleError(socket: AuthenticatedSocket, error: Error): void {
    loggers.socket('Socket error', {
      userId: socket.userId,
      error: error.message,
      socketId: socket.id,
    });
  }

  /**
   * Emit event to specific spin wheel room
   */
  public emitToSpinWheel(spinWheelId: string, event: string, data: any): void {
    const roomName = `spinwheel:${spinWheelId}`;
    this.io.to(roomName).emit(event, data);

    loggers.socket(`Emitted ${event} to spin wheel`, {
      spinWheelId,
      roomName,
    });
  }

  /**
   * Emit event to specific user (all their sockets)
   */
  public emitToUser(userId: string, event: string, data: any): void {
    const sockets = this.connectedUsers.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.io.to(socketId).emit(event, data);
      });

      loggers.socket(`Emitted ${event} to user`, {
        userId,
        socketCount: sockets.length,
      });
    }
  }

  /**
   * Emit event to all connected clients
   */
  public emitToAll(event: string, data: any): void {
    this.io.emit(event, data);

    loggers.socket(`Emitted ${event} to all clients`, {
      totalConnections: this.connectedUsers.size,
    });
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get Socket.io instance
   */
  public getIO(): Server {
    return this.io;
  }

  /**
   * Get users in a specific room
   */
  public async getUsersInRoom(roomName: string): Promise<string[]> {
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.map((socket: any) => socket.userId).filter(Boolean);
  }
}

// Singleton instance
let socketServer: SocketServer | null = null;

export const initializeSocketServer = (httpServer: HTTPServer): SocketServer => {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
  }
  return socketServer;
};

export const getSocketServer = (): SocketServer => {
  if (!socketServer) {
    throw new Error('Socket server not initialized. Call initializeSocketServer first.');
  }
  return socketServer;
};

export default { initializeSocketServer, getSocketServer };