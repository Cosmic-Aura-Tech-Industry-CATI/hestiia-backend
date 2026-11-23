import { Document } from 'mongoose';

export type TableStatus = 'available' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance';

export type TableShape = 'square' | 'round' | 'rectangular' | 'booth';

export interface ITable {
  id?: string;
  tableNumber: string;
  zone: string;
  capacity: number;
  status: TableStatus;
  shape?: TableShape;
  qrCodeUrl?: string;
  branchId?: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ITableDocument extends Document, Omit<ITable, 'id'> {
  id: string;
}

export interface CreateTableDTO {
  tableNumber: string;
  zone?: string;
  capacity?: number;
  status?: TableStatus;
  shape?: TableShape;
  qrCodeUrl?: string;
  branchId?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTableDTO {
  tableNumber?: string;
  zone?: string;
  capacity?: number;
  status?: TableStatus;
  shape?: TableShape;
  qrCodeUrl?: string;
  branchId?: string;
  description?: string;
  isActive?: boolean;
}

export interface TableQuery {
  zone?: string;
  status?: TableStatus;
  minCapacity?: number;
  maxCapacity?: number;
  isActive?: boolean | string;
  search?: string;
}

export interface TableStats {
  totalTables: number;
  availableTables: number;
  reservedTables: number;
  occupiedTables: number;
  cleaningTables: number;
  maintenanceTables: number;
  totalSeats: number;
  occupancyPercentage: number;
}

export interface ZoneSummary {
  zone: string;
  tableCount: number;
  totalCapacity: number;
  availableTables: number;
}
