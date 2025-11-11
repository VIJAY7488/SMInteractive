import { Request, Response, NextFunction } from 'express';
import User from '../models/user.models';
import { ValidationError, NotFoundError } from '../utils/apiResponse';
import logger from '../utils/logger';

/**
 * Get user balance
 */
export const getUserBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    res.status(200).json({
      success: true,
      message: 'User balance retrieved successfully',
      data: {
        userId: user._id,
        name: user.name,
        coins: user.coins,
        coinBalance: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: users.map(u => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          coins: u.coins,
          isActive: u.isActive,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 */
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      throw new NotFoundError('User');
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          coins: user.coins,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status (Admin only)
 */
export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    user.isActive = isActive;
    await user.save();

    logger.info(`User ${userId} status updated to ${isActive}`);

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add coins to user (Admin only - for testing/management)
 */
export const addCoinsToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const oldBalance = user.coins;
    user.coins += amount;
    await user.save();

    logger.info(`Admin added ${amount} coins to user ${userId}. Reason: ${reason || 'N/A'}`);

    res.status(200).json({
      success: true,
      message: 'Coins added successfully',
      data: {
        userId: user._id,
        name: user.name,
        oldBalance,
        newBalance: user.coins,
        amountAdded: amount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    // Import models here to avoid circular dependencies
    const SpinWheel = (await import('../models/spin_wheels.models')).default;
    const Transaction = (await import('../models/transaction.models')).default;

    // Get spin wheel participation stats
    const totalParticipated = await SpinWheel.countDocuments({
      'participants.userId': user._id,
    });

    const totalWins = await SpinWheel.countDocuments({
      winnerId: user._id,
      status: 'completed',
    });

    // Get transaction stats
    const totalTransactions = await Transaction.countDocuments({
      userId: user._id,
    });

    // Calculate win rate
    const winRate = totalParticipated > 0 ? (totalWins / totalParticipated) * 100 : 0;

    res.status(200).json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: {
        stats: {
          currentBalance: user.coins,
          totalGamesParticipated: totalParticipated,
          totalWins,
          winRate: winRate.toFixed(2) + '%',
          totalTransactions,
          accountCreated: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};