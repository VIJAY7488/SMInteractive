import mongoose, { Schema, Document, Types } from "mongoose";

export interface IParticipant {
  userId: Types.ObjectId;
  joinedAt: Date;
  eliminated: boolean;
  eliminatedAt?: Date;
  position?: number;
}

export interface IDistributionConfig {
  winnerPercentage: number;
  adminPercentage: number;
  appPercentage: number;
}

export interface IGame extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  status: "pending" | "active" | "spinning" | "completed" | "aborted";
  entryFee: number;

  participants: IParticipant[];

  winnerPool: number;
  adminPool: number;
  appPool: number;

  distributionConfig: IDistributionConfig;

  eliminationSequence: Types.ObjectId[];
  currentEliminationIndex: number;
  winnerId?: Types.ObjectId;

  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  autoStartScheduledAt?: Date;

  minParticipants: number;
  eliminationInterval: number;
  autoStartDelay: number;
}

const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    eliminated: { type: Boolean, default: false },
    eliminatedAt: { type: Date },
    position: { type: Number },
  },
  { _id: false }
);

const distributionConfigSchema = new Schema<IDistributionConfig>(
  {
    winnerPercentage: { type: Number, required: true },
    adminPercentage: { type: Number, required: true },
    appPercentage: { type: Number, required: true },
  },
  { _id: false }
);

const gameSchema = new Schema<IGame>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "active", "spinning", "completed", "aborted"],
      default: "pending",
    },
    entryFee: { type: Number, required: true },

    participants: [participantSchema],

    winnerPool: { type: Number, default: 0 },
    adminPool: { type: Number, default: 0 },
    appPool: { type: Number, default: 0 },

    distributionConfig: { type: distributionConfigSchema, required: true },

    eliminationSequence: [{ type: Schema.Types.ObjectId, ref: "User" }],
    currentEliminationIndex: { type: Number, default: 0 },
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },

    createdAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    autoStartScheduledAt: { type: Date },

    minParticipants: { type: Number, default: 3 },
    eliminationInterval: { type: Number, default: 7000 },
    autoStartDelay: { type: Number, default: 180000 },
  },
  { timestamps: true }
);

export const Game = mongoose.model<IGame>("Game", gameSchema);
