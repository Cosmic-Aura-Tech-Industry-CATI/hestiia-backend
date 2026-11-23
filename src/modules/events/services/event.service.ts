import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Event } from '../models/event.model.js';
import { eventMediaService } from './eventMedia.service.js';
import { IEvent, EventStatus, IEventMedia } from '../interfaces/events.interface.js';

export const eventService = {
  /**
   * Create a new event record
   */
  async createEvent(data: Partial<IEvent>, username = 'admin'): Promise<IEvent> {
    const event_name = (data.event_name || '')?.trim();
    const description = (data.description || '')?.trim();
    const attendee_count = Number(data.attendee_count);
    const location = (data.location || 'Hestiia Banquet & Lawn, Kanpur')?.trim();

    if (!event_name) {
      throw new AppError('Event name is required.', 400);
    }
    if (!description) {
      throw new AppError('Event description is required.', 400);
    }
    if (!data.event_date) {
      throw new AppError('Event date is required.', 400);
    }
    const event_date = new Date(data.event_date);
    if (isNaN(event_date.getTime())) {
      throw new AppError('Invalid event date provided.', 400);
    }
    if (isNaN(attendee_count) || attendee_count < 1) {
      throw new AppError('Attendee count must be a positive number of at least 1.', 400);
    }

    // Normalize services_provided
    let services_provided = data.services_provided || [];
    if (Array.isArray(services_provided)) {
      services_provided = services_provided.map((s: any) => {
        if (typeof s === 'string') return { name: s.trim() };
        return { name: String(s.name || '').trim(), description: s.description ? String(s.description).trim() : undefined };
      }).filter((s) => s.name.length > 0);
    } else {
      services_provided = [];
    }

    const now = new Date().toISOString();
    const eventRecord: IEvent = {
      id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      event_name,
      description,
      event_date: event_date.toISOString(),
      attendee_count,
      services_provided,
      location,
      status: (data.status === 'published' ? 'published' : 'draft') as EventStatus,
      cover_image: data.cover_image || '',
      created_by: username,
      createdAt: now,
      updatedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Event.create({
          event_name: eventRecord.event_name,
          description: eventRecord.description,
          event_date: event_date,
          attendee_count: eventRecord.attendee_count,
          services_provided: eventRecord.services_provided,
          location: eventRecord.location,
          status: eventRecord.status,
          cover_image: eventRecord.cover_image,
        });
        eventRecord.id = String(doc._id);
      } catch (err: any) {
        console.warn('[EventService] Mongoose create failed, using local store:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.events) s.events = [];
      s.events.unshift(eventRecord);
    });

    db.logAudit('EVENT_CREATED', username, `Created event: "${event_name}" (${eventRecord.id})`);
    return eventRecord;
  },

  /**
   * Retrieve all published events for public customer website
   */
  async getPublishedEvents(query: any = {}): Promise<{ events: (IEvent & { media: IEventMedia[] })[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const search = query.search ? String(query.search).trim().toLowerCase() : '';

    let matchedEvents: IEvent[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = { status: 'published' };
        if (search) {
          filter.$or = [
            { event_name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        }

        total = await Event.countDocuments(filter);
        const docs = await Event.find(filter)
          .sort({ event_date: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matchedEvents = docs.map((d: any) => ({
          id: String(d._id),
          event_name: d.event_name,
          description: d.description,
          event_date: d.event_date,
          attendee_count: d.attendee_count,
          services_provided: d.services_provided || [],
          location: d.location,
          status: d.status,
          cover_image: d.cover_image,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
      } catch {
        // fallback
      }
    }

    if (matchedEvents.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IEvent[] = (state.events || []).filter((e: IEvent) => e.status === 'published');

      if (search) {
        all = all.filter((e) =>
          e.event_name.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search)
        );
      }

      all.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
      total = all.length;
      matchedEvents = all.slice((page - 1) * limit, page * limit);
    }

    // Attach media photographs to each event
    const eventsWithMedia = await Promise.all(
      matchedEvents.map(async (ev) => {
        const media = await eventMediaService.getEventMedia(ev.id);
        return {
          ...ev,
          cover_image: ev.cover_image || (media.length > 0 ? media[0].image_url : ''),
          media,
        };
      })
    );

    return { events: eventsWithMedia, total, page, limit };
  },

  /**
   * Retrieve published event details by ID
   */
  async getPublishedEventById(id: string): Promise<IEvent & { media: IEventMedia[] }> {
    let event: IEvent | null = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Event.findOne({ _id: id, status: 'published' }).lean();
        if (doc) {
          event = {
            id: String(doc._id),
            event_name: doc.event_name,
            description: doc.description,
            event_date: doc.event_date,
            attendee_count: doc.attendee_count,
            services_provided: doc.services_provided || [],
            location: doc.location,
            status: doc.status,
            cover_image: doc.cover_image,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    if (!event) {
      const state = db.getState() as any;
      const all: IEvent[] = state.events || [];
      event = all.find((e) => (e.id === id || (e as any)._id === id) && e.status === 'published') || null;
    }

    if (!event) {
      throw new AppError('Event not found or not published.', 404);
    }

    const media = await eventMediaService.getEventMedia(event.id);
    return {
      ...event,
      cover_image: event.cover_image || (media.length > 0 ? media[0].image_url : ''),
      media,
    };
  },

  /**
   * Retrieve all events for Admin Dashboard (with filtering and pagination)
   */
  async getAdminEvents(query: any = {}): Promise<{ events: IEvent[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const status = query.status ? String(query.status).trim().toLowerCase() : '';
    const search = query.search ? String(query.search).trim().toLowerCase() : '';
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    let matchedEvents: IEvent[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (status && status !== 'all') {
          filter.status = status;
        }
        if (search) {
          filter.$or = [
            { event_name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        }
        if (startDate || endDate) {
          filter.event_date = {};
          if (startDate && !isNaN(startDate.getTime())) filter.event_date.$gte = startDate;
          if (endDate && !isNaN(endDate.getTime())) filter.event_date.$lte = endDate;
        }

        total = await Event.countDocuments(filter);
        const docs = await Event.find(filter)
          .sort({ event_date: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matchedEvents = docs.map((d: any) => ({
          id: String(d._id),
          event_name: d.event_name,
          description: d.description,
          event_date: d.event_date,
          attendee_count: d.attendee_count,
          services_provided: d.services_provided || [],
          location: d.location,
          status: d.status,
          cover_image: d.cover_image,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
      } catch {
        // fallback
      }
    }

    if (matchedEvents.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IEvent[] = state.events || [];

      if (status && status !== 'all') {
        all = all.filter((e) => e.status === status);
      }
      if (search) {
        all = all.filter((e) =>
          e.event_name.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search)
        );
      }
      if (startDate && !isNaN(startDate.getTime())) {
        all = all.filter((e) => new Date(e.event_date).getTime() >= startDate.getTime());
      }
      if (endDate && !isNaN(endDate.getTime())) {
        all = all.filter((e) => new Date(e.event_date).getTime() <= endDate.getTime());
      }

      all.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
      total = all.length;
      matchedEvents = all.slice((page - 1) * limit, page * limit);
    }

    return { events: matchedEvents, total, page, limit };
  },

  /**
   * Retrieve event details for Admin Dashboard
   */
  async getAdminEventById(id: string): Promise<IEvent & { media: IEventMedia[] }> {
    const event = await this.findEventRecord(id);
    if (!event) {
      throw new AppError('Event not found.', 404);
    }
    const media = await eventMediaService.getEventMedia(event.id);
    return {
      ...event,
      media,
    };
  },

  /**
   * Update event information
   */
  async updateEvent(id: string, data: Partial<IEvent>, username = 'admin'): Promise<IEvent> {
    const existing = await this.findEventRecord(id);
    if (!existing) {
      throw new AppError('Event not found.', 404);
    }

    const updates: Partial<IEvent> = {};
    if (data.event_name !== undefined) {
      const name = String(data.event_name).trim();
      if (!name) throw new AppError('Event name cannot be empty.', 400);
      updates.event_name = name;
    }
    if (data.description !== undefined) {
      const desc = String(data.description).trim();
      if (!desc) throw new AppError('Event description cannot be empty.', 400);
      updates.description = desc;
    }
    if (data.event_date !== undefined) {
      const d = new Date(data.event_date);
      if (isNaN(d.getTime())) throw new AppError('Invalid event date provided.', 400);
      updates.event_date = d.toISOString();
    }
    if (data.attendee_count !== undefined) {
      const cnt = Number(data.attendee_count);
      if (isNaN(cnt) || cnt < 1) throw new AppError('Attendee count must be at least 1.', 400);
      updates.attendee_count = cnt;
    }
    if (data.location !== undefined) {
      updates.location = String(data.location).trim();
    }
    if (data.services_provided !== undefined) {
      if (Array.isArray(data.services_provided)) {
        updates.services_provided = data.services_provided.map((s: any) => {
          if (typeof s === 'string') return { name: s.trim() };
          return { name: String(s.name || '').trim(), description: s.description ? String(s.description).trim() : undefined };
        }).filter((s) => s.name.length > 0);
      }
    }
    updates.updatedAt = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        await Event.findByIdAndUpdate(existing.id, { $set: updates });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.events) {
        const ev = s.events.find((e: any) => e.id === id || e._id === id);
        if (ev) Object.assign(ev, updates);
      }
    });

    const updated = await this.findEventRecord(id);
    if (!updated) {
      throw new AppError('Failed to retrieve updated event.', 500);
    }
    db.logAudit('EVENT_UPDATED', username, `Updated event: "${updated.event_name}" (${id})`);
    return updated;
  },

  /**
   * Update event status (publish, unpublish, archive) with publishing safeguards
   */
  async updateEventStatus(id: string, status: EventStatus, username = 'admin'): Promise<IEvent> {
    const validStatuses: EventStatus[] = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const event = await this.findEventRecord(id);
    if (!event) {
      throw new AppError('Event not found.', 404);
    }

    // Publishing safeguards
    if (status === 'published') {
      if (!event.event_name || !event.description || !event.event_date || !event.attendee_count) {
        throw new AppError('Cannot publish event: Missing mandatory event details.', 400);
      }

      // Check for cover image / existing photographs
      if (!event.cover_image) {
        const photos = await eventMediaService.getEventMedia(id);
        if (photos.length === 0) {
          throw new AppError('Cannot publish event without at least one photograph / cover image.', 400);
        }
        // Auto-assign first photo as cover
        await eventMediaService.setCoverImage(id, photos[0].id, username);
        event.cover_image = photos[0].image_url;
      }
    }

    const now = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        await Event.findByIdAndUpdate(event.id, { $set: { status, updatedAt: now } });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.events) {
        const ev = s.events.find((e: any) => e.id === id || e._id === id);
        if (ev) {
          ev.status = status;
          ev.updatedAt = now;
        }
      }
    });

    event.status = status;
    event.updatedAt = now;

    db.logAudit('EVENT_STATUS_CHANGED', username, `Changed status of event "${event.event_name}" to ${status.toUpperCase()}`);
    return event;
  },

  /**
   * Delete event and all associated media
   */
  async deleteEvent(id: string, username = 'admin'): Promise<{ success: boolean; message: string }> {
    const event = await this.findEventRecord(id);
    if (!event) {
      throw new AppError('Event not found.', 404);
    }

    // Clean up all associated media (Cloudinary + DB records)
    await eventMediaService.deleteMediaByEventId(id);

    if (mongoose.connection.readyState === 1) {
      try {
        await Event.findByIdAndDelete(event.id);
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.events) {
        s.events = s.events.filter((e: any) => e.id !== id && e._id !== id);
      }
    });

    db.logAudit('EVENT_DELETED', username, `Deleted event "${event.event_name}" (${id}) and associated media`);
    return { success: true, message: 'Event and associated media deleted successfully.' };
  },

  /**
   * Helper: Find event record across Mongoose or local store
   */
  async findEventRecord(id: string): Promise<IEvent | null> {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Event.findById(id).lean();
        if (doc) {
          return {
            id: String(doc._id),
            event_name: doc.event_name,
            description: doc.description,
            event_date: doc.event_date,
            attendee_count: doc.attendee_count,
            services_provided: doc.services_provided || [],
            location: doc.location,
            status: doc.status,
            cover_image: doc.cover_image,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const events: IEvent[] = state.events || [];
    return events.find((e: any) => e.id === id || e._id === id) || null;
  },
};

export default eventService;
