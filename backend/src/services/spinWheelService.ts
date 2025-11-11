import mongoose from 'mongoose';
import SpinWheel, { ISpinWheel, SpinWheelStatus } from '../models/spin_wheels.models';
import User from '../models/user.models';
import Transaction, { TransactionType } from '../models/transaction.models';
import {
  SpinWheelError,
  NotFoundError,
  InsufficientFundsError,
  ConflictError,
} from '../utils/apiResponse';
import { loggers } from '../utils/logger';

export class SpinWheelService {
  /**
   * Create new spin wheel
   * @param adminId - Admin user ID
   * @param adminName - Admin name
   * @param entryFee - Entry fee in coins
   * @returns Created spin wheel
   */
  static async createSpinWheel(
    adminId: string,
    adminName: string,
    entryFee: number,
    maxParticipants: number
  ): Promise<ISpinWheel> {
    // Check if there's already an active spin wheel
    const activeWheel = await SpinWheel.findOne({
      status: { $in: [SpinWheelStatus.WAITING, SpinWheelStatus.IN_PROGRESS] }
    });

    if (activeWheel) {
      throw new ConflictError('There is already an active spin wheel');
    }

    // Get distribution config from env
    const winnerPoolPercentage = parseInt(process.env.WINNER_POOL_PERCENTAGE || '70');
    const adminPoolPercentage = parseInt(process.env.ADMIN_POOL_PERCENTAGE || '20');
    const appPoolPercentage = parseInt(process.env.APP_POOL_PERCENTAGE || '10');

    // Validate percentages sum to 100
    if (winnerPoolPercentage + adminPoolPercentage + appPoolPercentage !== 100) {
      throw new SpinWheelError('Distribution percentages must sum to 100');
    }

    const spinWheel = new SpinWheel({
      adminId: new mongoose.Types.ObjectId(adminId),
      adminName,
      entryFee,
      winnerPoolPercentage,
      adminPoolPercentage,
      appPoolPercentage,
      autoStartTime: parseInt(process.env.AUTO_START_TIMEOUT || '180000'),
      eliminationInterval: parseInt(process.env.ELIMINATION_INTERVAL || '7000'),
      minParticipants: parseInt(process.env.MIN_PARTICIPANTS || '3'),
      maxParticipants,
    });

    await spinWheel.save();

    loggers.spinWheel('Created', spinWheel._id.toString(), {
      adminId,
      adminName,
      entryFee,
      distribution: {
        winner: winnerPoolPercentage,
        admin: adminPoolPercentage,
        app: appPoolPercentage
      }
    });

    return spinWheel;
  }

  /**
   * Join spin wheel
   * @param spinWheelId - Spin wheel ID
   * @param userId - User ID
   * @param name - name
   * @returns Updated spin wheel
   */
  static async joinSpinWheel(
    spinWheelId: string,
    userId: string,
    name: string
  ): Promise<ISpinWheel> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get spin wheel with lock
      const spinWheel = await SpinWheel.findOne({
        _id: spinWheelId,
        status: SpinWheelStatus.WAITING
      }).session(session);

      if (!spinWheel) {
        throw new NotFoundError('Spin wheel not found or already started');
      }

      // Check if user is admin
      if (spinWheel.adminId.toString() === userId) {
        throw new SpinWheelError('Admin cannot join their own spin wheel');
      }

      // Check if user already joined
      const alreadyJoined = spinWheel.participants.some(
        (p) => p.userId.toString() === userId
      );

      if (alreadyJoined) {
        throw new ConflictError('You have already joined this spin wheel');
      }

      // Check max participants
      if (spinWheel.participants.length >= spinWheel.maxParticipants) {
        throw new SpinWheelError('Spin wheel is full');
      }

      // Get user with lock
      const user = await User.findById(userId).session(session);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check sufficient balance
      if (user.coinBalance < spinWheel.entryFee) {
        throw new InsufficientFundsError(
          `Insufficient coins. Required: ${spinWheel.entryFee}, Available: ${user.coinBalance}`
        );
      }

      // Calculate distribution
      const winnerAmount = (spinWheel.entryFee * spinWheel.winnerPoolPercentage) / 100;
      const adminAmount = (spinWheel.entryFee * spinWheel.adminPoolPercentage) / 100;
      const appAmount = (spinWheel.entryFee * spinWheel.appPoolPercentage) / 100;

      // Update pools
      spinWheel.winnerPool += winnerAmount;
      spinWheel.adminPool += adminAmount;
      spinWheel.appPool += appAmount;

