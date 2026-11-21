export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
] as const;

export const FULFILLMENT_TYPES = ['dine-in', 'pickup', 'delivery'] as const;
export const TABLE_STATUSES = ['available', 'reserved', 'occupied', 'cleaning'] as const;
export const ADMIN_ROLES = ['superadmin', 'manager', 'staff'] as const;
