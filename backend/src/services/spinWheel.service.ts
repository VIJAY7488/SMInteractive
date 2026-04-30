import mongoose, { ClientSession } from 'mongoose';
import SpinWheel, { ISpinWheel, SpinWheelStatus } from '../models/spin_wheels.models';
import User from '../models/user.models';
import Transaction, { TransactionType } from '../models/transaction.models';
import Config from '../models/config.models';
import {
  SpinWheelError,
  NotFoundError,
  InsufficientCoinsError,
  ConflictError,
} from '../utils/apiResponse';
import { loggers } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface SpinWheelHistoryFilters {
  status?: SpinWheelStatus;
  adminId?: string;
}

export class SpinWheelService {
  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Create a new spin wheel.
   * Uses findOneAndUpdate with upsert:false to prevent a race condition where two
   * admins both pass the initial findOne check simultaneously.
   */
  static async createSpinWheel(
    adminId: string,
    adminName: string,
    entryFee: number,
    maxParticipants: number
  ): Promise<ISpinWheel> {
    // Read distribution config from DB first, fall back to env, then defaults
    const winnerPoolPercentage = await SpinWheelService.getConfig('WINNER_POOL_PERCENTAGE', parseInt(process.env.WINNER_POOL_PERCENTAGE || '70'));
    const adminPoolPercentage = await SpinWheelService.getConfig('ADMIN_POOL_PERCENTAGE', parseInt(process.env.ADMIN_POOL_PERCENTAGE || '20'));
    const appPoolPercentage = await SpinWheelService.getConfig('APP_POOL_PERCENTAGE', parseInt(process.env.APP_POOL_PERCENTAGE || '10'));
    const autoStartTime = await SpinWheelService.getConfig('AUTO_START_TIMEOUT', parseInt(process.env.AUTO_START_TIMEOUT || '180000'));
    const eliminationInterval = await SpinWheelService.getConfig('ELIMINATION_INTERVAL', parseInt(process.env.ELIMINATION_INTERVAL || '7000'));
    const minParticipants = await SpinWheelService.getConfig('MIN_PARTICIPANTS', parseInt(process.env.MIN_PARTICIPANTS || '3'));

    if (winnerPoolPercentage + adminPoolPercentage + appPoolPercentage !== 100) {
      throw new SpinWheelError('Distribution percentages must sum to 100');
    }

    // Atomic guard: fail if any active wheel already exists
    const activeWheel = await SpinWheel.findOne({
      status: { $in: [SpinWheelStatus.WAITING, SpinWheelStatus.IN_PROGRESS] },
    });

    if (activeWheel) {
      throw new ConflictError('There is already an active spin wheel');
    }

    const spinWheel = new SpinWheel({
      adminId: new mongoose.Types.ObjectId(adminId),
      adminName,
      entryFee,
      winnerPoolPercentage,
      adminPoolPercentage,
      appPoolPercentage,
      autoStartTime,
      eliminationInterval,
      minParticipants,
      maxParticipants,
    });

    await spinWheel.save();

    loggers.spinWheel('Created', spinWheel._id.toString(), {
      adminId,
      adminName,
      entryFee,
      distribution: { winner: winnerPoolPercentage, admin: adminPoolPercentage, app: appPoolPercentage },
    });

    return spinWheel;
  }

  // ─── Join ──────────────────────────────────────────────────────────────────

  /**
   * Join a spin wheel.
   * Entire operation (balance check, deduction, pool update, transaction) runs
   * inside a single MongoDB session for atomicity.
   * Returns the updated spin wheel AND the new user balance.
   */
  static async joinSpinWheel(
    spinWheelId: string,
    userId: string,
    name: string
  ): Promise<{ spinWheel: ISpinWheel; newUserBalance: number }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Fetch spin wheel inside the session (read-your-writes guarantee)
      const spinWheel = await SpinWheel.findOne({
        _id: spinWheelId,
        status: SpinWheelStatus.WAITING,
      }).session(session);

