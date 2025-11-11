import mongoose, { Schema, Document, Types } from "mongoose";


export enum TransactionType {
  ENTRY_FEE = 'entry_fee',
  PRIZE_WIN = 'prize_win',
  ADMIN_COMMISSION = 'admin_commission',
  REFUND = 'refund',
  APP_FEE = 'app_fee'
}

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  name: string;
  spinWheelId: Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: "pending" | "completed" | "failed" | "refunded";
  description?: string;
  metadata?: {
    winnerPoolAmount?: number;
    adminPoolAmount?: number;
    appPoolAmount?: number;
    reason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { 
      type: Schema.Types.ObjectId,
       ref: "User", 
       required: [true, "User ID is required"],
       index: true
    },
    spinWheelId: { 
      type: Schema.Types.ObjectId, 
      ref: "SpinWheel", 
      required: [true, "Spin Wheel ID is required"],
      index: true
    },
    type: {
      type: String,
      enum: ["entry_fee", "prize_win", "admin_commission", "refund", "app_fee"],
      required: [true, "Transaction type is required"],
    },
    amount: { 
      type: Number, 
      required: [true, "Amount is required"] 
    },
    balanceBefore: { 
      type: Number, 
      required: [true, "Balance before is required"] 
    },
    balanceAfter: { 
      type: Number, 
      required: [true, "Balance after is required"] 
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    description: { 
      type: String,
    },
    metadata: {
      winnerPoolAmount: { type: Number },
      adminPoolAmount: { type: Number },
      appPoolAmount: { type: Number },
      reason: { type: String },
    },
  },
  { timestamps: true } 
);

// Indexes to optimize queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ spinWheelId: 1, type: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });

const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  transactionSchema
);

export default Transaction;