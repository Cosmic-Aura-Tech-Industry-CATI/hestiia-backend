import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_URL,
} from './utils.js';

let isConfigured = false;

if (CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: CLOUDINARY_URL,
  });
  isConfigured = true;
} else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  isConfigured = true;
}

export function isCloudinaryConfigured(): boolean {
  return isConfigured;
}

export interface CloudinaryProcessOptions {
  folder?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: string | number;
  tags?: string[];
  publicId?: string;
}

export async function uploadToCloudinary(
  filePath: string,
  options: CloudinaryProcessOptions = {}
): Promise<UploadApiResponse> {
  const {
    folder = 'hestiia_restaurant/uploads',
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 'auto',
    tags = ['hestiia_restaurant'],
    publicId,
  } = options;

  return cloudinary.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    resource_type: 'image',
    tags,
    transformation: [
      {
        width: maxWidth,
        height: maxHeight,
        crop: 'limit',
        quality,
        fetch_format: 'auto',
      },
    ],
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<any> {
  if (!isConfigured) return null;
  return cloudinary.uploader.destroy(publicId);
}

export { cloudinary };
export default cloudinary;
