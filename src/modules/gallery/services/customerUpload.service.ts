import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Media } from '../models/media.model.js';
import { storageService } from './storage.service.js';
import { mediaValidationService } from './mediaValidation.service.js';
import { mediaCategoryService } from './mediaCategory.service.js';
import { IMedia } from '../interfaces/gallery.interface.js';

export const customerUploadService = {
  /**
   * Submit guest customer photograph for moderation
   */
  async submitCustomerPhoto(
    file: Express.Multer.File,
    guestId: string,
    caption?: string,
    sectionId?: string
  ): Promise<Partial<IMedia>> {
    if (!guestId) {
      throw new AppError('Guest session identity is required for uploading.', 401);
    }

    // 1. Validation
    mediaValidationService.validateImageFile(file);
    const validCaption = mediaValidationService.validateCaption(caption);

    let resolvedSectionId: string | undefined = undefined;
    if (sectionId) {
      const section = await mediaCategoryService.findSection(sectionId);
      if (!section) {
        throw new AppError('Selected gallery section does not exist.', 400);
      }
      resolvedSectionId = section.id;
    } else {
      // Default to "Customer Moments" section if available
      const customerMomentsSec = await mediaCategoryService.findSection('customer-moments');
      if (customerMomentsSec) {
        resolvedSectionId = customerMomentsSec.id;
      }
    }

    // 2. Storage upload
    const uploadResult = await storageService.uploadFile(file, 'restaurant/gallery/customer');

    // 3. Document Creation (Pending Moderation)
    const now = new Date().toISOString();
    const mediaRecord: IMedia = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: 'Customer Contribution',
      caption: validCaption,
      description: validCaption,
      altText: validCaption || 'Customer photo contribution',
      imageUrl: uploadResult.imageUrl,
      publicId: uploadResult.publicId,
      storageProvider: uploadResult.storageProvider,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      uploaderType: 'customer',
      guestId,
      sectionId: resolvedSectionId,
      mediaSource: 'customer',
      moderationStatus: 'pending', // Strictly pending initially
      publicationStatus: 'draft',
      visibility: 'private',       // Private until approved
      displayOrder: 999,
      createdAt: now,
      updatedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.create(mediaRecord);
        mediaRecord.id = String(doc._id);
      } catch (err: any) {
        console.warn('[CustomerUpload] Mongoose create error:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.media) s.media = [];
      s.media.unshift(mediaRecord);
    });

    db.logAudit(
      'GUEST_PHOTO_SUBMITTED',
      'Guest Customer',
      `Submitted photo #${mediaRecord.id} with caption: "${validCaption.slice(0, 30)}..."`
    );

    return {
      id: mediaRecord.id,
      imageUrl: mediaRecord.imageUrl,
      caption: mediaRecord.caption,
      moderationStatus: mediaRecord.moderationStatus,
      createdAt: mediaRecord.createdAt,
    };
  },

  /**
   * Retrieve upload history for the current guest
   */
  async getMyUploads(guestId: string): Promise<Array<Partial<IMedia>>> {
    if (!guestId) {
      return [];
    }

    let items: IMedia[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await Media.find({ guestId }).sort({ createdAt: -1 }).lean();
        if (docs && docs.length > 0) {
          items = docs.map((d: any) => ({ ...d, id: String(d._id) }));
        }
      } catch {
        // fallback
      }
    }

    if (items.length === 0) {
      const state = db.getState() as any;
      const all: IMedia[] = state.media || [];
      items = all.filter((m) => m.guestId === guestId);
    }

    return items.map((m) => ({
      id: m.id,
      imageUrl: m.imageUrl,
      caption: m.caption,
      moderationStatus: m.moderationStatus,
      publicationStatus: m.publicationStatus,
      rejectionReason: m.rejectionReason,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Delete an upload belonging to the current guest
   */
  async deleteMyUpload(guestId: string, mediaId: string): Promise<{ success: boolean; message: string }> {
    if (!guestId) {
      throw new AppError('Guest session identity required.', 401);
    }

    let targetMedia: IMedia | null = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.findById(mediaId).lean();
        if (doc) targetMedia = { ...doc, id: String(doc._id) } as any;
      } catch {
        // fallback
      }
    }

    if (!targetMedia) {
      const state = db.getState() as any;
      const all: IMedia[] = state.media || [];
      targetMedia = all.find((m) => m.id === mediaId || (m as any)._id === mediaId) || null;
    }

    if (!targetMedia) {
      throw new AppError('Submitted photo not found.', 404);
    }

    // Security ownership check: guest can ONLY delete their own photo
    if (targetMedia.guestId !== guestId) {
      throw new AppError('Unauthorized: You can only delete your own submitted photographs.', 403);
    }

    // Clean up Cloudinary asset
    await storageService.deleteFile(targetMedia.publicId, targetMedia.storageProvider);

    if (mongoose.connection.readyState === 1) {
      try {
        await Media.findByIdAndDelete(targetMedia.id);
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.media) {
        s.media = s.media.filter((m: any) => m.id !== mediaId && m._id !== mediaId);
      }
    });

    db.logAudit('GUEST_PHOTO_DELETED', 'Guest Customer', `Deleted submission #${mediaId}`);
    return { success: true, message: 'Your submitted photo has been deleted successfully.' };
  },
};

export default customerUploadService;
