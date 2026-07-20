import mongoose, { Document, Schema } from 'mongoose';
import type { OtpPurpose } from '../services/appwriteAuth';

export interface IOtpVerification extends Document {
  phone: string;
  codeHash?: string;
  appwriteUserId?: string;
  purpose?: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  smsSentAt?: Date;
  verifiedAt?: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtpVerification>(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
    },
    appwriteUserId: String,
    purpose: {
      type: String,
      enum: [
        'signup',
        'login',
        'technician_signup',
        'technician_login',
        'forgot_password',
      ],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    smsSentAt: Date,
    verifiedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const OtpVerification = mongoose.model<IOtpVerification>(
  'OtpVerification',
  otpSchema
);
