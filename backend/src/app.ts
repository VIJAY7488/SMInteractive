import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import spinWheelRoutes from './routes/spinWheel.routes';
import transactionRoutes from './routes/transaction.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import logger from './utils/logger';



const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());                              // Sets secure HTTP headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));       // Prevent oversized JSON payloads
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use(morgan('dev', {
  stream: {
    write: (message: string) => logger.http(message.trim()),
  },
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) =>
  res.json({ success: true, message: 'Roxstar Spin Wheel Backend' })
);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/spin-wheels', spinWheelRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`,
      code: 'NOT_FOUND',
      statusCode: 404,
    },
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;

  logger.error(`[${req.method}] ${req.originalUrl} → ${statusCode}: ${err.message}`, {
    errorCode: err.errorCode,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.errorCode || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});


export default app;