import mongoose, { Schema, Model } from 'mongoose';

export interface ILoginAttempt {
  key: string;
  count: number;
  lockUntil: number;
  expiresAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  lockUntil: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const LoginAttemptModel: Model<ILoginAttempt> =
  mongoose.models.LoginAttempt ||
  mongoose.model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);
