import mongoose from 'mongoose';
import logger from '../utils/logger';   

const connectDB = async (): Promise<void> => {
    try {
        const mongoURI = process.env.MONGO_URI as string;
        
        const options = {
            maxPoolSize: 10,
            minPoolSize: 5,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            family: 4,
        };

        await mongoose.connect(mongoURI, options);
        logger.info('MongoDB connected successfully.');

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err}`);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed due to application termination.');
            process.exit(0);
        });
    } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error}`);
    process.exit(1);
    }
};

export default connectDB;