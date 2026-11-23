import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Media } from '../models/media.model.js';
import { mediaCategoryService } from './mediaCategory.service.js';
import { storageService } from './storage.service.js';
import { mediaValidationService } from './mediaValidation.service.js';
import {
  IMedia,
  IPublicMediaResponse,
  PublicationStatus,
  MediaVisibility,
} from '../interfaces/gallery.interface.js';

export const galleryService = {
  /**
   * Public: Retrieve published, approved gallery photographs
   */
  async getPublicPhotos(
    query: any = {}
  ): Promise<{ photos: IPublicMediaResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
    const sectionQuery = query.section ? String(query.section).trim().toLowerCase() : '';

    let sectionIdFilter: string | undefined = undefined;
    if (sectionQuery && sectionQuery !== 'all') {
      const section = await mediaCategoryService.findSection(sectionQuery);
      if (section) {
        sectionIdFilter = section.id;
      }
    }

    let matched: IMedia[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {
          publicationStatus: 'published',
          moderationStatus: 'approved',
          visibility: 'public',
        };
        if (sectionIdFilter) {
          filter.sectionId = sectionIdFilter;
        }

        total = await Media.countDocuments(filter);
        const docs = await Media.find(filter)
          .sort({ displayOrder: 1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matched = docs.map((d: any) => ({ ...d, id: String(d._id) }));
      } catch {
        // fallback
      }
    }

    if (matched.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IMedia[] = (state.media || []).filter(
        (m: IMedia) =>
          m.publicationStatus === 'published' &&
          m.moderationStatus === 'approved' &&
          m.visibility === 'public'
      );

      if (sectionIdFilter) {
        all = all.filter((m) => m.sectionId === sectionIdFilter);
      }

      all.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      total = all.length;
      matched = all.slice((page - 1) * limit, page * limit);
    }

    // Populate section details and map to safe public format
    const sections = await mediaCategoryService.getAdminSections();
    const photos: IPublicMediaResponse[] = matched.map((m) => {
      const sec = sections.find((s) => s.id === m.sectionId || s.slug === m.sectionId);
      return {
        _id: m.id,
        id: m.id,
        imageUrl: m.imageUrl,
        title: m.title || '',
        caption: m.caption || '',
        description: m.description || '',
        altText: m.altText || m.title || 'Hestiia Restaurant Gallery',
        section: sec ? { id: sec.id, name: sec.name, slug: sec.slug } : undefined,
        postedBy: m.uploaderType === 'customer' ? 'Posted by a customer' : 'Hestiia Restaurant',
        displayOrder: m.displayOrder || 0,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    });

    return { photos, total, page, limit };
  },

  /**
   * Public: Retrieve single photo by ID (must be published, approved, public)
   */
  async getPublicPhotoById(id: string): Promise<IPublicMediaResponse> {
    let photo: IMedia | null = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.findOne({
          _id: id,
          publicationStatus: 'published',
          moderationStatus: 'approved',
          visibility: 'public',
        }).lean();
        if (doc) photo = { ...doc, id: String(doc._id) } as any;
      } catch {
        // fallback
      }
    }

    if (!photo) {
      const state = db.getState() as any;
      const all: IMedia[] = state.media || [];
      photo =
        all.find(
          (m) =>
            (m.id === id || (m as any)._id === id) &&
            m.publicationStatus === 'published' &&
            m.moderationStatus === 'approved' &&
            m.visibility === 'public'
        ) || null;
    }

    if (!photo) {
      throw new AppError('Photograph not found or not published.', 404);
    }

    const sections = await mediaCategoryService.getAdminSections();
    const sec = sections.find((s) => s.id === photo?.sectionId || s.slug === photo?.sectionId);

    return {
      _id: photo.id,
      id: photo.id,
      imageUrl: photo.imageUrl,
      title: photo.title || '',
      caption: photo.caption || '',
      description: photo.description || '',
      altText: photo.altText || photo.title || 'Hestiia Restaurant Gallery',
      section: sec ? { id: sec.id, name: sec.name, slug: sec.slug } : undefined,
      postedBy: photo.uploaderType === 'customer' ? 'Posted by a customer' : 'Hestiia Restaurant',
      displayOrder: photo.displayOrder || 0,
      createdAt: photo.createdAt || new Date().toISOString(),
    };
  },

  /**
   * Admin: Upload official restaurant photo
   */
  async uploadOfficialPhoto(file: Express.Multer.File, data: any = {}, adminUsername = 'admin'): Promise<IMedia> {
    mediaValidationService.validateImageFile(file);

    const title = mediaValidationService.validateTitle(data.title || file.originalname.split('.')[0]);
    const caption = mediaValidationService.validateCaption(data.caption);
    const description = String(data.description || caption || '').trim();
    const altText = String(data.altText || title || caption || '').trim();

    let resolvedSectionId: string | undefined = undefined;
    if (data.sectionId) {
      const sec = await mediaCategoryService.findSection(data.sectionId);
      if (sec) resolvedSectionId = sec.id;
    }

    const uploadResult = await storageService.uploadFile(file, 'restaurant/gallery/official');

    const now = new Date().toISOString();
    const mediaRecord: IMedia = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title,
      caption,
      description,
      altText,
      imageUrl: uploadResult.imageUrl,
      publicId: uploadResult.publicId,
      storageProvider: uploadResult.storageProvider,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      uploaderType: 'admin',
      uploadedByAdmin: adminUsername,
      sectionId: resolvedSectionId,
      mediaSource: 'official',
      moderationStatus: 'approved',
      publicationStatus: (data.publicationStatus as PublicationStatus) || 'published',
      visibility: (data.visibility as MediaVisibility) || 'public',
      displayOrder: Number(data.displayOrder ?? 0),
      createdAt: now,
      updatedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.create(mediaRecord);
        mediaRecord.id = String(doc._id);
      } catch (err: any) {
        console.warn('[GalleryService] Mongoose create error:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.media) s.media = [];
      s.media.unshift(mediaRecord);
    });

    db.logAudit('OFFICIAL_MEDIA_UPLOADED', adminUsername, `Uploaded official photo: "${title}" (${mediaRecord.id})`);
    return mediaRecord;
  },

  /**
   * Admin: List official photos with filters & pagination
   */
  async getAdminPhotos(
    query: any = {}
  ): Promise<{ photos: IMedia[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
    const section = query.section ? String(query.section).trim().toLowerCase() : '';
    const status = query.publicationStatus ? String(query.publicationStatus).trim().toLowerCase() : '';
    const mediaSource = query.mediaSource ? String(query.mediaSource).trim().toLowerCase() : '';
    const search = query.search ? String(query.search).trim().toLowerCase() : '';

    let matched: IMedia[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (section && section !== 'all') filter.sectionId = section;
        if (status && status !== 'all') filter.publicationStatus = status;
        if (mediaSource && mediaSource !== 'all') filter.mediaSource = mediaSource;
        if (search) {
          filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { caption: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        }

        total = await Media.countDocuments(filter);
        const docs = await Media.find(filter)
          .sort({ displayOrder: 1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matched = docs.map((d: any) => ({ ...d, id: String(d._id) }));
      } catch {
        // fallback
      }
    }

    if (matched.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IMedia[] = state.media || [];

      if (section && section !== 'all') all = all.filter((m) => m.sectionId === section);
      if (status && status !== 'all') all = all.filter((m) => m.publicationStatus === status);
      if (mediaSource && mediaSource !== 'all') all = all.filter((m) => m.mediaSource === mediaSource);
      if (search) {
        all = all.filter((m) =>
          (m.title || '').toLowerCase().includes(search) ||
          (m.caption || '').toLowerCase().includes(search) ||
          (m.description || '').toLowerCase().includes(search)
        );
      }

      all.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      total = all.length;
      matched = all.slice((page - 1) * limit, page * limit);
    }

    return { photos: matched, total, page, limit };
  },

  /**
   * Admin: Get photo by ID
   */
  async getAdminPhotoById(id: string): Promise<IMedia> {
    let photo: IMedia | null = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Media.findById(id).lean();
        if (doc) photo = { ...doc, id: String(doc._id) } as any;
      } catch {
        // fallback
      }
    }

    if (!photo) {
      const state = db.getState() as any;
      const all: IMedia[] = state.media || [];
      photo = all.find((m) => m.id === id || (m as any)._id === id) || null;
    }

    if (!photo) {
      throw new AppError('Photograph not found.', 404);
    }

    return photo;
  },

  /**
   * Admin: Update photo metadata
   */
  async updatePhoto(id: string, data: Partial<IMedia>, adminUsername = 'admin'): Promise<IMedia> {
    const photo = await this.getAdminPhotoById(id);

    const updates: Partial<IMedia> = {};
    if (data.title !== undefined) updates.title = mediaValidationService.validateTitle(data.title);
    if (data.caption !== undefined) updates.caption = mediaValidationService.validateCaption(data.caption);
    if (data.description !== undefined) updates.description = String(data.description).trim();
    if (data.altText !== undefined) updates.altText = String(data.altText).trim();
    if (data.sectionId !== undefined) updates.sectionId = data.sectionId;
    if (data.displayOrder !== undefined) updates.displayOrder = Number(data.displayOrder);
    if (data.visibility !== undefined) updates.visibility = data.visibility;
    updates.updatedAt = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        await Media.findByIdAndUpdate(photo.id, { $set: updates });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.media) {
        const target = s.media.find((m: any) => m.id === photo.id || m._id === photo.id);
        if (target) Object.assign(target, updates);
      }
    });

    db.logAudit('GALLERY_PHOTO_UPDATED', adminUsername, `Updated metadata for photo #${id}`);
    Object.assign(photo, updates);
    return photo;
  },

  /**
   * Admin: Update publication status (publish, unpublish, archive)
   */
  async updatePhotoStatus(
    id: string,
    status: PublicationStatus,
    adminUsername = 'admin'
  ): Promise<IMedia> {
    const validStatuses: PublicationStatus[] = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const photo = await this.getAdminPhotoById(id);
    const updates: Partial<IMedia> = {
      publicationStatus: status,
      visibility: status === 'published' ? 'public' : 'private',
      updatedAt: new Date().toISOString(),
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Media.findByIdAndUpdate(photo.id, { $set: updates });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.media) {
        const target = s.media.find((m: any) => m.id === photo.id || m._id === photo.id);
        if (target) Object.assign(target, updates);
      }
    });

    db.logAudit('GALLERY_PHOTO_STATUS_CHANGED', adminUsername, `Changed status of photo #${id} to ${status.toUpperCase()}`);
    Object.assign(photo, updates);
    return photo;
  },

  /**
   * Admin: Delete photo permanently and cleanup storage
   */
  async deletePhoto(id: string, adminUsername = 'admin'): Promise<{ success: boolean; message: string }> {
    const photo = await this.getAdminPhotoById(id);

    // Clean up Cloudinary storage asset
    await storageService.deleteFile(photo.publicId, photo.storageProvider);

    if (mongoose.connection.readyState === 1) {
      try {
        await Media.findByIdAndDelete(photo.id);
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.media) {
        s.media = s.media.filter((m: any) => m.id !== photo.id && m._id !== photo.id);
      }
    });

    db.logAudit('GALLERY_PHOTO_DELETED', adminUsername, `Deleted photograph #${id}`);
    return { success: true, message: 'Photograph and storage asset deleted successfully.' };
  },

  /**
   * Admin: List customer photo uploads for moderation
   */
  async getAdminCustomerUploads(
    query: any = {}
  ): Promise<{ submissions: IMedia[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
    const status = query.moderationStatus ? String(query.moderationStatus).trim().toLowerCase() : '';

    let matched: IMedia[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = { mediaSource: 'customer' };
        if (status && status !== 'all') filter.moderationStatus = status;

        total = await Media.countDocuments(filter);
        const docs = await Media.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matched = docs.map((d: any) => ({ ...d, id: String(d._id) }));
      } catch {
        // fallback
      }
    }

    if (matched.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IMedia[] = (state.media || []).filter((m: IMedia) => m.mediaSource === 'customer');
      if (status && status !== 'all') all = all.filter((m) => m.moderationStatus === status);

      all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      total = all.length;
      matched = all.slice((page - 1) * limit, page * limit);
    }

    return { submissions: matched, total, page, limit };
  },
};

export default galleryService;
