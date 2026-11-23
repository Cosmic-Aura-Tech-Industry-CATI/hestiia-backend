import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Media } from '../models/media.model.js';
import { MediaModeration } from '../models/mediaModeration.model.js';
import { IMedia, IMediaModeration, ModerationStatus, PublicationStatus, MediaVisibility } from '../interfaces/gallery.interface.js';

export const mediaModerationService = {
  /**
   * Moderate customer submitted photo (approve, reject, or remove)
   */
  async moderatePhoto(
    mediaId: string,
    action: 'approved' | 'rejected' | 'removed',
    reviewedBy = 'admin',
    reason = ''
  ): Promise<{ media: IMedia; moderation: IMediaModeration }> {
    const validActions = ['approved', 'rejected', 'removed'];
    if (!validActions.includes(action)) {
      throw new AppError(`Invalid moderation action. Must be one of: ${validActions.join(', ')}`, 400);
    }

    let media: IMedia | null = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.findById(mediaId).lean();
        if (doc) media = { ...doc, id: String(doc._id) } as any;
      } catch {
        // fallback
      }
    }

    if (!media) {
      const state = db.getState() as any;
      media = (state.media || []).find((m: any) => m.id === mediaId || m._id === mediaId) || null;
    }

    if (!media) {
      throw new AppError('Media item not found.', 404);
    }

    let moderationStatus: ModerationStatus = 'pending';
    let publicationStatus: PublicationStatus = 'draft';
    let visibility: MediaVisibility = 'private';

    if (action === 'approved') {
      moderationStatus = 'approved';
      publicationStatus = 'published';
      visibility = 'public';
    } else if (action === 'rejected') {
      moderationStatus = 'rejected';
      publicationStatus = 'draft';
      visibility = 'private';
    } else if (action === 'removed') {
      moderationStatus = 'removed';
      publicationStatus = 'archived';
      visibility = 'private';
    }

    const now = new Date().toISOString();
    const updatePayload: Partial<IMedia> = {
      moderationStatus,
      publicationStatus,
      visibility,
      rejectionReason: reason ? String(reason).trim() : '',
      updatedAt: now,
    };

    // Update Media document
    if (mongoose.connection.readyState === 1) {
      try {
        await Media.findByIdAndUpdate(media.id, { $set: updatePayload });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.media) {
        const target = s.media.find((m: any) => m.id === mediaId || m._id === mediaId);
        if (target) Object.assign(target, updatePayload);
      }
    });

    // Create Audit Record in MediaModeration
    const moderationRecord: IMediaModeration = {
      id: 'mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      mediaId,
      reviewedBy,
      action,
      reason: reason ? String(reason).trim() : undefined,
      reviewedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await MediaModeration.create({
          mediaId,
          reviewedBy,
          action,
          reason: moderationRecord.reason,
          reviewedAt: new Date(now),
        });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (!s.mediaModerations) s.mediaModerations = [];
      s.mediaModerations.unshift(moderationRecord);
    });

    db.logAudit(
      'CUSTOMER_MEDIA_MODERATED',
      reviewedBy,
      `Action ${action.toUpperCase()} on photo #${mediaId}${reason ? ` (Reason: ${reason})` : ''}`
    );

    Object.assign(media, updatePayload);
    return { media, moderation: moderationRecord };
  },

  /**
   * Get audit history for a photo
   */
  async getModerationHistory(mediaId: string): Promise<IMediaModeration[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await MediaModeration.find({ mediaId }).sort({ reviewedAt: -1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d: any) => ({
            id: String(d._id),
            mediaId: d.mediaId,
            reviewedBy: d.reviewedBy,
            action: d.action,
            reason: d.reason,
            reviewedAt: d.reviewedAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const items: IMediaModeration[] = state.mediaModerations || [];
    return items.filter((m) => m.mediaId === mediaId);
  },
};

export default mediaModerationService;
