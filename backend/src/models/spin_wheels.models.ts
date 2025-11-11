import mongoose, { Schema, Document, Types } from "mongoose";

export interface IParticipant {
  userId: Types.ObjectId;  // Keeping userId for your preference
  name: string;        // ADDED: Name cache for performance
  joinedAt: Date;
  entryFeePaid: number;    // ADDED: Track individual entry fee paid
  isEliminated: boolean;
  eliminatedAt?: Date;
  eliminationOrder?: number; // ADDED: Track order of elimination (1, 2, 3...)
  position?: number;
}

export enum SpinWheelStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABORTED = 'aborted'
}

export interface ISpinWheel extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  adminName: string;   // ADDED: Admin username cache
  status: SpinWheelStatus;
  entryFee: number;
  participants: IParticipant[];
  maxParticipants: number;
  minParticipants: number;

  // Coins pools
  winnerPool: number;
  adminPool: number;  
  appPool: number;

  // Distribution percentages
  winnerPoolPercentage: number;
  adminPoolPercentage: number;
  appPoolPercentage: number;

  // Time tracking
  autoStartTime: number;      // ADDED: Auto-start timeout in ms
  eliminationInterval: number; // ADDED: Interval between eliminations in ms
  autoStartAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Results
  winnerId?: Types.ObjectId;
  winnerUsername?: string;    // ADDED: Winner username cache
  eliminationSequence: Types.ObjectId[];
  currentEliminationIndex: number; // ADDED: Track current elimination progress

  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", 
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },
    joinedAt: { 
      type: Date, 
      default: Date.now 
    },
    entryFeePaid: {
      type: Number,
      required: [true, "Entry fee paid is required"],
      min: [0, "Entry fee cannot be negative"]
    },
    isEliminated: { 
      type: Boolean, 
      default: false 
    },
    eliminatedAt: { 
      type: Date 
    },
    eliminationOrder: {
      type: Number,
      min: [1, "Elimination order must be at least 1"]
    },
    position: { 
      type: Number 
    },
  },
  { _id: false }
);

const SpinWheelSchema = new Schema<ISpinWheel>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User", 
      required: [true, "Admin is required"],
      index: true
    },
    adminName: {
      type: String,
      required: [true, "Admin name is required"],
      trim: true
    },
    entryFee: {
      type: Number,
      required: [true, "Entry fee is required"],
      min: [1, "Entry fee must be at least 1 coin"],
    },
    status: {
      type: String,
      enum: Object.values(SpinWheelStatus),
      default: SpinWheelStatus.WAITING,
      index: true,
    },
    participants: { 
      type: [ParticipantSchema], 
      default: [] 
    },
    maxParticipants: {
      type: Number,
      default: 100,
      min: [3, "Max participants must be at least 3"],
    },
    minParticipants: {
      type: Number,
      default: 3,
      min: [3, "Min participants must be at least 3"],
    },
    winnerPool: { 
      type: Number, 
      default: 0,
      min: [0, "Winner pool cannot be negative"],
    },
    adminPool: { 
      type: Number,
      default: 0,
      min: [0, "Admin pool cannot be negative"],
    },
    appPool: { 
      type: Number,
      default: 0,
      min: [0, "App pool cannot be negative"],
    },
    winnerPoolPercentage: { 
      type: Number, 
      required: true,
      min: [0, "Winner pool percentage cannot be negative"],
      max: [100, "Winner pool percentage cannot exceed 100"],
    },
    adminPoolPercentage: { 
      type: Number, 
      required: true,
      min: [0, "Admin pool percentage cannot be negative"],
      max: [100, "Admin pool percentage cannot exceed 100"],
    },
    appPoolPercentage: { 
      type: Number, 
      required: true,
      min: [0, "App pool percentage cannot be negative"],
      max: [100, "App pool percentage cannot exceed 100"],
    },
    autoStartTime: {
      type: Number,
      default: 180000, // 3 minutes in milliseconds
      min: [0, "Auto start time cannot be negative"]
    },
    eliminationInterval: {
      type: Number,
      default: 7000, // 7 seconds in milliseconds
      min: [1000, "Elimination interval must be at least 1 second"]
    },
    autoStartAt: { 
      type: Date 
    },
    startedAt: { 
      type: Date 
    },
    completedAt: { 
      type: Date 
    },
    winnerId: { 
      type: Schema.Types.ObjectId, 
      ref: "User" 
    },
    winnerUsername: {
      type: String,
      trim: true
    },
    eliminationSequence: [{ 
      type: Schema.Types.ObjectId, 
      ref: "User" 
    }],
    currentEliminationIndex: {
      type: Number,
      default: 0,
      min: [0, "Current elimination index cannot be negative"]
    },
  },
  { timestamps: true }
);

// Indexes to optimize queries
SpinWheelSchema.index({ status: 1, createdAt: -1 });
SpinWheelSchema.index({ adminId: 1, status: 1 });
SpinWheelSchema.index({ 'participants.userId': 1 });
SpinWheelSchema.index({ winnerId: 1 });

// Validation to ensure percentages sum to 100
SpinWheelSchema.pre<ISpinWheel>("save", function (next) {
  const totalPercentage = this.winnerPoolPercentage + this.adminPoolPercentage + this.appPoolPercentage;

  if (Math.abs(totalPercentage - 100) > 0.01) {
    return next(new Error("Total percentage must equal 100"));
  }
  next();
});

// Auto-set autoStartAt when spin wheel is created in WAITING status
SpinWheelSchema.pre<ISpinWheel>("save", function (next) {
  if (this.isNew && this.status === SpinWheelStatus.WAITING && !this.autoStartAt) {
    this.autoStartAt = new Date(Date.now() + this.autoStartTime);
  }
  next();
});

const SpinWheel = mongoose.model<ISpinWheel>("SpinWheel", SpinWheelSchema);

export default SpinWheel;