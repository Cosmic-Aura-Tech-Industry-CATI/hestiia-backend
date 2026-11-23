import mongoose from 'mongoose';
import { Table, type ITableDocument } from './table.model.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';
import { logger } from '../../config/logger.js';
import type {
  ITable,
  TableStatus,
  CreateTableDTO,
  UpdateTableDTO,
  TableQuery,
  TableStats,
  ZoneSummary,
} from './table.interface.js';

const DEFAULT_TABLES: ITable[] = [
  {
    id: 'tbl_1',
    tableNumber: 'Table 1',
    zone: 'AC Main Hall',
    capacity: 4,
    status: 'available',
    shape: 'square',
    branchId: 'branch_shyam_nagar',
    description: 'Central main hall table near front fountain',
    isActive: true,
  },
  {
    id: 'tbl_2',
    tableNumber: 'Table 2',
    zone: 'AC Main Hall',
    capacity: 4,
    status: 'available',
    shape: 'square',
    branchId: 'branch_shyam_nagar',
    description: 'Window-side dining table overlooking gardens',
    isActive: true,
  },
  {
    id: 'tbl_3',
    tableNumber: 'Table 3',
    zone: 'AC Main Hall',
    capacity: 2,
    status: 'available',
    shape: 'round',
    branchId: 'branch_shyam_nagar',
    description: 'Intimate candlelit couple dining table',
    isActive: true,
  },
  {
    id: 'tbl_4',
    tableNumber: 'Booth B1',
    zone: 'Leather Booths',
    capacity: 6,
    status: 'available',
    shape: 'booth',
    branchId: 'branch_shyam_nagar',
    description: 'Semi-private leather booth with acoustic isolation',
    isActive: true,
  },
  {
    id: 'tbl_5',
    tableNumber: 'Booth B2',
    zone: 'Leather Booths',
    capacity: 6,
    status: 'reserved',
    shape: 'booth',
    branchId: 'branch_shyam_nagar',
    description: 'Premium dining booth adjacent to mocktail bar',
    isActive: true,
  },
  {
    id: 'tbl_6',
    tableNumber: 'Table 5',
    zone: 'Family Lounge',
    capacity: 8,
    status: 'available',
    shape: 'rectangular',
    branchId: 'branch_shyam_nagar',
    description: 'Large family gathering round table with lazy Susan',
    isActive: true,
  },
  {
    id: 'tbl_7',
    tableNumber: 'Table 6',
    zone: 'Family Lounge',
    capacity: 10,
    status: 'available',
    shape: 'rectangular',
    branchId: 'branch_shyam_nagar',
    description: 'Extended banquet table for celebrations & birthdays',
    isActive: true,
  },
  {
    id: 'tbl_8',
    tableNumber: 'Rooftop R1',
    zone: 'Rooftop Terrace',
    capacity: 4,
    status: 'available',
    shape: 'square',
    branchId: 'branch_shyam_nagar',
    description: 'Open air terrace seating with panoramic city view',
    isActive: true,
  },
];

let inMemoryTables: ITable[] = [...DEFAULT_TABLES];

