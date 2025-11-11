import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';


export interface IUser extends Document {
_id: mongoose.Types.ObjectId;
name: string;
email: string;
password: string;
role: 'admin' | 'user';
coins: number;
isActive: boolean;
lastLogin?: Date;
createdAt: Date;
updatedAt: Date;
comparePassword(candidatePassword: string): Promise<boolean>;
}


const UserSchema = new Schema<IUser>({
name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [30, 'Name cannot exceed 30 characters'],
},
email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
},
password: { 
    type: String, 
    required: [true, 'Password is required'], 
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
},
role: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'user' 
},
coins: { 
    type: Number, 
    default: 1000,
    min: [0, 'Coins cannot be negative'],
},
isActive: {
    type: Boolean,
    default: true
},
lastLogin: {
    type: Date,
    default: Date.now
},
}, { timestamps: true
});

// Index for email and role to optimize queries
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Remove password field when converting to JSON
UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model<IUser>('User', UserSchema);

export default User;