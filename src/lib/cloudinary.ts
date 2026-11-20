import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_FOLDER,
} from './env';
import { AppError } from './errors';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function ensureCloudinaryConfigured() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError(
      'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.',
      500
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Validate image MIME type and size, then stream the buffer directly to Cloudinary.
 */
export async function uploadImageToCloudinary(
  file: File,
  subFolder = 'uploads'
): Promise<{
  url: string;
  publicId: string;
  filename: string;
  size: number;
  format?: string;
}> {
  ensureCloudinaryConfigured();

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError(
      'Invalid file type. Only JPEG, PNG, WEBP, AVIF, and GIF images are permitted.',
      400
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError('File size exceeds the 5MB upload limit.', 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const folder = `${CLOUDINARY_FOLDER}/${subFolder}`;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error || new Error('Cloudinary upload returned empty result.'));
          return;
        }
        resolve(uploadResult);
      }
    );

    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    filename: file.name,
    size: file.size,
    format: result.format,
  };
}

/**
 * Upload a local file path to Cloudinary (used by one-time JSON migration script).
 */
export async function uploadLocalFileToCloudinary(
  localPath: string,
  subFolder = 'uploads',
  publicIdOverride?: string
): Promise<string> {
  ensureCloudinaryConfigured();
  const result = await cloudinary.uploader.upload(localPath, {
    folder: `${CLOUDINARY_FOLDER}/${subFolder}`,
    public_id: publicIdOverride,
    overwrite: true,
    resource_type: 'image',
  });
  return result.secure_url;
}
