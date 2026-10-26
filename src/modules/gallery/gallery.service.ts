import { db, GalleryPhoto } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const galleryService = {
  async getPublicGallery() {
    return [...db.getState().gallery].sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async getAdminGallery() {
    return [...db.getState().gallery].sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async addPhoto(data: any, username = 'admin') {
    const { title, category, image, description, isFeatured = false } = data;

    if (!title || !image) {
      throw new AppError('Photo title and image URL are required.', 400);
    }

    const id = 'amb-' + Date.now();
    const newPhoto: GalleryPhoto = {
      id,
      title: title.trim(),
      category: (category || 'Ambience').trim(),
      image: image.trim(),
      description: (description || '').trim(),
      isFeatured: Boolean(isFeatured),
      displayOrder: db.getState().gallery.length + 1,
    };

    db.updateState((s) => s.gallery.push(newPhoto));
    db.logAudit('ADD_GALLERY_PHOTO', username, `Added gallery photo: ${newPhoto.title}`);

    return newPhoto;
  },

  async updatePhoto(photoId: string, data: any, username = 'admin') {
    const { title, category, image, description, isFeatured, displayOrder } = data;

    let updated: GalleryPhoto | null = null;
    db.updateState((s) => {
      const target = s.gallery.find((p) => p.id === photoId);
      if (target) {
        if (title) target.title = title.trim();
        if (category) target.category = category.trim();
        if (image) target.image = image.trim();
        if (description !== undefined) target.description = description.trim();
        if (isFeatured !== undefined) target.isFeatured = Boolean(isFeatured);
        if (displayOrder !== undefined) target.displayOrder = Number(displayOrder);
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Gallery photo not found.', 404);
    }

    db.logAudit('UPDATE_GALLERY_PHOTO', username, `Updated photo: ${(updated as GalleryPhoto).title}`);
    return updated;
  },

  async deletePhoto(photoId: string, username = 'admin') {
    db.updateState((s) => {
      s.gallery = s.gallery.filter((p) => p.id !== photoId);
    });
    db.logAudit('DELETE_GALLERY_PHOTO', username, `Deleted gallery photo ${photoId}`);
  },
};
