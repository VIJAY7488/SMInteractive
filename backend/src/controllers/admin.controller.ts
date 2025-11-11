import { Request, Response, NextFunction } from 'express';
import User from '../models/user.models';
import SpinWheel from '../models/spin_wheels.models';
import Transaction from '../models/transaction.models';
import { ValidationError } from '../utils/apiResponse';
import logger from '../utils/logger';

/**
 * Get dashboard statistics (Admin only)
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    // Get spin wheel stats
    const totalSpinWheels = await SpinWheel.countDocuments();
    const activeSpinWheels = await SpinWheel.countDocuments({
      status: { $in: ['waiting', 'in_progress'] },
    });
    const completedSpinWheels = await SpinWheel.countDocuments({ status: 'completed' });

    // Get transaction stats
    const totalTransactions = await Transaction.countDocuments();

    // Get recent spin wheels
    const recentSpinWheels = await SpinWheel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('adminId adminUsername entryFee status participants winnerPool createdAt');

    // Calculate total coins in circulation
    const coinsInCirculation = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$coins' },
        },
      },
    ]);

    // Calculate total app revenue (from app pool)
    const appRevenue = await SpinWheel.aggregate([
      {
        $match: { status: 'completed' },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$appPool' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          admins: adminUsers,
        },
        spinWheels: {
          total: totalSpinWheels,
          active: activeSpinWheels,
          completed: completedSpinWheels,
        },
        transactions: {
          total: totalTransactions,
        },
        revenue: {
          appRevenue: appRevenue[0]?.total || 0,
          coinsInCirculation: coinsInCirculation[0]?.total || 0,
        },
        recentSpinWheels: recentSpinWheels.map(sw => ({
          id: sw._id,
          adminName: sw.adminName,
          entryFee: sw.entryFee,
          status: sw.status,
          participants: sw.participants.length,
          winnerPool: sw.winnerPool,
          createdAt: sw.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all transactions (Admin only)
 */
export const getAllTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;

    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (type) {
      query.type = type;
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username email')
        .populate('spinWheelId', 'status entryFee'),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: 'All transactions retrieved successfully',
      data: {
        transactions: transactions.map(t => ({
          id: t._id,
          userId: t.userId,
          name: t.name,
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          spinWheelId: t.spinWheelId,
          metadata: t.metadata,
          createdAt: t.createdAt,
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
 * Get system analytics (Admin only)
 */
export const getSystemAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    // Spin wheels created over time
    const spinWheelsOverTime = await SpinWheel.aggregate([
      ...(Object.keys(dateFilter).length > 0
        ? [{ $match: { createdAt: dateFilter } }]
        : []),
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Users registered over time
    const usersOverTime = await User.aggregate([
      ...(Object.keys(dateFilter).length > 0
        ? [{ $match: { createdAt: dateFilter } }]
        : []),
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Revenue by type
    const revenueByType = await Transaction.aggregate([
      ...(Object.keys(dateFilter).length > 0
        ? [{ $match: { createdAt: dateFilter } }]
        : []),
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Top winners
    const topWinners = await SpinWheel.aggregate([
      { $match: { status: 'completed', winnerId: { $exists: true } } },
      ...(Object.keys(dateFilter).length > 0
        ? [{ $match: { completedAt: dateFilter } }]
        : []),
      {
        $group: {
          _id: '$winnerId',
          winnerUsername: { $first: '$winnerUsername' },
          totalWins: { $sum: 1 },
          totalPrize: { $sum: '$winnerPool' },
        },
      },
      { $sort: { totalWins: -1 } },
      { $limit: 10 },
    ]);

    // Most active admins
    const mostActiveAdmins = await SpinWheel.aggregate([
      ...(Object.keys(dateFilter).length > 0
        ? [{ $match: { createdAt: dateFilter } }]
        : []),
      {
        $group: {
          _id: '$adminId',
          adminUsername: { $first: '$adminUsername' },
          totalGamesCreated: { $sum: 1 },
          totalRevenue: { $sum: '$adminPool' },
        },
      },
      { $sort: { totalGamesCreated: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      message: 'System analytics retrieved successfully',
      data: {
        spinWheelsOverTime,
        usersOverTime,
        revenueByType,
        topWinners,
        mostActiveAdmins,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update system configuration (Admin only)
 */
export const updateSystemConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      throw new ValidationError('Key and value are required');
    }

    // Import Config model
    const Config = (await import('../models/config.models')).default;

    // Update or create config
    const config = await Config.findOneAndUpdate(
      { key: key.toUpperCase() },
      { value, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    logger.info(`System config updated: ${key} = ${value}`);

    res.status(200).json({
      success: true,
      message: 'System configuration updated successfully',
      data: {
        config: {
          key: config.key,
          value: config.value,
          type: config.type,
          updatedAt: config.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system configuration (Admin only)
 */
export const getSystemConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Import Config model
    const Config = (await import('../models/config.models')).default;

    const configs = await Config.find({ isActive: true }).sort({ key: 1 });

    res.status(200).json({
      success: true,
      message: 'System configuration retrieved successfully',
      data: {
        configs: configs.map(c => ({
          key: c.key,
          value: c.value,
          type: c.type,
          description: c.description,
          updatedAt: c.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};