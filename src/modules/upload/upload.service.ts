import fs from 'fs';
import { db } from '../../shared/config/db.js';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
} from '../../shared/config/cloudinary.js';

export interface ProcessedUploadResult {
  url: string;
  filename: string;
  size: number;
  provider: 'cloudinary' | 'local';
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
}

export const uploadService = {
  async processAndUpload(
    file: Express.Multer.File,
    options: { folder?: string; username?: string; clientIp?: string } = {}
  ): Promise<ProcessedUploadResult> {
    const { folder = 'hestiia_restaurant/media', username = 'admin', clientIp = 'unknown' } = options;

    // Check if Cloudinary is configured
    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await uploadToCloudinary(file.path, {
          folder,
          quality: 'auto',
          tags: ['hestiia_restaurant', folder.split('/').pop() || 'media'],
        });

        // Clean up local temporary file after successful Cloudinary upload
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {
          // Non-fatal temporary file cleanup error
        }

        db.logAudit(
          'IMAGE_UPLOADED_CLOUDINARY',
          username,
          `Uploaded to Cloudinary: ${uploadResult.public_id} (${Math.round(uploadResult.bytes / 1024)} KB, ${uploadResult.format})`,
          clientIp
        );

        return {
          url: uploadResult.secure_url,
          filename: file.filename,
          size: uploadResult.bytes || file.size,
          provider: 'cloudinary',
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          width: uploadResult.width,
          height: uploadResult.height,
        };
      } catch (cloudErr: any) {
        console.warn(`[Cloudinary] Upload failed (${cloudErr?.message || 'Error'}). Falling back to local storage.`);
      }
    }

    // Local Disk Fallback
    const localUrl = `/uploads/${file.filename}`;
    db.logAudit(
      'IMAGE_UPLOADED_LOCAL',
      username,
      `Saved locally: ${file.filename} (${Math.round(file.size / 1024)} KB)`,
      clientIp
    );

    return {
      url: localUrl,
      filename: file.filename,
      size: file.size,
      provider: 'local',
    };
  },
};
