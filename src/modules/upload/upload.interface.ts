export interface ProcessedUploadResult {
  url: string;
  filename: string;
  size: number;
  provider: 'cloudinary' | 'local';
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  originalName?: string;
}

export interface UploadOptions {
  folder?: string;
  username?: string;
  clientIp?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: string | number;
}

export interface MultipleUploadResult {
  count: number;
  files: ProcessedUploadResult[];
}

export interface UploadStorageStats {
  provider: 'cloudinary' | 'local' | 'hybrid';
  isCloudinaryConfigured: boolean;
  localFileCount: number;
  localTotalBytes: number;
  localTotalMegabytes: number;
  uploadsDirectory: string;
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  maxFileSizeMB: number;
}

export interface DeleteUploadResult {
  deleted: boolean;
  filename: string;
  provider: 'cloudinary' | 'local' | 'both';
  message: string;
}
