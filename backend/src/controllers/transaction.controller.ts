import { Request, Response, NextFunction } from 'express';
import Transaction from '../models/transaction.models';
import { ValidationError } from '../utils/apiResponse';
import logger from '../utils/logger';   

/**
 * Get user's transaction history
 */
export const getUserTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;

    const skip = (page - 1) * limit;

    // Build query
    const query: any = { userId: user._id };
    if (type) {
      query.type = type;
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('spinWheelId', 'status entryFee'),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: 'Transaction history retrieved successfully',
      data: {
        transactions: transactions.map(t => ({
          id: t._id,
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
 * Get transactions for a specific spin wheel
 */
export const getSpinWheelTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { spinWheelId } = req.params;
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    const transactions = await Transaction.find({
      spinWheelId,
      userId: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      message: 'Spin wheel transactions retrieved successfully',
      data: {
        transactions: transactions.map(t => ({
          id: t._id,
          type: t.type,
          amount: t.amount,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          metadata: t.metadata,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's transaction statistics
 */
export const getTransactionStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    // Aggregate statistics
    const stats = await Transaction.aggregate([
      {
        $match: { userId: user._id },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Calculate totals
    const totalTransactions = await Transaction.countDocuments({ userId: user._id });
    const totalSpent = await Transaction.aggregate([
      {
        $match: { userId: user._id, amount: { $lt: 0 } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: '$amount' } },
        },
      },
    ]);

    const totalEarned = await Transaction.aggregate([
      {
        $match: { userId: user._id, amount: { $gt: 0 } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'Transaction statistics retrieved successfully',
      data: {
        stats: {
          byType: stats,
          totalTransactions,
          totalSpent: totalSpent[0]?.total || 0,
          totalEarned: totalEarned[0]?.total || 0,
          netProfit: (totalEarned[0]?.total || 0) - (totalSpent[0]?.total || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};