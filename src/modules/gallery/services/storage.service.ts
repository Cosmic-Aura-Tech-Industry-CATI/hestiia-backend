import fs from 'fs';
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from '../../../shared/config/cloudinary.js';
import { AppError } from '../../../shared/utils/appError.js';

export interface StorageUploadResult {
  imageUrl: string;
  publicId: string;
  storageProvider: 'cloudinary' | 'local';
  mimeType: string;
  fileSize: number;
  format?: string;
  width?: number;
  height?: number;
}

export const storageService = {
  /**
   * Upload an image file to Cloudinary with local storage fallback
   */
  async uploadFile(file: Express.Multer.File, folder = 'restaurant/gallery'): Promise<StorageUploadResult> {
    if (!file) {
      throw new AppError('No image file provided for upload.', 400);
    }

    const fileSize = file.size || 0;
    const mimeType = file.mimetype || 'image/jpeg';
    let imageUrl = `/uploads/${file.filename}`;
    let publicId = `local_${file.filename}`;
    let storageProvider: 'cloudinary' | 'local' = 'local';
    let format = file.mimetype ? file.mimetype.split('/')[1] : 'jpeg';
    let width: number | undefined;
    let height: number | undefined;

    // Check if Cloudinary is active and temp file exists on disk
    if (isCloudinaryConfigured() && file.path && fs.existsSync(file.path)) {
      try {
        const cloudResult = await uploadToCloudinary(file.path, {
          folder,
          quality: 'auto',
          tags: ['restaurant_gallery', folder.replace('/', '_')],
        });

        imageUrl = cloudResult.secure_url;
        publicId = cloudResult.public_id;
        storageProvider = 'cloudinary';
        format = cloudResult.format || format;
        width = cloudResult.width;
        height = cloudResult.height;

        // Clean up temporary disk file after cloud upload
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore cleanup error
        }
      } catch (err: any) {
        console.warn('[StorageService] Cloudinary upload notice, using local path:', err?.message);
      }
    }

    return {
      imageUrl,
      publicId,
      storageProvider,
      mimeType,
      fileSize,
      format,
      width,
      height,
    };
  },

  /**
   * Delete an asset from Cloudinary
   */
  async deleteFile(publicId: string, storageProvider: 'cloudinary' | 'local'): Promise<void> {
    if (!publicId || publicId.startsWith('local_') || storageProvider === 'local') {
      return;
    }

    try {
      await deleteFromCloudinary(publicId);
    } catch (err: any) {
      console.warn('[StorageService] Asset deletion notice:', err?.message);
    }
  },
};

export default storageService;
