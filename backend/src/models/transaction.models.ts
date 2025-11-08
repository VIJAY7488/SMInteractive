import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  spinWheelId: Types.ObjectId;
  type: "entry_fee" | "refund" | "winner_payout" | "admin_payout";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  metadata?: Record<string, any>;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    spinWheelId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
    type: {
      type: String,
      enum: ["entry_fee", "refund", "winner_payout", "admin_payout"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    metadata: { type: Object },
  },
  { timestamps: false } // we already track createdAt manually
);

export const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  transactionSchema
);
