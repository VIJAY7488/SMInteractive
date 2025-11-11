import { Request, Response, NextFunction } from 'express';
import { SpinWheelService } from '../services/spinWheelService';
import { ValidationError } from '../utils/apiResponse';
import logger from '../utils/logger';

/**
 * Create a new spin wheel (Admin only)
 */
export const createSpinWheel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { entryFee, maxParticipants } = req.body;
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    const spinWheel = await SpinWheelService.createSpinWheel(
      user._id.toString(),
      user.name,
      entryFee,
      maxParticipants
    );

    logger.info(`Spin wheel created by admin ${user._id}`);

    res.status(201).json({
      success: true,
      message: 'Spin wheel created successfully',
      data: {
        spinWheel: {
          id: spinWheel._id,
          adminId: spinWheel.adminId,
          adminName: spinWheel.adminName,
          entryFee: spinWheel.entryFee,
          status: spinWheel.status,
          maxParticipants: spinWheel.maxParticipants,
          minParticipants: spinWheel.minParticipants,
          winnerPoolPercentage: spinWheel.winnerPoolPercentage,
          adminPoolPercentage: spinWheel.adminPoolPercentage,
          appPoolPercentage: spinWheel.appPoolPercentage,
          autoStartAt: spinWheel.autoStartAt,
          createdAt: spinWheel.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active spin wheel
 */
export const getActiveSpinWheel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const spinWheel = await SpinWheelService.getActiveSpinWheel();

    if (!spinWheel) {
      res.status(200).json({
        success: true,
        message: 'No active spin wheel found',
        data: {
          spinWheel: null,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Active spin wheel retrieved successfully',
      data: {
        spinWheel: {
          id: spinWheel._id,
          adminId: spinWheel.adminId,
          adminName: spinWheel.adminName,
          entryFee: spinWheel.entryFee,
          status: spinWheel.status,
          participants: spinWheel.participants.map(p => ({
            userId: p.userId,
            name: p.name,
            joinedAt: p.joinedAt,
            isEliminated: p.isEliminated,
            eliminatedAt: p.eliminatedAt,
            eliminationOrder: p.eliminationOrder,
          })),
          maxParticipants: spinWheel.maxParticipants,
          minParticipants: spinWheel.minParticipants,
          totalParticipants: spinWheel.participants.length,
          winnerPool: spinWheel.winnerPool,
          adminPool: spinWheel.adminPool,
          appPool: spinWheel.appPool,
          totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool,
          autoStartAt: spinWheel.autoStartAt,
          startedAt: spinWheel.startedAt,
          createdAt: spinWheel.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get spin wheel by ID
 */
export const getSpinWheelById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { spinWheelId } = req.params;

    const spinWheel = await SpinWheelService.getSpinWheelById(spinWheelId);

    res.status(200).json({
      success: true,
      message: 'Spin wheel retrieved successfully',
      data: {
        spinWheel: {
          id: spinWheel._id,
          adminId: spinWheel.adminId,
          adminName: spinWheel.adminName,
          entryFee: spinWheel.entryFee,
          status: spinWheel.status,
          participants: spinWheel.participants.map(p => ({
            userId: p.userId,
            name: p.name,
            joinedAt: p.joinedAt,
            entryFeePaid: p.entryFeePaid,
            isEliminated: p.isEliminated,
            eliminatedAt: p.eliminatedAt,
            eliminationOrder: p.eliminationOrder,
          })),
          maxParticipants: spinWheel.maxParticipants,
          minParticipants: spinWheel.minParticipants,
          winnerPool: spinWheel.winnerPool,
          adminPool: spinWheel.adminPool,
          appPool: spinWheel.appPool,
          totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool,
          winnerId: spinWheel.winnerId,
          winnerName: spinWheel.winnerName,
          eliminationSequence: spinWheel.eliminationSequence,
          currentEliminationIndex: spinWheel.currentEliminationIndex,
          autoStartAt: spinWheel.autoStartAt,
          startedAt: spinWheel.startedAt,
          completedAt: spinWheel.completedAt,
          createdAt: spinWheel.createdAt,
          updatedAt: spinWheel.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Join a spin wheel
 */
export const joinSpinWheel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { spinWheelId } = req.body;
    const user = req.user;

    if (!user) {
      throw new ValidationError('User not authenticated');
    }

    const spinWheel = await SpinWheelService.joinSpinWheel(
      spinWheelId,
      user._id.toString(),
      user.name
    );

    logger.info(`User ${user._id} joined spin wheel ${spinWheelId}`);

    res.status(200).json({
      success: true,
      message: 'Successfully joined spin wheel',
      data: {
        spinWheel: {
          id: spinWheel._id,
          status: spinWheel.status,
          totalParticipants: spinWheel.participants.length,
          maxParticipants: spinWheel.maxParticipants,
          winnerPool: spinWheel.winnerPool,
          adminPool: spinWheel.adminPool,
          appPool: spinWheel.appPool,
          totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool,
        },
        userBalance: user.coins - spinWheel.entryFee,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start spin wheel manually (Admin only)
 */
export const startSpinWheel = async (
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

    const spinWheel = await SpinWheelService.startSpinWheel(spinWheelId);

    logger.info(`Spin wheel ${spinWheelId} started by admin ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Spin wheel started successfully',
      data: {
        spinWheel: {
          id: spinWheel._id,
          status: spinWheel.status,
          totalParticipants: spinWheel.participants.length,
          eliminationSequence: spinWheel.eliminationSequence,
          startedAt: spinWheel.startedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Abort spin wheel (Admin only)
 */
export const abortSpinWheel = async (
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

    const spinWheel = await SpinWheelService.abortSpinWheel(spinWheelId);

    logger.info(`Spin wheel ${spinWheelId} aborted by admin ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Spin wheel aborted and participants refunded',
      data: {
        spinWheel: {
          id: spinWheel._id,
          status: spinWheel.status,
          participantsRefunded: spinWheel.participants.length,
          completedAt: spinWheel.completedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get spin wheel statistics
 */
export const getSpinWheelStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { spinWheelId } = req.params;

    const stats = await SpinWheelService.getSpinWheelStats(spinWheelId);

    res.status(200).json({
      success: true,
      message: 'Spin wheel statistics retrieved successfully',
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get spin wheel history with pagination
 */
export const getSpinWheelHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const filters: any = {};
    if (status) {
      filters.status = status;
    }

    const result = await SpinWheelService.getSpinWheelHistory(page, limit, filters);

    res.status(200).json({
      success: true,
      message: 'Spin wheel history retrieved successfully',
      data: {
        spinWheels: result.spinWheels.map(sw => ({
          id: sw._id,
          adminId: sw.adminId,
          adminName: sw.adminName,
          entryFee: sw.entryFee,
          status: sw.status,
          totalParticipants: sw.participants.length,
          totalPool: sw.winnerPool + sw.adminPool + sw.appPool,
          winnerId: sw.winnerId,
          winnerName: sw.winnerName,
          createdAt: sw.createdAt,
          startedAt: sw.startedAt,
          completedAt: sw.completedAt,
        })),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's spin wheel participation history
 */
export const getUserSpinWheels = async (
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
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await SpinWheelService.getUserSpinWheels(
      user._id.toString(),
      page,
      limit
    );

    res.status(200).json({
      success: true,
      message: 'User spin wheel history retrieved successfully',
      data: {
        spinWheels: result.spinWheels.map(sw => {
          const userParticipant = sw.participants.find(
            p => p.userId.toString() === user._id.toString()
          );

          return {
            id: sw._id,
            adminName: sw.adminName,
            entryFee: sw.entryFee,
            status: sw.status,
            totalParticipants: sw.participants.length,
            totalPool: sw.winnerPool + sw.adminPool + sw.appPool,
            isWinner: sw.winnerId?.toString() === user._id.toString(),
            winnerName: sw.winnerName,
            userEliminated: userParticipant?.isEliminated,
            userEliminationOrder: userParticipant?.eliminationOrder,
            prizeWon: sw.winnerId?.toString() === user._id.toString() ? sw.winnerPool : 0,
            createdAt: sw.createdAt,
            completedAt: sw.completedAt,
          };
        }),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can join spin wheel
 */
export const canUserJoin = async (
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

    const canJoin = await SpinWheelService.canUserJoin(
      spinWheelId,
      user._id.toString()
    );

    res.status(200).json({
      success: true,
      message: 'User join eligibility checked',
      data: {
        canJoin,
        userBalance: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
};