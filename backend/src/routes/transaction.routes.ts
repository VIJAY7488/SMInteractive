import { Router } from 'express';
import {
  getUserTransactions,
  getSpinWheelTransactions,
  getTransactionStats,
} from '../controllers/transaction.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route   GET /api/transactions
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get('/', authenticate, getUserTransactions);

/**
 * @route   GET /api/transactions/stats
 * @desc    Get user's transaction statistics
 * @access  Private
 */
router.get('/stats', authenticate, getTransactionStats);

/**
 * @route   GET /api/transactions/spin-wheel/:spinWheelId
 * @desc    Get transactions for a specific spin wheel
 * @access  Private
 */
router.get('/spin-wheel/:spinWheelId', authenticate, getSpinWheelTransactions);

export default router;