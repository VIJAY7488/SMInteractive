import { stat } from "fs";
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IParticipant {
  userId: Types.ObjectId;
  joinedAt: Date;
  isEliminated: boolean;
  eliminatedAt?: Date;
  position?: number;
}


export interface ISpinWheel extends Document {
  adminId: Types.ObjectId;
  status: "pending" | "active" | "completed" | "aborted";
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
  autoStartAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Results
  winnerId?: Types.ObjectId;
  eliminationSequence: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}


const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", 
      required: true
    },
    joinedAt: { 
      type: Date, 
      default: Date.now 
    },
    isEliminated: { 
      type: Boolean, 
      default: false 
    },
    eliminatedAt: { type: Date },
    position: { type: Number },
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
    entryFee: {
      type: Number,
      required: [true, "Entry fee is required"],
      min: [1, "Entry fee must be at least 1 coin"],
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "aborted"],
      default: "pending",
      index: true,
    },
    participants: { type: [ParticipantSchema], default: [] },
    maxParticipants: {
      type: Number,
      default: 10,
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
    autoStartAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },
    eliminationSequence: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Indexes to optimize queries
SpinWheelSchema.index({ status: 1, createdAt: -1 });
SpinWheelSchema.index({ adminId: 1, status: 1 });
SpinWheelSchema.index({ 'participants.userId': 1 });

// Validation to ensure percentages sum to 100
SpinWheelSchema.pre<ISpinWheel>("save", function (next) {
  const totalPercentage = this.winnerPoolPercentage + this.adminPoolPercentage + this.appPoolPercentage;

  if (Math.abs(totalPercentage - 100) > 0.01) {
    return next(new Error("Total percentage must equal 100"));
  }
  else {
    next();
  }
});

const SpinWheel = mongoose.model<ISpinWheel>("SpinWheel", SpinWheelSchema);

export default SpinWheel;


