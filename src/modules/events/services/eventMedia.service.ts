import fs from 'fs';
import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from '../../../shared/config/cloudinary.js';
import { AppError } from '../../../shared/utils/appError.js';
import { EventMedia } from '../models/eventMedia.model.js';
import { Event } from '../models/event.model.js';
import { IEventMedia } from '../interfaces/events.interface.js';

export const eventMediaService = {
  /**
   * Upload multiple event photographs to Cloudinary / storage
   */
  async uploadEventMedia(
    eventId: string,
    files: Express.Multer.File[],
    username = 'admin'
  ): Promise<IEventMedia[]> {
    if (!files || files.length === 0) {
      throw new AppError('At least one image file is required for upload.', 400);
    }

    // Verify event exists
    const event = await this.findEventRecord(eventId);
    if (!event) {
      throw new AppError('Event not found.', 404);
    }

    const uploadedMedia: IEventMedia[] = [];
    const isCloudinaryActive = isCloudinaryConfigured();
    let currentCover = event.cover_image;

    // Get current highest display order
    const existingMedia = await this.getEventMedia(eventId);
    let nextOrder = existingMedia.length > 0 ? Math.max(...existingMedia.map((m) => m.display_order)) + 1 : 0;

    for (const file of files) {
      let imageUrl = `/uploads/${file.filename}`;
      let publicId = `local_${file.filename}`;

      if (isCloudinaryActive && file.path && fs.existsSync(file.path)) {
        try {
          const cloudResult = await uploadToCloudinary(file.path, {
            folder: 'restaurant/events',
            quality: 'auto',
            tags: ['restaurant_events', `event_${eventId}`],
          });
          imageUrl = cloudResult.secure_url;
          publicId = cloudResult.public_id;

          // Remove temporary disk file after cloud upload
          try {
            fs.unlinkSync(file.path);
          } catch {
            // ignore cleanup error
          }
        } catch (err: any) {
          console.warn('[EventMedia] Cloudinary upload failed, falling back to local asset path:', err?.message);
        }
      }

      const isFirstImage = !currentCover && uploadedMedia.length === 0 && existingMedia.length === 0;

      const mediaRecord: IEventMedia = {
        id: 'evm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        event_id: eventId,
        image_url: imageUrl,
        public_id: publicId,
        is_cover: isFirstImage,
        display_order: nextOrder++,
        createdAt: new Date().toISOString(),
      };

      if (mongoose.connection.readyState === 1) {
        try {
          const doc = await EventMedia.create({
            event_id: eventId,
            image_url: mediaRecord.image_url,
            public_id: mediaRecord.public_id,
            is_cover: mediaRecord.is_cover,
            display_order: mediaRecord.display_order,
          });
          mediaRecord.id = String(doc._id);
        } catch {
          // fallback store
        }
      }

      // Store in memory database state
      db.updateState((s: any) => {
        if (!s.eventMedia) s.eventMedia = [];
        s.eventMedia.push(mediaRecord);
      });

      uploadedMedia.push(mediaRecord);

      if (isFirstImage) {
        currentCover = imageUrl;
        await this.syncEventCover(eventId, imageUrl);
      }
    }

    db.logAudit(
      'EVENT_PHOTOS_UPLOADED',
      username,
      `Uploaded ${uploadedMedia.length} photograph(s) for event: ${event.event_name || eventId}`
    );

    return uploadedMedia;
  },

  /**
   * Retrieve all photographs associated with an event
   */
  async getEventMedia(eventId: string): Promise<IEventMedia[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await EventMedia.find({ event_id: eventId }).sort({ display_order: 1, createdAt: 1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d: any) => ({
            id: String(d._id),
            event_id: String(d.event_id),
            image_url: d.image_url,
            public_id: d.public_id,
            is_cover: Boolean(d.is_cover),
            display_order: d.display_order ?? 0,
            caption: d.caption,
            createdAt: d.createdAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const items: IEventMedia[] = state.eventMedia || [];
    return items
      .filter((m) => m.event_id === eventId)
      .sort((a, b) => a.display_order - b.display_order);
  },

  /**
   * Delete single photograph from database and Cloudinary
   */
  async deleteMedia(eventId: string, mediaId: string, username = 'admin'): Promise<{ deletedId: string }> {
    let targetMedia: IEventMedia | null = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await EventMedia.findOne({ _id: mediaId, event_id: eventId });
        if (doc) {
          targetMedia = {
            id: String(doc._id),
            event_id: String(doc.event_id),
            image_url: doc.image_url,
            public_id: doc.public_id,
            is_cover: doc.is_cover,
            display_order: doc.display_order,
          };
          await EventMedia.findByIdAndDelete(doc._id);
        }
      } catch {
        // fallback
      }
    }

    if (!targetMedia) {
      const state = db.getState() as any;
      const items: IEventMedia[] = state.eventMedia || [];
      targetMedia = items.find((m) => (m.id === mediaId || m._id === mediaId) && m.event_id === eventId) || null;
    }

    if (!targetMedia) {
      throw new AppError('Photograph not found for this event.', 404);
    }

    // Clean up Cloudinary asset
    if (targetMedia.public_id && !targetMedia.public_id.startsWith('local_')) {
      try {
        await deleteFromCloudinary(targetMedia.public_id);
      } catch (err: any) {
        console.warn('[EventMedia] Cloudinary deletion notice:', err?.message);
      }
    }

    // Remove from in-memory store
    db.updateState((s: any) => {
      if (s.eventMedia) {
        s.eventMedia = s.eventMedia.filter((m: any) => m.id !== mediaId && m._id !== mediaId);
      }
    });

    // If deleted photograph was cover, assign new cover image if photographs remain
    if (targetMedia.is_cover) {
      const remaining = await this.getEventMedia(eventId);
      if (remaining.length > 0) {
        await this.setCoverImage(eventId, remaining[0].id, username);
      } else {
        await this.syncEventCover(eventId, '');
      }
    }

    db.logAudit('EVENT_PHOTO_DELETED', username, `Deleted photograph #${mediaId} from event #${eventId}`);
    return { deletedId: mediaId };
  },

  /**
   * Set a specific photograph as the cover image
   */
  async setCoverImage(eventId: string, mediaId: string, username = 'admin'): Promise<IEventMedia> {
    const mediaList = await this.getEventMedia(eventId);
    const target = mediaList.find((m) => m.id === mediaId || m._id === mediaId);

    if (!target) {
      throw new AppError('Photograph not found for this event.', 404);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await EventMedia.updateMany({ event_id: eventId }, { $set: { is_cover: false } });
        await EventMedia.findByIdAndUpdate(target.id, { $set: { is_cover: true } });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.eventMedia) {
        s.eventMedia.forEach((m: any) => {
          if (m.event_id === eventId) {
            m.is_cover = m.id === mediaId || m._id === mediaId;
          }
        });
      }
    });

    await this.syncEventCover(eventId, target.image_url);
    target.is_cover = true;

    db.logAudit('EVENT_COVER_UPDATED', username, `Updated cover image for event #${eventId} to photograph #${mediaId}`);
    return target;
  },

  /**
   * Reorder photographs for an event
   */
  async reorderMedia(eventId: string, orderedMediaIds: string[], username = 'admin'): Promise<IEventMedia[]> {
    if (!Array.isArray(orderedMediaIds) || orderedMediaIds.length === 0) {
      throw new AppError('orderedMediaIds must be an array of media IDs.', 400);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const bulkOps = orderedMediaIds.map((id, index) => ({
          updateOne: {
            filter: { _id: id, event_id: eventId },
            update: { $set: { display_order: index } },
          },
        }));
        await EventMedia.bulkWrite(bulkOps);
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.eventMedia) {
        s.eventMedia.forEach((m: any) => {
          if (m.event_id === eventId) {
            const index = orderedMediaIds.indexOf(m.id) !== -1 ? orderedMediaIds.indexOf(m.id) : orderedMediaIds.indexOf(m._id);
            if (index !== -1) {
              m.display_order = index;
            }
          }
        });
      }
    });

    db.logAudit('EVENT_PHOTOS_REORDERED', username, `Reordered ${orderedMediaIds.length} photographs for event #${eventId}`);
    return await this.getEventMedia(eventId);
  },

  /**
   * Safe cleanup of all photographs associated with an event upon deletion
   */
  async deleteMediaByEventId(eventId: string): Promise<void> {
    const mediaList = await this.getEventMedia(eventId);

    for (const item of mediaList) {
      if (item.public_id && !item.public_id.startsWith('local_')) {
        try {
          await deleteFromCloudinary(item.public_id);
        } catch {
          // ignore cleanup errors
        }
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await EventMedia.deleteMany({ event_id: eventId });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.eventMedia) {
        s.eventMedia = s.eventMedia.filter((m: any) => m.event_id !== eventId);
      }
    });
  },

  /**
   * Helpers
   */
  async findEventRecord(eventId: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Event.findById(eventId).lean();
        if (doc) return doc;
      } catch {
        // fallback
      }
    }
    const state = db.getState() as any;
    const events = state.events || [];
    return events.find((e: any) => e.id === eventId || e._id === eventId) || null;
  },

  async syncEventCover(eventId: string, coverImageUrl: string): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      try {
        await Event.findByIdAndUpdate(eventId, { $set: { cover_image: coverImageUrl } });
      } catch {
        // fallback
      }
    }
    db.updateState((s: any) => {
      if (s.events) {
        const ev = s.events.find((e: any) => e.id === eventId || e._id === eventId);
        if (ev) ev.cover_image = coverImageUrl;
      }
    });
  },
};
