import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConfig extends Document {
  key: string; 
  value: any;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}


const ConfigSchema = new Schema<IConfig>(
  {
    key: { 
      type: String, 
      required: [true, "Config key is required"], 
      unique: true,
      trim: true,
      uppercase: true
    },
    value: { 
      type: Object, 
      required: [true, "Config value is required"] 
    },
    type: { 
      type: String,
      enum: ["string", "number", "boolean", "object", "array"],
      required: true
    },
    description: { 
      type: String 
    },
    isActive: { 
      type: Boolean, 
      default: true
    },
  },
  { timestamps: true } 
);

// Index to optimize key-based lookups
ConfigSchema.index({ key: 1 });
ConfigSchema.index({ isActive: 1 });

const Config = mongoose.model<IConfig>(
  "Config",
  ConfigSchema
);

export default Config;
