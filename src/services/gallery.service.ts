import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { GalleryPhotoModel, IGalleryPhoto } from '@/models/GalleryPhoto.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const galleryService = {
  async getPublicGallery() {
    await connectDB();
    const docs = await GalleryPhotoModel.find({}).sort({ displayOrder: 1 }).lean();
    return cleanDocs<IGalleryPhoto>(docs);
  },

  async getAdminGallery() {
    return this.getPublicGallery();
  },

  async addPhoto(data: any, username = 'admin') {
    const { title, category, image, description, isFeatured = false } = data;
    if (!title || !image) {
      throw new AppError('Photo title and image URL are required.', 400);
    }

    await connectDB();
    const total = await GalleryPhotoModel.countDocuments();
    const newPhoto: IGalleryPhoto = {
      id: `amb-${Date.now()}`,
      title: String(title).trim(),
      category: String(category || 'Ambience').trim(),
      image: String(image).trim(),
      description: String(description || '').trim(),
      isFeatured: Boolean(isFeatured),
      displayOrder: total + 1,
    };

    await GalleryPhotoModel.create(newPhoto);
    await logAudit(
      'ADD_GALLERY_PHOTO',
      username,
      `Added gallery photo: ${newPhoto.title}`
    );

    return newPhoto;
  },

  async updatePhoto(photoId: string, data: any, username = 'admin') {
    await connectDB();
    const { title, category, image, description, isFeatured, displayOrder } = data;

    const updates: Record<string, any> = {};
    if (title) updates.title = String(title).trim();
    if (category) updates.category = String(category).trim();
    if (image) updates.image = String(image).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (isFeatured !== undefined) updates.isFeatured = Boolean(isFeatured);
    if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);

    const updated = await GalleryPhotoModel.findOneAndUpdate(
      { id: photoId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Gallery photo not found.', 404);
    }

    const clean = cleanDoc<IGalleryPhoto>(updated);
    await logAudit('UPDATE_GALLERY_PHOTO', username, `Updated photo: ${clean.title}`);
    return clean;
  },

  async deletePhoto(photoId: string, username = 'admin') {
    await connectDB();
    await GalleryPhotoModel.deleteOne({ id: photoId });
    await logAudit(
      'DELETE_GALLERY_PHOTO',
      username,
      `Deleted gallery photo ${photoId}`
    );
  },
};
