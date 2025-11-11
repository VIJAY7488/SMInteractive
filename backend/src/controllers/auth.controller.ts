import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User from '../models/user.models';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
} from '../utils/apiResponse';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from '../utils/jwt';
import logger from '../utils/logger';
import { create } from 'domain';

export const register = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ConflictError('Email already registered');
        }

        // Create new user
        const newUser = new User({ name, email, password, role });
        await newUser.save();

        // Generate tokens
        const accessToken = generateAccessToken(newUser._id, newUser.role);
        const refreshToken = generateRefreshToken(newUser._id);

        logger.info(`New user registered: ${newUser.email}`);

        // Set refresh token in cookies
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });

        // Respond with tokens
        res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          coins: newUser.coins,
        },
        accessToken,
        refreshToken,
      },
    });
    } catch (error) {
        logger.error('Error registering user:', error);
        next(error);
    }
}


export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Find user by email and select password
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            throw new AuthenticationError('Invalid credentials');
        }

        //Check if user is active
        if (!user.isActive) {
            throw new AuthenticationError('User account is deactivated');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid credentials');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const accessToken = generateAccessToken(user._id, user.role);
        const refreshToken = generateRefreshToken(user._id);

        logger.info(`User logged in: ${user.email}`);

        // Set refresh token in cookies
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });

        // Respond with tokens
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    coins: user.coins,
                },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        logger.error('Error logging in user:', error);
        next(error);
    }
}

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Clear the cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true, 
      sameSite: 'strict',
    });

    logger.info(`User logged out: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            throw new AuthenticationError('No refresh token provided');
        }

        // Verify refresh token
        const userId = verifyRefreshToken(refreshToken);
        if (!userId) {
            throw new AuthenticationError('Invalid refresh token');
        }

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        if(!user.isActive) {
            throw new AuthenticationError('User account is deactivated');
        }

        // Generate new access tokens
        const newAccessToken = generateAccessToken(user._id, user.role);
        const newRefreshToken = generateRefreshToken(user._id);

        // Set new refresh token in cookies
        res.cookie('refreshToken', newRefreshToken, { httpOnly: true, secure: true });

        // Respond with tokens
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch (error) {
        logger.error('Error refreshing token:', error);
        next(error);
    }
};


export const getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user;

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Respond with user data
        res.status(200).json({
            success: true,
            message: 'User profile retrieved successfully',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                coins: user.coins,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        logger.error('Error fetching user profile:', error);
        next(error);
    }
};


export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { email } = req.body;

    // Ensure email is provided
    if (!email) {
      throw new ConflictError('Email is required to update profile');
    }

    // Check if email already exists for another user
    const existingUser = await User.findOne({
      _id: { $ne: user._id },
      email,
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Update email
    user.email = email;
    await user.save();

    logger.info(`User email updated: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Email updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          coins: user.coins,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};