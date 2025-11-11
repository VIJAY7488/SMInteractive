import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.models'
import { AuthenticationError, AuthorizationError } from '../utils/apiResponse.js';
import logger from '../utils/logger';




declare global {
  namespace Express {
    interface Request {
      user?: IUser
    }
  }
}

interface JWTPayload {
  userId: string;
  role: string;
}


export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if(!token){
      throw new AuthenticationError('Invalid token format');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload;

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token');
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired');
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
}



export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user ${req.user._id}`);
      return next(
        new AuthorizationError(
          `Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};




