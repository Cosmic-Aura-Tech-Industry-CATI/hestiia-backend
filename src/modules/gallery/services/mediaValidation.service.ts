import mongoose from 'mongoose';
import { AppError } from '../../../shared/utils/appError.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_CAPTION_LENGTH = 500;
const MAX_TITLE_LENGTH = 150;

export const mediaValidationService = {
  /**
   * Validate uploaded file content, size, and MIME type
   */
  validateImageFile(file?: Express.Multer.File): void {
    if (!file) {
      throw new AppError('An image file is required for upload.', 400);
    }

    if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      throw new AppError('Invalid image format. Permitted formats: JPEG, PNG, WEBP.', 400);
    }

    if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError('File size exceeds the 5MB upload limit.', 400);
    }

    if (file.size === 0) {
      throw new AppError('Uploaded image file is empty.', 400);
    }
  },

  /**
   * Validate text caption length and content
   */
  validateCaption(caption?: string): string {
    if (!caption) return '';
    const trimmed = String(caption).trim();
    if (trimmed.length > MAX_CAPTION_LENGTH) {
      throw new AppError(`Caption cannot exceed ${MAX_CAPTION_LENGTH} characters.`, 400);
    }
    return trimmed;
  },

  /**
   * Validate official media title
   */
  validateTitle(title?: string): string {
    if (!title) return '';
    const trimmed = String(title).trim();
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new AppError(`Title cannot exceed ${MAX_TITLE_LENGTH} characters.`, 400);
    }
    return trimmed;
  },

  /**
   * Validate string or MongoDB ObjectId
   */
  validateId(id: string, entityName = 'Resource'): string {
    const trimmed = String(id || '').trim();
    if (!trimmed) {
      throw new AppError(`Valid ${entityName} ID is required.`, 400);
    }
    return trimmed;
  },
};

export default mediaValidationService;
