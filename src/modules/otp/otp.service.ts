import crypto from 'crypto';
import { AppError } from '../../shared/utils/appError.js';
import { emailService } from '../../shared/services/email.service.js';
import { IOtpRepository, IOtpService, OtpType } from './otp.interface.js';
import { otpRepository as defaultOtpRepository } from './otp.repository.js';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 3))}${name.slice(-1)}@${domain}`;
}

export class OtpService implements IOtpService {
  constructor(private readonly otpRepo: IOtpRepository = defaultOtpRepository) { }

  async generateAndSendOtp(
    userId: string,
    email: string,
    otpType: OtpType,
    recipientName = 'Staff Member'
  ): Promise<{
    otpSessionId: string;
    maskedEmail: string;
    expiresInSeconds: number;
    message: string;
    devOtp?: string;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Remove previously active OTPs for this email and type to prevent race conditions
    try {
      await this.otpRepo.deleteExistingOtps(normalizedEmail, otpType);
    } catch (err: any) {
      console.warn(`[OtpService] Warning during cleanup of old OTPs:`, err?.message);
    }

    // 2. Generate a secure 6-digit cryptographic random OTP
    const plainOtp = crypto.randomInt(100000, 1000000).toString();

    // 3. Save to MongoDB Atlas (Pre-save hook in Otp model will SHA-256 hash it)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    let createdRecordId = '';
    try {
      const created = await this.otpRepo.createOtp({
        userId,
        email: normalizedEmail,
        otpCode: plainOtp,
        otpType,
        isVerified: false,
        attempts: 0,
        expiresAt,
      });
      createdRecordId = created._id ? String(created._id) : '';
    } catch (dbErr: any) {
      console.error('[OtpService] Failed to persist OTP to database:', dbErr);
      throw new AppError('Unable to generate authentication code. Database error.', 500);
    }

    // 4. Dispatch OTP via Resend email service
    try {
      await emailService.sendOtpEmail({
        to: normalizedEmail,
        recipientName,
        otp: plainOtp,
        purpose: otpType,
        expiresInMinutes: 10,
      });
    } catch (emailErr: any) {
      if (createdRecordId) {
        await this.otpRepo.deleteOtpById(createdRecordId).catch(() => { });
      }
      console.error('[OtpService] Failed to dispatch OTP email:', emailErr);
      throw new AppError('Failed to dispatch authentication code. Please try again.', 500);
    }

    const masked = maskEmail(normalizedEmail);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] Development verification code for ${masked}: ${plainOtp}`);
    }

    return {
      otpSessionId: createdRecordId || `otp_${Date.now()}`,
      maskedEmail: masked,
      expiresInSeconds: 600,
      message: `A 6-digit verification code has been dispatched to ${masked}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? plainOtp : undefined,
    };
  }

  async verifyOtp(email: string, otpCode: string, otpType: OtpType): Promise<boolean> {
    if (!email || !otpCode) {
      throw new AppError('Email and OTP code are required.', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = otpCode.trim();

    // 1. Retrieve the latest OTP document from MongoDB
    const otpRecord = await this.otpRepo.findOtpRecord(normalizedEmail, otpType);

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP. Please request a new verification code.', 400);
    }

    // 2. Check if expired
    if (otpRecord.isExpired()) {
      await this.otpRepo.deleteOtpById(String(otpRecord._id));
      throw new AppError('Verification code has expired. Please request a new code.', 400);
    }

    // 3. Compare candidate code with hashed code
    const isMatch = await otpRecord.compareOtp(cleanCode);

    if (!isMatch) {
      await otpRecord.incrementAttempts();
      const remaining = 5 - otpRecord.attempts;
      throw new AppError(`Incorrect verification code. ${remaining} attempt(s) remaining.`, 400);
    }

    // 4. Mark verified and delete OTP document to prevent replay attacks
    await this.otpRepo.deleteOtpById(String(otpRecord._id));

    return true;
  }
}

export const otpService = new OtpService();
export default otpService;