      if (!spinWheel) {
        throw new NotFoundError('Spin wheel not found or already started');
      }

      // Business rule checks
      if (spinWheel.adminId.toString() === userId) {
        throw new SpinWheelError('Admin cannot join their own spin wheel');
      }

      const alreadyJoined = spinWheel.participants.some(
        (p) => p.userId.toString() === userId
      );
      if (alreadyJoined) {
        throw new ConflictError('You have already joined this spin wheel');
      }

      if (spinWheel.participants.length >= spinWheel.maxParticipants) {
        throw new SpinWheelError('Spin wheel is full');
      }

      // Fetch user inside the same session
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.coins < spinWheel.entryFee) {
        throw new InsufficientCoinsError(spinWheel.entryFee, user.coins);
      }

      // Calculate pool splits
      const winnerAmount = Math.round((spinWheel.entryFee * spinWheel.winnerPoolPercentage) / 100);
      const adminAmount = Math.round((spinWheel.entryFee * spinWheel.adminPoolPercentage) / 100);
      // Remainder goes to app pool to avoid floating-point drift
      const appAmount = spinWheel.entryFee - winnerAmount - adminAmount;

      // Update spin wheel
      spinWheel.winnerPool += winnerAmount;
      spinWheel.adminPool += adminAmount;
      spinWheel.appPool += appAmount;
      spinWheel.participants.push({
        userId: new mongoose.Types.ObjectId(userId),
        name,
        joinedAt: new Date(),
        entryFeePaid: spinWheel.entryFee,
        isEliminated: false,
      });
      await spinWheel.save({ session });

      // Deduct coins from user
      const balanceBefore = user.coins;
      user.coins -= spinWheel.entryFee;
      await user.save({ session });

      // Record transaction
      const transaction = new Transaction({
        userId: new mongoose.Types.ObjectId(userId),
        name,
        spinWheelId: spinWheel._id,
        type: TransactionType.ENTRY_FEE,
        amount: -spinWheel.entryFee,
        balanceBefore,
        balanceAfter: user.coins,
        status: 'completed',
        metadata: {
          distributionBreakdown: { winnerPool: winnerAmount, adminPool: adminAmount, appPool: appAmount },
        },
      });
      await transaction.save({ session });

      await session.commitTransaction();

      loggers.transaction('Entry fee paid', userId, -spinWheel.entryFee, {
        spinWheelId: spinWheel._id.toString(),
        newBalance: user.coins,
        totalParticipants: spinWheel.participants.length,
      });

      return { spinWheel, newUserBalance: user.coins };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── Start ─────────────────────────────────────────────────────────────────

  /**
   * Manually start a spin wheel (admin action).
   * Validates state and generates the elimination sequence.
   */
  static async startSpinWheel(spinWheelId: string): Promise<ISpinWheel> {
    const spinWheel = await SpinWheel.findById(spinWheelId);

    if (!spinWheel) {
      throw new NotFoundError('Spin wheel not found');
    }

    if (spinWheel.status !== SpinWheelStatus.WAITING) {
      throw new SpinWheelError(
        `Cannot start: spin wheel is already ${spinWheel.status}`
      );
    }

    if (spinWheel.participants.length < spinWheel.minParticipants) {
      throw new SpinWheelError(
        `Minimum ${spinWheel.minParticipants} participants required. ` +
        `Current: ${spinWheel.participants.length}`
      );
    }

    // Generate fair random elimination sequence (Fisher-Yates)
    const participantIds = spinWheel.participants.map((p) => p.userId);
    spinWheel.eliminationSequence = SpinWheelService.shuffleArray([...participantIds]);
    spinWheel.currentEliminationIndex = 0;
    spinWheel.status = SpinWheelStatus.IN_PROGRESS;
    spinWheel.startedAt = new Date();

    await spinWheel.save();

    loggers.spinWheel('Started (manual)', spinWheel._id.toString(), {
      participants: spinWheel.participants.length,
      totalPool: spinWheel.winnerPool + spinWheel.adminPool + spinWheel.appPool,
      eliminationSequence: spinWheel.eliminationSequence.map((id) => id.toString()),
    });

    return spinWheel;
  }

  // ─── Abort ─────────────────────────────────────────────────────────────────

  /**
   * Abort a WAITING spin wheel and refund all participants atomically.
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
        throw new SpinWheelError(
          `Cannot abort: spin wheel is ${spinWheel.status}. Only WAITING wheels can be aborted.`
        );
      }

      // Refund each participant
      for (const participant of spinWheel.participants) {
        const user = await User.findById(participant.userId).session(session);
        if (!user) continue; // Skip if user no longer exists

        const balanceBefore = user.coins;
        user.coins += participant.entryFeePaid;
        await user.save({ session });

        await new Transaction({
          userId: participant.userId,
          name: participant.name,
          spinWheelId: spinWheel._id,
          type: TransactionType.REFUND,
          amount: participant.entryFeePaid,
          balanceBefore,
          balanceAfter: user.coins,
          status: 'completed',
          metadata: {
            reason: 'Spin wheel aborted',
            originalEntryFee: participant.entryFeePaid,
          },
        }).save({ session });

        loggers.transaction('Refund issued', participant.userId.toString(), participant.entryFeePaid, {
          spinWheelId: spinWheel._id.toString(),
        });
      }

      // Mark wheel as aborted and zero-out pools
      spinWheel.winnerPool = 0;
      spinWheel.adminPool = 0;
      spinWheel.appPool = 0;
      spinWheel.status = SpinWheelStatus.ABORTED;
      spinWheel.completedAt = new Date();
      await spinWheel.save({ session });

      await session.commitTransaction();

      loggers.spinWheel('Aborted and refunded', spinWheel._id.toString(), {
        participantsRefunded: spinWheel.participants.length,
        totalRefunded: spinWheel.participants.reduce((s, p) => s + p.entryFeePaid, 0),
      });

      return spinWheel;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── Eliminate ─────────────────────────────────────────────────────────────

  /**
   * Atomically eliminate the next participant.
   * Uses findOneAndUpdate to prevent concurrent eliminations from producing
   * duplicate eliminations or a wrong winner.
   *
   * Returns the fully updated spin wheel document.
   */
  static async eliminateNext(spinWheelId: string): Promise<ISpinWheel> {
    // Atomically bump the index and get the current state in one round-trip.
    // This prevents two concurrent calls from processing the same index.
    const beforeUpdate = await SpinWheel.findOneAndUpdate(
      {
        _id: spinWheelId,
        status: SpinWheelStatus.IN_PROGRESS,
        // Only update if there are still eliminations left
        $expr: {
          $lt: ['$currentEliminationIndex', { $size: '$eliminationSequence' }],
        },
      },
      { $inc: { currentEliminationIndex: 1 } },
      { new: false } // Return the doc BEFORE the increment (so we know which index to eliminate)
    );

    if (!beforeUpdate) {
      // Either not found, not IN_PROGRESS, or all eliminations already done
      const spinWheel = await SpinWheel.findById(spinWheelId);
      if (!spinWheel) throw new NotFoundError('Spin wheel not found');
      if (spinWheel.status !== SpinWheelStatus.IN_PROGRESS) {
        throw new SpinWheelError('Spin wheel is not in progress');
      }
      throw new SpinWheelError('All eliminations have already been processed');
    }

    // The index we need to process is the value BEFORE the increment
    const indexToEliminate = beforeUpdate.currentEliminationIndex;
    const eliminatedUserId = beforeUpdate.eliminationSequence[indexToEliminate];

    // Mark the participant as eliminated
    await SpinWheel.updateOne(
      { _id: spinWheelId, 'participants.userId': eliminatedUserId },
      {
        $set: {
          'participants.$.isEliminated': true,
          'participants.$.eliminatedAt': new Date(),
          'participants.$.eliminationOrder': indexToEliminate + 1,
        },
      }
    );

    // Load the fresh document to determine remaining participants
    const updatedSpinWheel = await SpinWheel.findById(spinWheelId);
    if (!updatedSpinWheel) throw new NotFoundError('Spin wheel not found after update');

    const remainingCount = updatedSpinWheel.participants.filter((p) => !p.isEliminated).length;

    loggers.spinWheel('Participant eliminated', spinWheelId, {
      eliminatedUserId: eliminatedUserId.toString(),
      eliminationOrder: indexToEliminate + 1,
      remainingCount,
    });

    // If only 1 remains → complete the game
    if (remainingCount === 1) {
      await SpinWheelService.completeSpinWheel(updatedSpinWheel);
      // Reload after completion to return final state
      return (await SpinWheel.findById(spinWheelId))!;
    }

    return updatedSpinWheel;
  }

  // ─── Complete ──────────────────────────────────────────────────────────────

  /**
   * Distribute prizes and mark the spin wheel as COMPLETED.
   * All coin operations are wrapped in a single session.
   */
  private static async completeSpinWheel(spinWheel: ISpinWheel): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const winner = spinWheel.participants.find((p) => !p.isEliminated);
      if (!winner) throw new SpinWheelError('No winner found — no remaining participants');

      // Mark wheel as completed (within session)
      await SpinWheel.updateOne(
        { _id: spinWheel._id },
        {
          $set: {
            status: SpinWheelStatus.COMPLETED,
            winnerId: winner.userId,
            winnerName: winner.name,
            completedAt: new Date(),
          },
        },
        { session }
      );

      // Credit winner
      const winnerUser = await User.findById(winner.userId).session(session);
      if (winnerUser) {
        const winnerBalanceBefore = winnerUser.coins;
        winnerUser.coins += spinWheel.winnerPool;
        await winnerUser.save({ session });

        await new Transaction({
          userId: winner.userId,
          name: winner.name,
          spinWheelId: spinWheel._id,
          type: TransactionType.PRIZE_WIN,
          amount: spinWheel.winnerPool,
          balanceBefore: winnerBalanceBefore,
          balanceAfter: winnerUser.coins,
          status: 'completed',
          metadata: {
            participants: spinWheel.participants.length,
            totalPrizePool: spinWheel.winnerPool,
            entryFee: spinWheel.entryFee,
          },
        }).save({ session });

        loggers.transaction('Prize won', winner.userId.toString(), spinWheel.winnerPool, {
          spinWheelId: spinWheel._id.toString(),
        });
      }

      // Credit admin
      const adminUser = await User.findById(spinWheel.adminId).session(session);
      if (adminUser) {
        const adminBalanceBefore = adminUser.coins;
        adminUser.coins += spinWheel.adminPool;
        await adminUser.save({ session });

        await new Transaction({
          userId: spinWheel.adminId,
          name: spinWheel.adminName,
          spinWheelId: spinWheel._id,
          type: TransactionType.ADMIN_COMMISSION,
          amount: spinWheel.adminPool,
          balanceBefore: adminBalanceBefore,
          balanceAfter: adminUser.coins,
          status: 'completed',
          metadata: {
            winnerId: winner.userId,
            winnerName: winner.name,
            participants: spinWheel.participants.length,
            commissionAmount: spinWheel.adminPool,
          },
        }).save({ session });

        loggers.transaction('Admin commission', spinWheel.adminId.toString(), spinWheel.adminPool, {
          spinWheelId: spinWheel._id.toString(),
        });
      }

      // Record app fee (system entry — balance stays in app)
      await new Transaction({
        userId: spinWheel.adminId,
        name: 'SYSTEM',
        spinWheelId: spinWheel._id,
        type: TransactionType.APP_FEE,
        amount: spinWheel.appPool,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'completed',
        metadata: {
          appFeeAmount: spinWheel.appPool,
          participants: spinWheel.participants.length,
        },
      }).save({ session });

      await session.commitTransaction();

      loggers.spinWheel('Completed', spinWheel._id.toString(), {
        winnerId: winner.userId.toString(),
        winnerName: winner.name,
        winnerPrize: spinWheel.winnerPool,
        adminCommission: spinWheel.adminPool,
        appFee: spinWheel.appPool,
        totalParticipants: spinWheel.participants.length,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  static async getActiveSpinWheel(): Promise<ISpinWheel | null> {
    return SpinWheel.findOne({
      status: { $in: [SpinWheelStatus.WAITING, SpinWheelStatus.IN_PROGRESS] },
    }).sort({ createdAt: -1 });
  }

  static async getSpinWheelById(spinWheelId: string): Promise<ISpinWheel> {
    const spinWheel = await SpinWheel.findById(spinWheelId);
    if (!spinWheel) throw new NotFoundError('Spin wheel not found');
    return spinWheel;
  }

  static async getSpinWheelHistory(
    page: number = 1,
    limit: number = 10,
    filters: SpinWheelHistoryFilters = {}
  ): Promise<PaginationResult<ISpinWheel>> {
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.adminId) query.adminId = filters.adminId;

    const [data, total] = await Promise.all([
      SpinWheel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SpinWheel.countDocuments(query),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  static async getUserSpinWheels(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginationResult<ISpinWheel>> {
    const skip = (page - 1) * limit;
    const query = { 'participants.userId': new mongoose.Types.ObjectId(userId) };

    const [data, total] = await Promise.all([
      SpinWheel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SpinWheel.countDocuments(query),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  static async canUserJoin(spinWheelId: string, userId: string): Promise<boolean> {
    const spinWheel = await SpinWheel.findById(spinWheelId);
    if (!spinWheel || spinWheel.status !== SpinWheelStatus.WAITING) return false;
    if (spinWheel.adminId.toString() === userId) return false;
    if (spinWheel.participants.some((p) => p.userId.toString() === userId)) return false;
    if (spinWheel.participants.length >= spinWheel.maxParticipants) return false;
    return true;
  }

  static async getSpinWheelStats(spinWheelId: string) {
    const spinWheel = await SpinWheel.findById(spinWheelId);
    if (!spinWheel) throw new NotFoundError('Spin wheel not found');

    const totalParticipants = spinWheel.participants.length;
    const eliminatedCount = spinWheel.participants.filter((p) => p.isEliminated).length;
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
      winner: spinWheel.winnerId ? { userId: spinWheel.winnerId, name: spinWheel.winnerName } : null,
      createdAt: spinWheel.createdAt,
      startedAt: spinWheel.startedAt,
      completedAt: spinWheel.completedAt,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Fisher-Yates shuffle — cryptographically unbiased for game fairness */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Read a numeric config value from the Config DB collection.
   * Falls back to `defaultValue` if the key doesn't exist, is inactive,
   * or the DB read fails (so a bad Config entry can never crash the server).
   *
   * Config keys are stored in UPPER_CASE in MongoDB.
   * Example: key="WINNER_POOL_PERCENTAGE", value=70
   */
  private static async getConfig(key: string, defaultValue: number): Promise<number> {
    try {
      const record = await Config.findOne({ key: key.toUpperCase(), isActive: true });
      if (record && typeof record.value === 'number') {
        return record.value;
      }
      return defaultValue;
    } catch {
      // Never crash the service over a config read failure — fall back to default
      loggers.spinWheel(`Config read failed for ${key}, using default: ${defaultValue}`, 'system');
      return defaultValue;
    }
  }
}