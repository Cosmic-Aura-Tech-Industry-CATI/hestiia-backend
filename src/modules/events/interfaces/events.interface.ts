export type EventStatus = 'draft' | 'published' | 'archived';

export interface IEventServiceItem {
  name: string;
  description?: string;
}

export interface IEvent {
  id: string;
  _id?: string;
  event_name: string;
  description: string;
  event_date: string | Date;
  attendee_count: number;
  services_provided: IEventServiceItem[];
  location?: string;
  status: EventStatus;
  cover_image?: string;
  created_by?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IEventMedia {
  id: string;
  _id?: string;
  event_id: string;
  image_url: string;
  public_id: string;
  is_cover: boolean;
  display_order: number;
  caption?: string;
  createdAt?: string | Date;
}

export type EventInquiryStatus = 'pending' | 'contacted' | 'confirmed' | 'rejected' | 'completed';

export interface IEventInquiry {
  id: string;
  _id?: string;
  customer_name: string;
  email?: string;
  phone: string;
  event_type: string;
  preferred_date: string | Date;
  expected_attendees: number;
  requirements?: string;
  message?: string;
  status: EventInquiryStatus;
  admin_notes?: string;
  booking_id?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
