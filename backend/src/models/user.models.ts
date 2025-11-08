import { Schema, model } from 'mongoose';


export interface IUser {
email: string;
password: string;
role: 'admin' | 'user';
coins: number;
createdAt?: Date;
}


const userSchema = new Schema<IUser>({
email: { type: String, required: true, unique: true },
password: { type: String, required: true },
role: { type: String, enum: ['admin', 'user'], default: 'user' },
coins: { type: Number, default: 0 },
createdAt: { type: Date, default: Date.now }
});


export const User = model<IUser>('User', userSchema);