import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISystemConfig extends Document {
  _id: Types.ObjectId;
  key: string; // e.g. 'coin_distribution', 'game_rules'
  value: Record<string, any>; // flexible JSON object
  updatedAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false } // only manual updatedAt
);

export const SystemConfig = mongoose.model<ISystemConfig>(
  "SystemConfig",
  systemConfigSchema
);
