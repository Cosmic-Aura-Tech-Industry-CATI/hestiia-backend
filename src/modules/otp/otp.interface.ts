import { Document } from 'mongoose';

export type OtpType = 'LOGIN_2FA' | 'FORGOT_PASSWORD';

export interface IOtp {
  userId?: string;
  email: string;
  phone?: string;
  otpCode: string;
  otpType: OtpType;
  isVerified: boolean;
  attempts: number;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOtpDocument extends Document {
  userId?: string;
  email: string;
  phone?: string;
  otpCode: string;
  otpType: OtpType;
  isVerified: boolean;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  compareOtp(candidateOtp: string): Promise<boolean>;
  isExpired(): boolean;
  incrementAttempts(): Promise<void>;
}

export interface IOtpRepository {
  createOtp(otpData: Partial<IOtp>): Promise<IOtpDocument>;
  findOtpRecord(email: string, otpType: OtpType): Promise<IOtpDocument | null>;
  deleteExistingOtps(email: string, otpType: OtpType): Promise<void>;
  deleteOtpById(id: string): Promise<void>;
}

export interface IOtpService {
  generateAndSendOtp(
    userId: string,
    email: string,
    otpType: OtpType,
    recipientName?: string
  ): Promise<{
    otpSessionId: string;
    maskedEmail: string;
    expiresInSeconds: number;
    message: string;
    devOtp?: string;
  }>;

  verifyOtp(email: string, otpCode: string, otpType: OtpType): Promise<boolean>;
}
