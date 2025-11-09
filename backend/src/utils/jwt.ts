import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';


interface TokenPayload {
    userId: string;
    role: string;
}


export const generateAccessToken = (userId: Types.ObjectId, role: string): string => {
    const payload: TokenPayload = {
        userId: userId.toString(),
        role,
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '7d' });
};

export const generateRefreshToken = (userId: Types.ObjectId): string => {
    return jwt.sign({ userId: userId.toString() }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' });
};


export const verifyRefreshToken = (token: string): string => {
    try {
        const decoded = jwt.verify(token, 
            process.env.JWT_REFRESH_SECRET as string
        ) as { userId: string };
        return decoded.userId;
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
};