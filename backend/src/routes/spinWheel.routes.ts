import { Router } from 'express';
import {
  createSpinWheel,
  getActiveSpinWheel,
  getSpinWheelById,
  joinSpinWheel,
  startSpinWheel,
  abortSpinWheel,
  getSpinWheelStats,
  getSpinWheelHistory,
  getUserSpinWheels,
  canUserJoin,
} from '../controllers/spinWheel.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createSpinWheelSchema,
  joinSpinWheelSchema,
  spinWheelIdParamSchema,
} from '../validations/spinWheel.validator';

const router = Router();

/**
 * @route   POST /api/spin-wheels
 * @desc    Create a new spin wheel (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createSpinWheelSchema),
  createSpinWheel
);

/**
 * @route   GET /api/spin-wheels/active
 * @desc    Get currently active spin wheel
 * @access  Public
 */
router.get('/active', getActiveSpinWheel);

/**
 * @route   GET /api/spin-wheels/history
 * @desc    Get spin wheel history with pagination
 * @access  Public
 */
router.get('/history', getSpinWheelHistory);

/**
 * @route   GET /api/spin-wheels/my-games
 * @desc    Get user's spin wheel participation history
 * @access  Private
 */
router.get('/my-games', authenticate, getUserSpinWheels);

/**
 * @route   GET /api/spin-wheels/:spinWheelId
 * @desc    Get spin wheel by ID
 * @access  Public
 */
router.get('/:spinWheelId', getSpinWheelById);

/**
 * @route   GET /api/spin-wheels/:spinWheelId/stats
 * @desc    Get spin wheel statistics
 * @access  Public
 */
router.get('/:spinWheelId/stats', getSpinWheelStats);

/**
 * @route   GET /api/spin-wheels/:spinWheelId/can-join
 * @desc    Check if user can join spin wheel
 * @access  Private
 */
router.get('/:spinWheelId/can-join', authenticate, canUserJoin);

/**
 * @route   POST /api/spin-wheels/join
 * @desc    Join a spin wheel
 * @access  Private
 */
router.post(
  '/join',
  authenticate,
  validate(joinSpinWheelSchema),
  joinSpinWheel
);

/**
 * @route   POST /api/spin-wheels/:spinWheelId/start
 * @desc    Start spin wheel manually (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:spinWheelId/start',
  authenticate,
  authorize('admin'),
  startSpinWheel
);

/**
 * @route   POST /api/spin-wheels/:spinWheelId/abort
 * @desc    Abort spin wheel and refund participants (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:spinWheelId/abort',
  authenticate,
  authorize('admin'),
  abortSpinWheel
);

export default router;