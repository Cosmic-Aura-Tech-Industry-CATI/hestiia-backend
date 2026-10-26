export interface CreateBookingDTO {
  name?: string;
  customerName?: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests?: string;
  occasion?: string;
  requests?: string;
  specialRequests?: string;
}

export interface UpdateBookingStatusDTO {
  status: 'new' | 'contacted' | 'confirmed' | 'rescheduled' | 'rejected' | 'completed' | 'cancelled';
  staffNotes?: string;
  allocatedTable?: string;
  confirmationMethod?: 'on-screen' | 'whatsapp' | 'call';
}

export interface BookingConfirmationDTO {
  id: string;
  bookingRef: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: string;
  occasion: string;
  specialRequests?: string;
  status: string;
  allocatedTable?: string;
  holdPolicy: string;
  restaurantDetails: {
    name: string;
    tagline: string;
    phone: string;
    address: string;
    city: string;
    landmark: string;
    mapQuery: string;
  };
  confirmedAt?: string;
  createdAt: string;
}
