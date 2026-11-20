import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IAuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  ip?: string;
  timestamp: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
  id: { type: String, required: true, unique: true, index: true },
  action: { type: String, required: true, index: true },
  user: { type: String, required: true },
  details: { type: String, required: true },
  ip: { type: String },
  timestamp: { type: String, required: true, index: true },
});

applyCleanTransform(AuditLogSchema);

export const AuditLogModel: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