      // Add participant
      spinWheel.participants.push({
        userId: new mongoose.Types.ObjectId(userId),
        name,
        joinedAt: new Date(),
        entryFeePaid: spinWheel.entryFee,
        isEliminated: false
      });

      await spinWheel.save({ session });

    

      // Deduct coins from user
      const balanceBefore = Number(user.coins);
      user.coins -= spinWheel.entryFee;
      await user.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId: new mongoose.Types.ObjectId(userId),
        name,
        spinWheelId: spinWheel._id,
        type: TransactionType.ENTRY_FEE,
        amount: -spinWheel.entryFee,
        balanceBefore,
        balanceAfter: user.coins,
        metadata: {
          adminId: spinWheel.adminId,
          adminName: spinWheel.adminName,
          entryFee: spinWheel.entryFee,
          distributionBreakdown: {
            winnerPool: winnerAmount,
            adminPool: adminAmount,
            appPool: appAmount
          }
        }
      });

      await transaction.save({ session });

      await session.commitTransaction();

      loggers.transaction(
        'Entry fee paid',
        userId,
        -spinWheel.entryFee,
        {
          spinWheelId: spinWheel._id.toString(),
          newBalance: user.coinBalance,
          totalParticipants: spinWheel.participants.length
        }
      );

      return spinWheel;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Start spin wheel
   * @param spinWheelId - Spin wheel ID
   * @returns Updated spin wheel
   */
  static async startSpinWheel(spinWheelId: string): Promise<ISpinWheel> {
    const spinWheel = await SpinWheel.findById(spinWheelId);

    if (!spinWheel) {
      throw new NotFoundError('Spin wheel not found');
    }

    if (spinWheel.status !== SpinWheelStatus.WAITING) {
      throw new SpinWheelError('Spin wheel is not in waiting state');
    }

    if (spinWheel.participants.length < spinWheel.minParticipants) {
      throw new SpinWheelError(
        `Minimum ${spinWheel.minParticipants} participants required. Current: ${spinWheel.participants.length}`
      );
    }

    // Generate random elimination sequence
    const participantIds = spinWheel.participants.map((p) => p.userId);
    const shuffled = this.shuffleArray([...participantIds]);

    spinWheel.eliminationSequence = shuffled;
    spinWheel.currentEliminationIndex = 0;
    spinWheel.status = SpinWheelStatus.IN_PROGRESS;
    spinWheel.startedAt = new Date();

    await spinWheel.save();

    loggers.spinWheel('Started', spinWheel._id.toString(), {
      participants: spinWheel.participants.length,
      totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool,
      eliminationSequence: spinWheel.eliminationSequence.map(id => id.toString())
    });

    return spinWheel;
  }

  /**
   * Abort spin wheel and refund all participants
   * @param spinWheelId - Spin wheel ID
   * @returns Updated spin wheel
   */
  static async abortSpinWheel(spinWheelId: string): Promise<ISpinWheel> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const spinWheel = await SpinWheel.findById(spinWheelId).session(session);

      if (!spinWheel) {
        throw new NotFoundError('Spin wheel not found');
      }

      if (spinWheel.status !== SpinWheelStatus.WAITING) {
        throw new SpinWheelError('Can only abort waiting spin wheels');
      }

      // Refund all participants
      for (const participant of spinWheel.participants) {
        const user = await User.findById(participant.userId).session(session);

        if (user) {
          const balanceBefore = user.coinBalance;
          user.coinBalance += participant.entryFeePaid;
          await user.save({ session });

          // Create refund transaction
          const transaction = new Transaction({
            userId: participant.userId,
            name: participant.name,
            spinWheelId: spinWheel._id,
            type: TransactionType.REFUND,
            amount: participant.entryFeePaid,
            balanceBefore,
            balanceAfter: user.coinBalance,
            metadata: {
              reason: 'Spin wheel aborted - insufficient participants',
              originalEntryFee: participant.entryFeePaid
            }
          });

          await transaction.save({ session });

          loggers.transaction(
            'Refund issued',
            participant.userId.toString(),
            participant.entryFeePaid,
            { spinWheelId: spinWheel._id.toString() }
          );
        }
      }

      // Reset pools to zero
      spinWheel.winnerPool = 0;
      spinWheel.adminPool = 0;
      spinWheel.appPool = 0;
      spinWheel.status = SpinWheelStatus.ABORTED;
      spinWheel.completedAt = new Date();
      await spinWheel.save({ session });

      await session.commitTransaction();

      loggers.spinWheel('Aborted and refunded', spinWheel._id.toString(), {
        participantsRefunded: spinWheel.participants.length,
        totalRefunded: spinWheel.participants.reduce((sum, p) => sum + p.entryFeePaid, 0)
      });

      return spinWheel;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Eliminate next participant
   * @param spinWheelId - Spin wheel ID
   * @returns Updated spin wheel
   */
  static async eliminateNext(spinWheelId: string): Promise<ISpinWheel> {
    const spinWheel = await SpinWheel.findById(spinWheelId);

    if (!spinWheel) {
      throw new NotFoundError('Spin wheel not found');
    }

    if (spinWheel.status !== SpinWheelStatus.IN_PROGRESS) {
      throw new SpinWheelError('Spin wheel is not in progress');
    }

    if (spinWheel.currentEliminationIndex >= spinWheel.eliminationSequence.length) {
      throw new SpinWheelError('All eliminations completed');
    }

    // Get next user to eliminate
    const eliminatedUserId = spinWheel.eliminationSequence[spinWheel.currentEliminationIndex];

    // Find and update participant
    const participant = spinWheel.participants.find(
      (p) => p.userId.toString() === eliminatedUserId.toString()
    );

    if (participant) {
      participant.isEliminated = true;
      participant.eliminatedAt = new Date();
      participant.eliminationOrder = spinWheel.currentEliminationIndex + 1;
    }

    spinWheel.currentEliminationIndex++;

    // Check if this was the last elimination
    const remainingCount = spinWheel.participants.filter((p) => !p.isEliminated).length;

    if (remainingCount === 1) {
      // We have a winner!
      await this.completeSpinWheel(spinWheel);
    } else {
      await spinWheel.save();
    }

    loggers.spinWheel('Participant eliminated', spinWheel._id.toString(), {
      eliminatedUserId: eliminatedUserId.toString(),
      eliminationOrder: participant?.eliminationOrder,
      remainingCount
    });

    return spinWheel;
  }

  /**
   * Complete spin wheel and distribute prizes
   * @param spinWheel - Spin wheel document
   */
  private static async completeSpinWheel(spinWheel: ISpinWheel): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find winner
      const winner = spinWheel.participants.find((p) => !p.isEliminated);

      if (!winner) {
        throw new SpinWheelError('No winner found');
      }

      spinWheel.winnerId = winner.userId;
      spinWheel.winnerName = winner.name;
      spinWheel.status = SpinWheelStatus.COMPLETED;
      spinWheel.completedAt = new Date();

      // Credit winner
      const winnerUser = await User.findById(winner.userId).session(session);
      if (winnerUser) {
        const winnerBalanceBefore = winnerUser.coinBalance;
        winnerUser.coinBalance += spinWheel.winnerPool;
        await winnerUser.save({ session });

        const winnerTransaction = new Transaction({
          userId: winner.userId,
          name: winner.name,
          spinWheelId: spinWheel._id,
          type: TransactionType.PRIZE_WIN,
          amount: spinWheel.winnerPool,
          balanceBefore: winnerBalanceBefore,
          balanceAfter: winnerUser.coinBalance,
          metadata: {
            adminId: spinWheel.adminId,
            participants: spinWheel.participants.length,
            totalPrizePool: spinWheel.winnerPool,
            entryFee: spinWheel.entryFee
          }
        });

        await winnerTransaction.save({ session });

        loggers.transaction(
          'Prize won',
          winner.userId.toString(),
          spinWheel.winnerPool,
          { 
            spinWheelId: spinWheel._id.toString(),
            prizeAmount: spinWheel.winnerPool 
          }
        );
      }

      // Credit admin
      const adminUser = await User.findById(spinWheel.adminId).session(session);
      if (adminUser) {
        const adminBalanceBefore = adminUser.coinBalance;
        adminUser.coinBalance += spinWheel.adminPool;
        await adminUser.save({ session });

        const adminTransaction = new Transaction({
          userId: spinWheel.adminId,
          name: spinWheel.adminName,
          spinWheelId: spinWheel._id,
          type: TransactionType.ADMIN_COMMISSION,
          amount: spinWheel.adminPool,
          balanceBefore: adminBalanceBefore,
          balanceAfter: adminUser.coinBalance,
          metadata: {
            winnerId: winner.userId,
            winnerName: winner.name,
            participants: spinWheel.participants.length,
            commissionAmount: spinWheel.adminPool
          }
        });

        await adminTransaction.save({ session });

        loggers.transaction(
          'Admin commission',
          spinWheel.adminId.toString(),
          spinWheel.adminPool,
          { 
            spinWheelId: spinWheel._id.toString(),
            commissionAmount: spinWheel.adminPool 
          }
        );
      }

      // App pool is kept (not distributed to any user)
      // Create transaction record for app fee
      const appTransaction = new Transaction({
        userId: spinWheel.adminId, // Using admin as reference
        name: 'SYSTEM',
        spinWheelId: spinWheel._id,
        type: TransactionType.APP_FEE,
        amount: spinWheel.appPool,
        balanceBefore: 0,
        balanceAfter: 0,
        metadata: {
          appFeeAmount: spinWheel.appPool,
          participants: spinWheel.participants.length,
          winnerId: winner.userId,
          winnerName: winner.name
        }
      });

      await appTransaction.save({ session });

      await spinWheel.save({ session });
      await session.commitTransaction();

      loggers.spinWheel('Completed', spinWheel._id.toString(), {
        winnerId: winner.userId.toString(),
        winnerName: winner.name,
        winnerPrize: spinWheel.winnerPool,
        adminCommission: spinWheel.adminPool,
        appFee: spinWheel.appPool,
        totalParticipants: spinWheel.participants.length,
        totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get active spin wheel
   * @returns Active spin wheel or null
   */
  static async getActiveSpinWheel(): Promise<ISpinWheel | null> {
    return SpinWheel.findOne({
      status: { $in: [SpinWheelStatus.WAITING, SpinWheelStatus.IN_PROGRESS] }
    }).sort({ createdAt: -1 });
  }

  /**
   * Get spin wheel by ID
   * @param spinWheelId - Spin wheel ID
   * @returns Spin wheel
   */
  static async getSpinWheelById(spinWheelId: string): Promise<ISpinWheel> {
    const spinWheel = await SpinWheel.findById(spinWheelId);

    if (!spinWheel) {
      throw new NotFoundError('Spin wheel not found');
    }

    return spinWheel;
  }

  /**
   * Get spin wheel history with pagination
   * @param page - Page number
   * @param limit - Items per page
   * @param filters - Optional filters
   * @returns Paginated spin wheels
   */
  static async getSpinWheelHistory(
    page: number = 1,
    limit: number = 10,
    filters: any = {}
  ) {
    const skip = (page - 1) * limit;

    const [spinWheels, total] = await Promise.all([
      SpinWheel.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SpinWheel.countDocuments(filters)
    ]);

    return {
      spinWheels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user's spin wheel participation history
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns User's spin wheels
   */
  static async getUserSpinWheels(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const [spinWheels, total] = await Promise.all([
      SpinWheel.find({
        'participants.userId': userId
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SpinWheel.countDocuments({
        'participants.userId': userId
      })
    ]);

    return {
      spinWheels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Helper: Shuffle array (Fisher-Yates algorithm)
   * @param array - Array to shuffle
   * @returns Shuffled array
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Check if user can join spin wheel
   * @param spinWheelId - Spin wheel ID
   * @param userId - User ID
   * @returns Boolean indicating if user can join
   */
  static async canUserJoin(spinWheelId: string, userId: string): Promise<boolean> {
    const spinWheel = await SpinWheel.findById(spinWheelId);
    
    if (!spinWheel || spinWheel.status !== SpinWheelStatus.WAITING) {
      return false;
    }

    if (spinWheel.adminId.toString() === userId) {
      return false;
    }

    const alreadyJoined = spinWheel.participants.some(
      (p) => p.userId.toString() === userId
    );

    if (alreadyJoined) {
      return false;
    }

    if (spinWheel.participants.length >= spinWheel.maxParticipants) {
      return false;
    }

    return true;
  }

  /**
   * Get spin wheel statistics
   * @param spinWheelId - Spin wheel ID
   * @returns Spin wheel statistics
   */
  static async getSpinWheelStats(spinWheelId: string) {
    const spinWheel = await SpinWheel.findById(spinWheelId);

    if (!spinWheel) {
      throw new NotFoundError('Spin wheel not found');
    }

    const totalParticipants = spinWheel.participants.length;
    const eliminatedCount = spinWheel.participants.filter(p => p.isEliminated).length;
    const remainingCount = totalParticipants - eliminatedCount;
    const totalPool = spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool;

    return {
      status: spinWheel.status,
      totalParticipants,
      eliminatedCount,
      remainingCount,
      totalPool,
      winnerPool: spinWheel.winnerPool,
      adminPool: spinWheel.adminPool,
      appPool: spinWheel.appPool,
      entryFee: spinWheel.entryFee,
      winner: spinWheel.winnerId ? {
        userId: spinWheel.winnerId,
        name: spinWheel.winnerName
      } : null,
      createdAt: spinWheel.createdAt,
      startedAt: spinWheel.startedAt,
      completedAt: spinWheel.completedAt
    };
  }
}