import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { GallerySection } from '../models/gallerySection.model.js';
import { Media } from '../models/media.model.js';
import { IGallerySection } from '../interfaces/gallery.interface.js';

export const INITIAL_SECTIONS: Array<Omit<IGallerySection, 'id'>> = [
  { name: 'Restaurant Interior', slug: 'interior', description: 'Warm and inviting indoor seating and architectural details', displayOrder: 1, isActive: true, isPublic: true },
  { name: 'Restaurant Exterior', slug: 'exterior', description: 'Facade, entrance, and lush green banquet surroundings', displayOrder: 2, isActive: true, isPublic: true },
  { name: 'Dining Area', slug: 'dining-area', description: 'Main hall dining, family booths, and royal banquet setups', displayOrder: 3, isActive: true, isPublic: true },
  { name: 'Ambience', slug: 'ambience', description: 'Evening mood lighting, candlelit tables, and tranquil sanctuary vibes', displayOrder: 4, isActive: true, isPublic: true },
  { name: 'Kitchen & Culinary', slug: 'kitchen', description: 'Live tandoor, wok fires, and artisanal culinary craft in motion', displayOrder: 5, isActive: true, isPublic: true },
  { name: 'Customer Moments', slug: 'customer-moments', description: 'Shared smiles, celebrations, and customer contributions', displayOrder: 6, isActive: true, isPublic: true },
  { name: 'General Gallery', slug: 'general', description: 'General restaurant highlights and signature dining moments', displayOrder: 7, isActive: true, isPublic: true },
];

