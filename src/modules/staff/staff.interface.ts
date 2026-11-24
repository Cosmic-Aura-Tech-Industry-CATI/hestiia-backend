import { Document } from 'mongoose';

export type StaffRole =
  | 'chef'
  | 'sous_chef'
  | 'cook'
  | 'waiter'
  | 'captain'
  | 'bartender'
  | 'cashier'
  | 'manager'
  | 'delivery'
  | 'staff';

export type StaffDepartment = 'kitchen' | 'front_of_house' | 'logistics' | 'management';

export type StaffStatus = 'active' | 'on_leave' | 'terminated' | 'inactive';

export type ShiftType = 'morning' | 'evening' | 'night' | 'full_day';

export type ShiftStatus = 'active' | 'completed' | 'cancelled';

export interface IStaffMember {
  id?: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  department: StaffDepartment;
  branchId: string;
  status: StaffStatus;
  joiningDate: string;
  emergencyContact?: string;
  hourlyRate?: number;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IStaffMemberDocument extends Document, Omit<IStaffMember, 'id'> {
  id: string;
}

export interface IStaffShift {
  id?: string;
  shiftNumber: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  department: StaffDepartment;
  branchId: string;
  shiftType: ShiftType;
  startTime: Date | string;
  endTime?: Date | string;
  breakDurationMinutes: number;
  status: ShiftStatus;
  clockInNotes?: string;
  clockOutNotes?: string;
  totalHours?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IStaffShiftDocument extends Document, Omit<IStaffShift, 'id'> {
  id: string;
}

export interface CreateStaffMemberDTO {
  employeeId?: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  department?: StaffDepartment;
  branchId?: string;
  status?: StaffStatus;
  joiningDate?: string;
  emergencyContact?: string;
  hourlyRate?: number;
  notes?: string;
}

export interface UpdateStaffMemberDTO {
  name?: string;
  email?: string;
  phone?: string;
  role?: StaffRole;
  department?: StaffDepartment;
  branchId?: string;
  status?: StaffStatus;
  emergencyContact?: string;
  hourlyRate?: number;
  notes?: string;
}

export interface ClockInDTO {
  staffId?: string;
  staffName?: string;
  role?: StaffRole;
  department?: StaffDepartment;
  branchId?: string;
  shiftType?: ShiftType;
  clockInNotes?: string;
}

export interface ClockOutDTO {
  shiftId?: string;
  clockOutNotes?: string;
  breakDurationMinutes?: number;
}

export interface KitchenKDSQuery {
  orderStatus?: string;
  fulfillmentType?: string;
  search?: string;
}

export interface KitchenTicketItem {
  dishId: string;
  name: string;
  quantity: number;
  price: number;
  itemNotes?: string;
}

export interface KitchenKDSTicket {
  id: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentType: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  notes?: string;
  items: KitchenTicketItem[];
  itemCount: number;
  elapsedMinutes: number;
  isDelayed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenStats {
  confirmedCount: number;
  preparingCount: number;
  readyForPickupCount: number;
  totalActiveTickets: number;
  delayedTicketsCount: number;
  avgPrepTimeMinutes: number;
}
