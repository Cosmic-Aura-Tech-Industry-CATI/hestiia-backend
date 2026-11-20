import { AuditLogModel } from '@/models/AuditLog.model';
import { connectDB } from './mongodb';

/**
 * Persist a structured audit event into MongoDB.
 */
export async function logAudit(
  action: string,
  user: string,
  details: string,
  ip?: string
): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      user,
      details,
      ip,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}
