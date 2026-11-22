import crypto from 'crypto';
import mongoose, { Schema, Model } from 'mongoose';
import { IOtpDocument } from './otp.interface.js';
import { AppError } from '../../shared/utils/appError.js';

export interface IOtpModel extends Model<IOtpDocument> {}

const otpSchema = new Schema<IOtpDocument>(
  {
    userId: {
      type: Schema.Types.Mixed,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required for OTP authentication'],
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    otpCode: {
      type: String,
      required: true,
      select: false,
    },
    otpType: {
      type: String,
      enum: ['LOGIN_2FA', 'FORGOT_PASSWORD'],
      required: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      index: { expires: 0 }, // TTL index: MongoDB deletes expired documents automatically
    },
  },
  {
    timestamps: true,
  }
);

// Hash the plain OTP with SHA-256 before saving to MongoDB
otpSchema.pre('save', function () {
  if (this.isModified('otpCode') && this.otpCode) {
    const isAlreadyHashed = /^[a-f0-9]{64}$/i.test(this.otpCode);
    if (!isAlreadyHashed) {
      this.otpCode = crypto.createHash('sha256').update(this.otpCode).digest('hex');
    }
  }
});

otpSchema.methods.compareOtp = async function (candidateOtp: string): Promise<boolean> {
  const hashedCandidateOtp = crypto.createHash('sha256').update(candidateOtp.trim()).digest('hex');
  return this.otpCode === hashedCandidateOtp;
};

otpSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

otpSchema.methods.incrementAttempts = async function (): Promise<void> {
  this.attempts += 1;
  await this.save({ validateBeforeSave: false });

  if (this.attempts >= 5) {
    throw new AppError('Too many incorrect OTP attempts. Please request a new verification code.', 429);
  }
};

export const Otp = (mongoose.models.Otp as IOtpModel) || mongoose.model<IOtpDocument, IOtpModel>('Otp', otpSchema);
export default Otp;
