import SpinWheel, { SpinWheelStatus } from '../models/spin_wheels.models';
import { SpinWheelService } from './spinWheel.service';
import { getSocketServer } from '../config/socket.config';
import { loggers } from '../utils/logger';

export class SpinWheelScheduler {
  private autoStartTimers: Map<string, NodeJS.Timeout> = new Map();
  private eliminationTimers: Map<string, NodeJS.Timeout> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize scheduler
   */
  public initialize(): void {
    // Check for pending spin wheels every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkPendingSpinWheels();
      this.checkActiveSpinWheels();
    }, 10000);

    // Initial check
    this.checkPendingSpinWheels();
    this.checkActiveSpinWheels();

    loggers.spinWheel('Scheduler initialized', "", {
      checkInterval: '10 seconds',
    });
  }

  /**
   * Check for spin wheels that need to be auto-started
   */
  private async checkPendingSpinWheels(): Promise<void> {
    try {
      const pendingSpinWheels = await SpinWheel.find({
        status: SpinWheelStatus.WAITING,
        autoStartAt: { $lte: new Date() },
      });

      for (const spinWheel of pendingSpinWheels) {
        await this.autoStartSpinWheel(spinWheel._id.toString());
      }
    } catch (error: any) {
      loggers.spinWheel('Error checking pending spin wheels', "", {
        error: error.message,
      });
    }
  }

  /**
   * Check for active spin wheels that need elimination processing
   */
  private async checkActiveSpinWheels(): Promise<void> {
    try {
      const activeSpinWheels = await SpinWheel.find({
        status: SpinWheelStatus.IN_PROGRESS,
      });

      for (const spinWheel of activeSpinWheels) {
        const spinWheelId = spinWheel._id.toString();

        // Check if elimination timer is already running
        if (!this.eliminationTimers.has(spinWheelId)) {
          // Start elimination process if not already running
          this.startEliminationProcess(spinWheelId);
        }
      }
    } catch (error: any) {
      loggers.spinWheel('Error checking active spin wheels', "", {
        error: error.message,
      });
    }
  }

  /**
   * Schedule auto-start for a spin wheel
   */
  public scheduleAutoStart(spinWheelId: string, autoStartAt: Date): void {
    // Clear existing timer if any
    this.clearAutoStartTimer(spinWheelId);

    const now = new Date();
    const delay = autoStartAt.getTime() - now.getTime();

    if (delay <= 0) {
      // Should start immediately
      this.autoStartSpinWheel(spinWheelId);
      return;
    }

    // Schedule auto-start
    const timer = setTimeout(() => {
      this.autoStartSpinWheel(spinWheelId);
    }, delay);

    this.autoStartTimers.set(spinWheelId, timer);

    loggers.spinWheel('Auto-start scheduled',
      spinWheelId,
     { autoStartAt: autoStartAt.toISOString(),
      delayMs: delay,
    });

    // Emit countdown updates every second for last 10 seconds
    if (delay <= 10000) {
      this.startCountdown(spinWheelId, delay);
    }
  }

  /**
   * Start countdown for last 10 seconds
   */
  private startCountdown(spinWheelId: string, initialDelay: number): void {
    let remainingSeconds = Math.ceil(initialDelay / 1000);
    const socketServer = getSocketServer();

    const countdownInterval = setInterval(() => {
      remainingSeconds--;

      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        return;
      }

      socketServer.emitToSpinWheel(spinWheelId, 'spinwheel:countdown', {
        spinWheelId,
        remainingSeconds,
        message: `Starting in ${remainingSeconds} seconds...`,
      });
    }, 1000);
  }

  /**
   * Auto-start a spin wheel
   */
  private async autoStartSpinWheel(spinWheelId: string): Promise<void> {
    try {
      const spinWheel = await SpinWheel.findById(spinWheelId);

      if (!spinWheel || spinWheel.status !== SpinWheelStatus.WAITING) {
        this.clearAutoStartTimer(spinWheelId);
        return;
      }

      // Check if minimum participants met
      if (spinWheel.participants.length < spinWheel.minParticipants) {
        loggers.spinWheel('Auto-start aborted - insufficient participants',
          spinWheelId,
          { participants: spinWheel.participants.length,
          minRequired: spinWheel.minParticipants,
        });

        // Abort and refund
        await SpinWheelService.abortSpinWheel(spinWheelId);

        // Emit abort event
        const socketServer = getSocketServer();
        socketServer.emitToSpinWheel(spinWheelId, 'spinwheel:aborted', {
          spinWheelId,
          reason: 'Insufficient participants',
          participantsRefunded: spinWheel.participants.length,
        });

        this.clearAutoStartTimer(spinWheelId);
        return;
      }

      // Start the spin wheel
      const startedSpinWheel = await SpinWheelService.startSpinWheel(spinWheelId);

      loggers.spinWheel('Auto-started spin wheel',
        spinWheelId, 
        { participants: startedSpinWheel.participants.length },
      );

      // Emit start event
      const socketServer = getSocketServer();
      socketServer.emitToSpinWheel(spinWheelId, 'spinwheel:started', {
        spinWheelId,
        status: startedSpinWheel.status,
        participants: startedSpinWheel.participants.length,
        eliminationSequence: startedSpinWheel.eliminationSequence,
        startedAt: startedSpinWheel.startedAt,
      });

      // Clear auto-start timer
      this.clearAutoStartTimer(spinWheelId);

      // Start elimination process
      this.startEliminationProcess(spinWheelId);
    } catch (error: any) {
      loggers.spinWheel('Error auto-starting spin wheel',
        spinWheelId, 
        { error: error.message },
      );
    }
  }

  /**
   * Start elimination process for a spin wheel
   */
  public startEliminationProcess(spinWheelId: string): void {
    // Clear existing timer if any
    this.clearEliminationTimer(spinWheelId);

    const eliminationInterval = parseInt(process.env.ELIMINATION_INTERVAL || '7000');

    const timer = setInterval(async () => {
      try {
        const spinWheel = await SpinWheel.findById(spinWheelId);

        if (!spinWheel || spinWheel.status !== SpinWheelStatus.IN_PROGRESS) {
          this.clearEliminationTimer(spinWheelId);
          return;
        }

        // Check if all eliminations are complete
        if (spinWheel.currentEliminationIndex >= spinWheel.eliminationSequence.length) {
          this.clearEliminationTimer(spinWheelId);
          return;
        }

        // Eliminate next participant
        const updatedSpinWheel = await SpinWheelService.eliminateNext(spinWheelId);

        // Emit elimination event
        const socketServer = getSocketServer();
        const eliminatedUserId = spinWheel.eliminationSequence[spinWheel.currentEliminationIndex];
        const eliminatedParticipant = spinWheel.participants.find(
          (p) => p.userId.toString() === eliminatedUserId.toString()
        );

        socketServer.emitToSpinWheel(spinWheelId, 'spinwheel:elimination', {
          spinWheelId,
          eliminatedUserId: eliminatedUserId.toString(),
          eliminatedUsername: eliminatedParticipant?.name,
          eliminationOrder: spinWheel.currentEliminationIndex + 1,
          remainingParticipants: updatedSpinWheel.participants.filter((p) => !p.isEliminated).length,
        });

        // Check if game is completed
        if (updatedSpinWheel.status === SpinWheelStatus.COMPLETED) {
          this.clearEliminationTimer(spinWheelId);

          // Emit completion event
          socketServer.emitToSpinWheel(spinWheelId, 'spinwheel:completed', {
            spinWheelId,
            winnerId: updatedSpinWheel.winnerId?.toString(),
            winnerName: updatedSpinWheel.winnerName,
            winnerPrize: updatedSpinWheel.winnerPool,
            adminCommission: updatedSpinWheel.adminPool,
            appFee: updatedSpinWheel.appPool,
            totalParticipants: updatedSpinWheel.participants.length,
            completedAt: updatedSpinWheel.completedAt,
          });

          // Notify winner specifically
          if (updatedSpinWheel.winnerId) {
            socketServer.emitToUser(updatedSpinWheel.winnerId.toString(), 'user:won', {
              spinWheelId,
              prizeAmount: updatedSpinWheel.winnerPool,
              message: `Congratulations! You won ${updatedSpinWheel.winnerPool} coins!`,
            });
          }

          loggers.spinWheel('Spin wheel completed',
            spinWheelId,
            { winnerId: updatedSpinWheel.winnerId?.toString(),
              winnerPrize: updatedSpinWheel.winnerPool },
          );
        }
      } catch (error: any) {
        loggers.spinWheel('Error in elimination process',
          spinWheelId, {
            error: error.message,
          });
      }
    }, eliminationInterval);

    this.eliminationTimers.set(spinWheelId, timer);

    loggers.spinWheel('Elimination process started', 
      spinWheelId,
      { intervalMs: eliminationInterval },
    );
  }

  /**
   * Clear auto-start timer
   */
  public clearAutoStartTimer(spinWheelId: string): void {
    const timer = this.autoStartTimers.get(spinWheelId);
    if (timer) {
      clearTimeout(timer);
      this.autoStartTimers.delete(spinWheelId);
      loggers.spinWheel('Auto-start timer cleared', "", spinWheelId);
    }
  }

  /**
   * Clear elimination timer
   */
  public clearEliminationTimer(spinWheelId: string): void {
    const timer = this.eliminationTimers.get(spinWheelId);
    if (timer) {
      clearInterval(timer);
      this.eliminationTimers.delete(spinWheelId);
      loggers.spinWheel('Elimination timer cleared', "", spinWheelId);
    }
  }

  /**
   * Stop all timers
   */
  public stopAll(): void {
    // Clear all auto-start timers
    this.autoStartTimers.forEach((timer, spinWheelId) => {
      clearTimeout(timer);
      loggers.spinWheel('Auto-start timer stopped', "", spinWheelId);
    });
    this.autoStartTimers.clear();

    // Clear all elimination timers
    this.eliminationTimers.forEach((timer, spinWheelId) => {
      clearInterval(timer);
      loggers.spinWheel('Elimination timer stopped', "", spinWheelId);
    });
    this.eliminationTimers.clear();

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    loggers.spinWheel('All scheduler timers stopped', "");
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    activeAutoStartTimers: number;
    activeEliminationTimers: number;
    isRunning: boolean;
  } {
    return {
      activeAutoStartTimers: this.autoStartTimers.size,
      activeEliminationTimers: this.eliminationTimers.size,
      isRunning: this.checkInterval !== null,
    };
  }
}

// Singleton instance
let schedulerInstance: SpinWheelScheduler | null = null;

export const getScheduler = (): SpinWheelScheduler => {
  if (!schedulerInstance) {
    schedulerInstance = new SpinWheelScheduler();
  }
  return schedulerInstance;
};

export default { getScheduler };