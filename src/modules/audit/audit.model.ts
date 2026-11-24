import mongoose, { Schema, Model } from 'mongoose';

export interface IAuditLogDocument extends mongoose.Document {
  id: string;
  action: string;
  user: string;
  details: string;
  ip?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLogModel extends Model<IAuditLogDocument> {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    details: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: 'unknown',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as IAuditLogModel) ||
  mongoose.model<IAuditLogDocument, IAuditLogModel>('AuditLog', auditLogSchema);

export default AuditLog;
