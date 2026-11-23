export type UploaderType = 'admin' | 'customer';
export type MediaSource = 'official' | 'customer';
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type MediaVisibility = 'public' | 'private';

export interface IGallerySection {
  id: string;
  _id?: any;
  name: string;
  description?: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IMedia {
  id: string;
  _id?: any;
  title?: string;
  caption?: string;
  description?: string;
  altText?: string;
  imageUrl: string;
  publicId: string;
  storageProvider: 'cloudinary' | 'local';
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  uploaderType: UploaderType;
  uploadedByAdmin?: string;
  guestId?: string; // Strictly hidden from public responses
  sectionId?: string;
  mediaSource: MediaSource;
  moderationStatus: ModerationStatus;
  publicationStatus: PublicationStatus;
  visibility: MediaVisibility;
  displayOrder: number;
  rejectionReason?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IMediaModeration {
  id: string;
  _id?: any;
  mediaId: string;
  reviewedBy: string;
  action: 'approved' | 'rejected' | 'removed';
  reason?: string;
  reviewedAt: string | Date;
}

export interface IPublicMediaResponse {
  _id: string;
  id: string;
  imageUrl: string;
  title?: string;
  caption?: string;
  description?: string;
  altText?: string;
  section?: {
    id: string;
    name: string;
    slug: string;
  };
  postedBy: string; // e.g. "Posted by a customer" or "Hestiia Official"
  displayOrder: number;
  createdAt: string | Date;
}