export const mediaCategoryService = {
  /**
   * Helper: Ensure default seed sections exist
   */
  async ensureSeedSections(): Promise<void> {
    const state = db.getState() as any;
    if (!state.gallerySections || state.gallerySections.length === 0) {
      const now = new Date().toISOString();
      const seeded: IGallerySection[] = INITIAL_SECTIONS.map((sec, idx) => ({
        id: 'sec_' + (idx + 1) + '_' + sec.slug,
        ...sec,
        createdAt: now,
        updatedAt: now,
      }));

      db.updateState((s: any) => {
        s.gallerySections = seeded;
      });

      if (mongoose.connection.readyState === 1) {
        try {
          for (const s of seeded) {
            await GallerySection.findOneAndUpdate(
              { slug: s.slug },
              { $setOnInsert: s },
              { upsert: true }
            );
          }
        } catch {
          // ignore
        }
      }
    }
  },

  /**
   * Retrieve active public gallery sections for customer website
   */
  async getPublicSections(): Promise<IGallerySection[]> {
    await this.ensureSeedSections();

    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await GallerySection.find({ isActive: true, isPublic: true })
          .sort({ displayOrder: 1, createdAt: 1 })
          .lean();
        if (docs && docs.length > 0) {
          return docs.map((d: any) => ({
            id: String(d._id),
            name: d.name,
            description: d.description,
            slug: d.slug,
            displayOrder: d.displayOrder ?? 0,
            isActive: d.isActive,
            isPublic: d.isPublic,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const items: IGallerySection[] = state.gallerySections || [];
    return items
      .filter((s) => s.isActive && s.isPublic)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  /**
   * Retrieve all gallery sections for Admin Dashboard
   */
  async getAdminSections(): Promise<IGallerySection[]> {
    await this.ensureSeedSections();

    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await GallerySection.find()
          .sort({ displayOrder: 1, createdAt: 1 })
          .lean();
        if (docs && docs.length > 0) {
          return docs.map((d: any) => ({
            id: String(d._id),
            name: d.name,
            description: d.description,
            slug: d.slug,
            displayOrder: d.displayOrder ?? 0,
            isActive: d.isActive,
            isPublic: d.isPublic,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    return (state.gallerySections || []).sort((a: any, b: any) => a.displayOrder - b.displayOrder);
  },

  /**
   * Find section by ID or Slug
   */
  async findSection(idOrSlug: string): Promise<IGallerySection | null> {
    await this.ensureSeedSections();

    if (mongoose.connection.readyState === 1) {
      try {
        const query: any = mongoose.isValidObjectId(idOrSlug)
          ? { _id: idOrSlug }
          : { $or: [{ slug: idOrSlug.toLowerCase() }, { _id: idOrSlug }] };
        const doc = await GallerySection.findOne(query).lean();
        if (doc) {
          return {
            id: String(doc._id),
            name: doc.name,
            description: doc.description,
            slug: doc.slug,
            displayOrder: doc.displayOrder,
            isActive: doc.isActive,
            isPublic: doc.isPublic,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const list: IGallerySection[] = state.gallerySections || [];
    return list.find((s) => s.id === idOrSlug || (s as any)._id === idOrSlug || s.slug === idOrSlug.toLowerCase()) || null;
  },

  /**
   * Create new gallery section
   */
  async createSection(data: Partial<IGallerySection>, username = 'admin'): Promise<IGallerySection> {
    const name = String(data.name || '').trim();
    if (!name) {
      throw new AppError('Section name is required.', 400);
    }

    const slug = (data.slug ? String(data.slug) : name)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new AppError('A valid alphanumeric section slug is required.', 400);
    }

    const existing = await this.findSection(slug);
    if (existing) {
      throw new AppError(`A section with slug "${slug}" already exists.`, 400);
    }

    const now = new Date().toISOString();
    const newSection: IGallerySection = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name,
      description: data.description ? String(data.description).trim() : '',
      slug,
      displayOrder: Number(data.displayOrder ?? 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
      createdAt: now,
      updatedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await GallerySection.create({
          name: newSection.name,
          description: newSection.description,
          slug: newSection.slug,
          displayOrder: newSection.displayOrder,
          isActive: newSection.isActive,
          isPublic: newSection.isPublic,
        });
        newSection.id = String(doc._id);
      } catch (err: any) {
        console.warn('[MediaCategory] Mongoose create notice:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.gallerySections) s.gallerySections = [];
      s.gallerySections.push(newSection);
    });

    db.logAudit('GALLERY_SECTION_CREATED', username, `Created gallery section "${name}" (${slug})`);
    return newSection;
  },

  /**
   * Update gallery section
   */
  async updateSection(id: string, data: Partial<IGallerySection>, username = 'admin'): Promise<IGallerySection> {
    const section = await this.findSection(id);
    if (!section) {
      throw new AppError('Gallery section not found.', 404);
    }

    const updates: Partial<IGallerySection> = {};
    if (data.name !== undefined) {
      const trimmed = String(data.name).trim();
      if (!trimmed) throw new AppError('Section name cannot be empty.', 400);
      updates.name = trimmed;
    }
    if (data.description !== undefined) {
      updates.description = String(data.description).trim();
    }
    if (data.displayOrder !== undefined) {
      updates.displayOrder = Number(data.displayOrder);
    }
    if (data.isActive !== undefined) {
      updates.isActive = Boolean(data.isActive);
    }
    if (data.isPublic !== undefined) {
      updates.isPublic = Boolean(data.isPublic);
    }
    updates.updatedAt = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        await GallerySection.findByIdAndUpdate(section.id, { $set: updates });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.gallerySections) {
        const target = s.gallerySections.find((sec: any) => sec.id === section.id || sec._id === section.id);
        if (target) Object.assign(target, updates);
      }
    });

    const updated = await this.findSection(section.id);
    db.logAudit('GALLERY_SECTION_UPDATED', username, `Updated gallery section "${updated?.name || id}"`);
    return updated || section;
  },

  /**
   * Delete gallery section safely (blocks deletion if section contains active photos)
   */
  async deleteSection(id: string, username = 'admin'): Promise<{ success: boolean; message: string }> {
    const section = await this.findSection(id);
    if (!section) {
      throw new AppError('Gallery section not found.', 404);
    }

    // Safety check: Prevent deletion if photos are assigned to this section
    let photoCount = 0;
    if (mongoose.connection.readyState === 1) {
      try {
        photoCount = await Media.countDocuments({ sectionId: { $in: [section.id, section.slug] } });
      } catch {
        // fallback
      }
    }

    if (photoCount === 0) {
      const state = db.getState() as any;
      const mediaList: any[] = state.media || [];
      photoCount = mediaList.filter((m) => m.sectionId === section.id || m.sectionId === section.slug).length;
    }

    if (photoCount > 0) {
      throw new AppError(
        `Cannot delete section "${section.name}": It contains ${photoCount} active photograph(s). Reassign or delete photos first.`,
        400
      );
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await GallerySection.findByIdAndDelete(section.id);
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.gallerySections) {
        s.gallerySections = s.gallerySections.filter((sec: any) => sec.id !== section.id && sec._id !== section.id && sec.slug !== section.slug);
      }
    });

    db.logAudit('GALLERY_SECTION_DELETED', username, `Deleted gallery section "${section.name}"`);
    return { success: true, message: `Gallery section "${section.name}" deleted successfully.` };
  },
};

export default mediaCategoryService;
