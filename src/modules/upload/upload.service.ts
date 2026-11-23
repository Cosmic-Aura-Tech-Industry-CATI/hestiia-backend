import fs from 'fs';
import path from 'path';
import { db } from '../../shared/config/db.js';
import { UPLOADS_DIR } from '../../shared/config/utils.js';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
} from '../../shared/config/cloudinary.js';
import { AppError } from '../../shared/utils/appError.js';
import type {
  ProcessedUploadResult,
  UploadOptions,
  MultipleUploadResult,
  UploadStorageStats,
  DeleteUploadResult,
} from './upload.interface.js';

export const uploadService = {
  /**
   * Process and upload a single file (Cloudinary CDN with local disk fallback)
   */
  async processAndUpload(
    file: Express.Multer.File,
    options: UploadOptions = {}
  ): Promise<ProcessedUploadResult> {
    const { folder = 'hestiia_restaurant/media', username = 'admin', clientIp = 'unknown' } = options;

    if (!file || !file.path) {
      throw new AppError('Invalid file provided for upload.', 400);
    }

    // 1. Attempt Cloudinary CDN upload if credentials exist
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
        } catch {}

        db.logAudit(
          'IMAGE_UPLOADED_CLOUDINARY',
          username,
          `Uploaded to Cloudinary: ${uploadResult.public_id} (${Math.round((uploadResult.bytes || file.size) / 1024)} KB, ${uploadResult.format})`,
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
          mimeType: file.mimetype,
          originalName: file.originalname,
        };
      } catch (cloudErr: any) {
        console.warn(`[Cloudinary] Upload failed (${cloudErr?.message || 'Error'}). Falling back to local storage.`);
      }
    }

    // 2. Local Disk Fallback
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
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  },

  /**
   * Process multiple files in parallel
   */
  async processMultiple(
    files: Express.Multer.File[],
    options: UploadOptions = {}
  ): Promise<MultipleUploadResult> {
    if (!files || files.length === 0) {
      throw new AppError('No files were provided for multiple upload.', 400);
    }

    const results = await Promise.all(
      files.map((file) => this.processAndUpload(file, options))
    );

    return {
      count: results.length,
      files: results,
    };
  },

  /**
   * Delete uploaded media file from local storage and/or Cloudinary
   */
  async deleteFile(filenameOrPublicId: string, actor = 'Superadmin'): Promise<DeleteUploadResult> {
    if (!filenameOrPublicId) {
      throw new AppError('Filename or publicId is required for deletion.', 400);
    }

    const cleanIdentifier = path.basename(filenameOrPublicId);
    const localFilePath = path.join(UPLOADS_DIR, cleanIdentifier);
    let deletedLocal = false;
    let deletedCloud = false;

    // Check local disk
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        deletedLocal = true;
      }
    } catch {}

    // Check Cloudinary
    if (isCloudinaryConfigured()) {
      try {
        const cloudRes = await deleteFromCloudinary(filenameOrPublicId);
        if (cloudRes?.result === 'ok') {
          deletedCloud = true;
        }
      } catch {}
    }

    if (!deletedLocal && !deletedCloud) {
      throw new AppError(`File "${filenameOrPublicId}" not found on disk or CDN.`, 404);
    }

    const provider = deletedLocal && deletedCloud ? 'both' : deletedCloud ? 'cloudinary' : 'local';
    db.logAudit('DELETE_UPLOADED_FILE', actor, `Deleted asset: ${filenameOrPublicId} (Provider: ${provider})`);

    return {
      deleted: true,
      filename: filenameOrPublicId,
      provider,
      message: `File "${filenameOrPublicId}" successfully removed from ${provider} storage.`,
    };
  },

  /**
   * Storage and disk usage metrics
   */
  async getStorageStats(): Promise<UploadStorageStats> {
    let localFileCount = 0;
    let localTotalBytes = 0;

    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const entries = fs.readdirSync(UPLOADS_DIR);
        for (const entry of entries) {
          const fullPath = path.join(UPLOADS_DIR, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              localFileCount += 1;
              localTotalBytes += stat.size;
            }
          } catch {}
        }
      }
    } catch {}

    const isCloud = isCloudinaryConfigured();
    const provider: 'cloudinary' | 'local' | 'hybrid' = isCloud
      ? localFileCount > 0
        ? 'hybrid'
        : 'cloudinary'
      : 'local';

    return {
      provider,
      isCloudinaryConfigured: isCloud,
      localFileCount,
      localTotalBytes,
      localTotalMegabytes: Number((localTotalBytes / (1024 * 1024)).toFixed(2)),
      uploadsDirectory: UPLOADS_DIR,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
      maxFileSizeBytes: 5 * 1024 * 1024,
      maxFileSizeMB: 5,
    };
  },

  async getStatus() {
    const stats = await this.getStorageStats();
    return {
      module: 'upload',
      status: 'operational',
      storageProvider: stats.provider,
      cloudinaryEnabled: stats.isCloudinaryConfigured,
      localFilesCount: stats.localFileCount,
      localDiskUsageMB: stats.localTotalMegabytes,
      timestamp: new Date().toISOString(),
    };
  },
};

export default uploadService;
