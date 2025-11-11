import express from 'express';
import cookiesParser from 'cookie-parser'; 
import authRoutes from './routes/auth.routes';
import spinWheelRoutes from './routes/spinWheel.routes';
import transactionRoutes from './routes/transaction.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';



const app = express();

app.use(express.json());
app.use(cookiesParser());


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/spin-wheels', spinWheelRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req, res) => res.send('Roxstar Spin Wheel Backend'));


export default app;