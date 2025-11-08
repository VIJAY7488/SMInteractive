import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICoinLedger extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  transactionId: Types.ObjectId;
  debit: number;     // coins deducted
  credit: number;    // coins added
  balance: number;   // running balance after this entry
  createdAt: Date;
}

const coinLedgerSchema = new Schema<ICoinLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const CoinLedger = mongoose.model<ICoinLedger>("CoinLedger", coinLedgerSchema);
