import mongoose from 'mongoose';
import { db } from '../../shared/config/store.js';
import { AuditLog, type IAuditLogDocument } from './audit.model.js';

export const auditService = {
  async getStatus() {
    return { module: 'audit', status: 'operational', timestamp: new Date().toISOString() };
  },

  async getAuditLogs(query: any) {
    const { search, action, user, startDate, endDate, page = '1', limit = '50' } = query;
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 50;

    // 1. Direct MongoDB Atlas Query
    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (action && action !== 'all') {
          filter.action = action;
        }
        if (user && user !== 'all') {
          filter.user = { $regex: String(user).trim(), $options: 'i' };
        }
        if (startDate || endDate) {
          filter.timestamp = {};
          if (startDate) filter.timestamp.$gte = new Date(startDate);
          if (endDate) filter.timestamp.$lte = new Date(endDate);
        }
        if (search && String(search).trim()) {
          const q = String(search).trim();
          filter.$or = [
            { action: { $regex: q, $options: 'i' } },
            { user: { $regex: q, $options: 'i' } },
            { details: { $regex: q, $options: 'i' } },
            { ip: { $regex: q, $options: 'i' } },
          ];
        }

        const [total, logs] = await Promise.all([
          AuditLog.countDocuments(filter),
          AuditLog.find(filter)
            .sort({ timestamp: -1, createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        ]);

        if (total > 0 || !search) {
          return {
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            logs,
          };
        }
      } catch (err: any) {
        console.warn(`[AuditService] MongoDB query failed, falling back to local store: ${err?.message}`);
      }
    }

    // 2. Resilient In-Memory Fallback
    let logs = [...db.getState().auditLogs];

    if (action && action !== 'all') {
      logs = logs.filter((l) => l.action === action);
    }
    if (user && user !== 'all') {
      const u = String(user).toLowerCase();
      logs = logs.filter((l) => l.user.toLowerCase().includes(u));
    }
    if (search) {
      const q = String(search).toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.user.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          (l.ip && l.ip.includes(q))
      );
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const startIndex = (pageNum - 1) * limitNum;
    const paginated = logs.slice(startIndex, startIndex + limitNum);

    return {
      total: logs.length,
      page: pageNum,
      totalPages: Math.ceil(logs.length / limitNum) || 1,
      logs: paginated,
    };
  },

  async getAuditStats() {
    let totalLogs = 0;
    let uniqueUsersCount = 0;
    let recentActions: any[] = [];
    let actionBreakdown: Record<string, number> = {};

    if (mongoose.connection.readyState === 1) {
      try {
        totalLogs = await AuditLog.countDocuments();
        const distinctUsers = await AuditLog.distinct('user');
        uniqueUsersCount = distinctUsers.length;
        recentActions = await AuditLog.find().sort({ timestamp: -1 }).limit(10).lean();

        const topActions = await AuditLog.aggregate([
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]);
        topActions.forEach((a: any) => {
          if (a._id) actionBreakdown[a._id] = a.count;
        });

        return {
          totalLogs,
          uniqueUsersCount,
          actionBreakdown,
          recentActions,
        };
      } catch {}
    }

    const stateLogs = db.getState().auditLogs;
    totalLogs = stateLogs.length;
    uniqueUsersCount = new Set(stateLogs.map((l) => l.user)).size;
    recentActions = stateLogs.slice(0, 10);
    stateLogs.forEach((l) => {
      actionBreakdown[l.action] = (actionBreakdown[l.action] || 0) + 1;
    });

    return {
      totalLogs,
      uniqueUsersCount,
      actionBreakdown,
      recentActions,
    };
  },

  async clearOldLogs(daysToKeep = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysToKeep));

    let deletedCount = 0;
    if (mongoose.connection.readyState === 1) {
      try {
        const result = await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
        deletedCount = result.deletedCount || 0;
      } catch {}
    }

    const cutoffIso = cutoff.toISOString();
    db.updateState((s) => {
      s.auditLogs = s.auditLogs.filter((l) => l.timestamp >= cutoffIso);
    });

    return {
      success: true,
      deletedCount,
      retainedAfter: cutoffIso,
    };
  },
};

export default auditService;