export const tablesService = {
  /**
   * Auto-seed default dining tables in Atlas if collection is empty
   */
  async ensureSeedData() {
    if (mongoose.connection.readyState === 1) {
      try {
        const count = await Table.countDocuments();
        if (count === 0) {
          await Table.insertMany(DEFAULT_TABLES);
          logger.info('[TablesService] Initialized default tables in MongoDB Atlas');
        }
      } catch (err) {
        logger.warn('[TablesService] Auto-seed failed:', err);
      }
    }
  },

  /**
   * List dining tables with optional filters
   */
  async getTables(query: TableQuery = {}): Promise<ITable[]> {
    await this.ensureSeedData();
    const { zone, status, minCapacity, maxCapacity, isActive, search } = query;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (zone) filter.zone = zone;
        if (status) filter.status = status;
        if (isActive !== undefined) {
          filter.isActive = String(isActive) !== 'false';
        } else {
          filter.isActive = true;
        }

        if (minCapacity || maxCapacity) {
          filter.capacity = {};
          if (minCapacity) filter.capacity.$gte = Number(minCapacity);
          if (maxCapacity) filter.capacity.$lte = Number(maxCapacity);
        }

        if (search) {
          const regex = new RegExp(search.trim(), 'i');
          filter.$or = [{ tableNumber: regex }, { zone: regex }, { description: regex }];
        }

        const tables = await Table.find(filter).sort({ tableNumber: 1 }).lean();
        return tables.map((t: any) => ({
          ...t,
          id: t._id ? t._id.toString() : t.id,
        }));
      } catch {}
    }

    // In-memory fallback
    return inMemoryTables.filter((t) => {
      if (zone && t.zone.toLowerCase() !== zone.toLowerCase()) return false;
      if (status && t.status !== status) return false;
      if (isActive !== undefined && t.isActive !== (String(isActive) !== 'false')) return false;
      if (minCapacity && t.capacity < Number(minCapacity)) return false;
      if (maxCapacity && t.capacity > Number(maxCapacity)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          t.tableNumber.toLowerCase().includes(s) ||
          t.zone.toLowerCase().includes(s) ||
          (t.description && t.description.toLowerCase().includes(s))
        );
      }
      return true;
    });
  },

  /**
   * Find table by id or tableNumber
   */
  async getTableById(id: string): Promise<ITable> {
    if (!id) throw new AppError('Table ID is required', 400);

    if (mongoose.connection.readyState === 1) {
      try {
        let table: any = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          table = await Table.findById(id).lean();
        }
        if (!table) {
          table = await Table.findOne({ tableNumber: id }).lean();
        }
        if (table) {
          return { ...table, id: table._id ? table._id.toString() : table.id };
        }
      } catch {}
    }

    const found = inMemoryTables.find((t) => t.id === id || t.tableNumber.toLowerCase() === id.toLowerCase());
    if (!found) throw new AppError(`Table "${id}" not found`, 404);
    return found;
  },

  /**
   * Create a new table asset
   */
  async createTable(data: CreateTableDTO, actor = 'Superadmin'): Promise<ITable> {
    if (!data.tableNumber) {
      throw new AppError('Table number is required', 400);
    }

    const tableData: ITable = {
      tableNumber: data.tableNumber.trim(),
      zone: data.zone?.trim() || 'AC Main Hall',
      capacity: data.capacity !== undefined ? Number(data.capacity) : 4,
      status: data.status || 'available',
      shape: data.shape || 'square',
      qrCodeUrl: data.qrCodeUrl || '',
      branchId: data.branchId || 'branch_shyam_nagar',
      description: data.description?.trim() || '',
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    let created: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Table.create(tableData);
        created = doc.toJSON();
      } catch (err: any) {
        if (err.code === 11000) {
          throw new AppError(`Table with number "${tableData.tableNumber}" already exists`, 409);
        }
        throw err;
      }
    }

    if (!created) {
      const id = 'tbl_' + Date.now();
      created = { ...tableData, id, createdAt: new Date(), updatedAt: new Date() };
      inMemoryTables.push(created);
    }

    db.logAudit('CREATE_TABLE', actor, `Created dining table: ${created.tableNumber} (Capacity: ${created.capacity})`);
    return created;
  },

  /**
   * Update table specifications
   */
  async updateTable(id: string, updates: UpdateTableDTO, actor = 'Superadmin'): Promise<ITable> {
    if (!id) throw new AppError('Table ID is required', 400);

    const updateFields: any = { ...updates };
    if (updateFields.capacity !== undefined) updateFields.capacity = Number(updateFields.capacity);
    if (updateFields.isActive !== undefined) updateFields.isActive = Boolean(updateFields.isActive);

    let updated: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const queryOr: any[] = [{ tableNumber: id }];
        if (mongoose.Types.ObjectId.isValid(id)) {
          queryOr.unshift({ _id: id });
        }
        updated = await Table.findOneAndUpdate(
          { $or: queryOr },
          { $set: updateFields },
          { new: true }
        ).lean();
        if (updated) {
          updated.id = updated._id ? updated._id.toString() : updated.id;
        }
      } catch {}
    }

    if (!updated) {
      const idx = inMemoryTables.findIndex((t) => t.id === id || t.tableNumber.toLowerCase() === id.toLowerCase());
      if (idx === -1) throw new AppError('Table not found', 404);
      inMemoryTables[idx] = { ...inMemoryTables[idx], ...updateFields, updatedAt: new Date() };
      updated = inMemoryTables[idx];
    }

    db.logAudit('UPDATE_TABLE', actor, `Updated specifications for table: ${updated.tableNumber}`);
    return updated;
  },

  /**
   * Quick status transition (available, reserved, occupied, cleaning, maintenance)
   */
  async updateStatus(id: string, status: TableStatus, actor = 'Staff'): Promise<ITable> {
    const validStatuses: TableStatus[] = ['available', 'reserved', 'occupied', 'cleaning', 'maintenance'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid table status. Allowed values: ${validStatuses.join(', ')}`, 400);
    }

    let updated: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const queryOr: any[] = [{ tableNumber: id }];
        if (mongoose.Types.ObjectId.isValid(id)) {
          queryOr.unshift({ _id: id });
        }
        updated = await Table.findOneAndUpdate(
          { $or: queryOr },
          { $set: { status } },
          { new: true }
        ).lean();
        if (updated) {
          updated.id = updated._id ? updated._id.toString() : updated.id;
        }
      } catch {}
    }

    if (!updated) {
      const table = inMemoryTables.find((t) => t.id === id || t.tableNumber.toLowerCase() === id.toLowerCase());
      if (!table) throw new AppError('Table not found', 404);
      table.status = status;
      table.updatedAt = new Date();
      updated = table;
    }

    db.logAudit('UPDATE_TABLE_STATUS', actor, `Table ${updated.tableNumber} status set to "${status}"`);
    return updated;
  },

  /**
   * Soft-delete / deactivate table
   */
  async deleteTable(id: string, actor = 'Superadmin'): Promise<ITable> {
    return this.updateTable(id, { isActive: false }, actor);
  },

  /**
   * Calculate dining room occupancy statistics
   */
  async getTableStats(): Promise<TableStats> {
    const tables = await this.getTables({ isActive: true });
    const totalTables = tables.length;
    const availableTables = tables.filter((t) => t.status === 'available').length;
    const reservedTables = tables.filter((t) => t.status === 'reserved').length;
    const occupiedTables = tables.filter((t) => t.status === 'occupied').length;
    const cleaningTables = tables.filter((t) => t.status === 'cleaning').length;
    const maintenanceTables = tables.filter((t) => t.status === 'maintenance').length;
    const totalSeats = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);

    const occupancyPercentage =
      totalTables > 0 ? Math.round(((occupiedTables + reservedTables) / totalTables) * 100) : 0;

    return {
      totalTables,
      availableTables,
      reservedTables,
      occupiedTables,
      cleaningTables,
      maintenanceTables,
      totalSeats,
      occupancyPercentage,
    };
  },

  /**
   * Group dining tables by restaurant zones
   */
  async getZones(): Promise<ZoneSummary[]> {
    const tables = await this.getTables({ isActive: true });
    const zoneMap = new Map<string, ZoneSummary>();

    for (const t of tables) {
      const z = t.zone || 'Main Dining';
      if (!zoneMap.has(z)) {
        zoneMap.set(z, {
          zone: z,
          tableCount: 0,
          totalCapacity: 0,
          availableTables: 0,
        });
      }
      const entry = zoneMap.get(z)!;
      entry.tableCount += 1;
      entry.totalCapacity += t.capacity || 0;
      if (t.status === 'available') entry.availableTables += 1;
    }

    return Array.from(zoneMap.values()).sort((a, b) => b.totalCapacity - a.totalCapacity);
  },
};

export default tablesService;
