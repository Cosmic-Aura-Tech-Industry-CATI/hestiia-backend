import Otp from './otp.model.js';
import { IOtp, IOtpDocument, IOtpRepository, OtpType } from './otp.interface.js';

export class OtpRepository implements IOtpRepository {
  async createOtp(otpData: Partial<IOtp>): Promise<IOtpDocument> {
    const newOtp = new Otp(otpData);
    return await newOtp.save();
  }

  async findOtpRecord(email: string, otpType: OtpType): Promise<IOtpDocument | null> {
    return await Otp.findOne({
      email: email.toLowerCase().trim(),
      otpType,
    })
      .select('+otpCode')
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteExistingOtps(email: string, otpType: OtpType): Promise<void> {
    await Otp.deleteMany({
      email: email.toLowerCase().trim(),
      otpType,
    }).exec();
  }

  async deleteOtpById(id: string): Promise<void> {
    await Otp.findByIdAndDelete(id).exec();
  }
}

export const otpRepository = new OtpRepository();
export default otpRepository;
