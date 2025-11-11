import { Router } from 'express';
import {
  getUserBalance,
  getAllUsers,
  getUserById,
  updateUserStatus,
  addCoinsToUser,
  getUserStats,
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import Joi from 'joi';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

// Validation schemas
const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'isActive is required',
    'boolean.base': 'isActive must be a boolean',
  }),
});

const addCoinsSchema = Joi.object({
  amount: Joi.number().integer().min(1).required().messages({
    'number.base': 'Amount must be a number',
    'number.integer': 'Amount must be an integer',
    'number.min': 'Amount must be at least 1',
    'any.required': 'Amount is required',
  }),
  reason: Joi.string().max(200).messages({
    'string.max': 'Reason cannot exceed 200 characters',
  }),
});

/**
 * @route   GET /api/users/balance
 * @desc    Get user's coin balance
 * @access  Private
 */
router.get('/balance', authenticate, getUserBalance);

/**
 * @route   GET /api/users/stats
 * @desc    Get user's statistics
 * @access  Private
 */
router.get('/stats', authenticate, getUserStats);

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/', authenticate, authorize('admin'), getAllUsers);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID (Admin only)
 * @access  Private (Admin)
 */
router.get('/:userId', authenticate, authorize('admin'), getUserById);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Update user status (Admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:userId/status',
  authenticate,
  authorize('admin'),
  validate(updateUserStatusSchema),
  updateUserStatus
);

/**
 * @route   POST /api/users/:userId/add-coins
 * @desc    Add coins to user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:userId/add-coins',
  authenticate,
  authorize('admin'),
  validate(addCoinsSchema),
  addCoinsToUser
);

export default router;