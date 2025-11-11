import { Router } from 'express';
import {
  getDashboardStats,
  getAllTransactions,
  getSystemAnalytics,
  updateSystemConfig,
  getSystemConfig,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import Joi from 'joi';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// Validation schemas
const updateConfigSchema = Joi.object({
  key: Joi.string().required().messages({
    'any.required': 'Configuration key is required',
  }),
  value: Joi.any().required().messages({
    'any.required': 'Configuration value is required',
  }),
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get('/dashboard', authenticate, authorize('admin'), getDashboardStats);

/**
 * @route   GET /api/admin/transactions
 * @desc    Get all transactions
 * @access  Private (Admin)
 */
router.get('/transactions', authenticate, authorize('admin'), getAllTransactions);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get system analytics
 * @access  Private (Admin)
 */
router.get('/analytics', authenticate, authorize('admin'), getSystemAnalytics);

/**
 * @route   GET /api/admin/config
 * @desc    Get system configuration
 * @access  Private (Admin)
 */
router.get('/config', authenticate, authorize('admin'), getSystemConfig);

/**
 * @route   PUT /api/admin/config
 * @desc    Update system configuration
 * @access  Private (Admin)
 */
router.put(
  '/config',
  authenticate,
  authorize('admin'),
  validate(updateConfigSchema),
  updateSystemConfig
);

export default router;