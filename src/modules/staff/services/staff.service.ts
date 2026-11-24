import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Staff } from '../models/staff.model.js';
import {
  IStaffMember,
  ICreateStaffDTO,
  IUpdateStaffDTO,
  IStaffQuery,
  IStaffListResponse,
} from '../interfaces/staff.interface.js';
import {
  validateObjectId,
  validateStaffName,
  validateStaffPhone,
  validateStaffEmail,
  validateStaffRole,
} from '../validators/staff.validator.js';

export const staffService = {
  /**
   * Service 1: Create a new staff member
   */
  async createStaff(data: ICreateStaffDTO, actor = 'admin'): Promise<IStaffMember> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('Request body must be a valid JSON object.', 400);
    }

    // Check for unexpected or protected fields
    const allowedFields = new Set(['name', 'phone', 'email', 'role']);
    const providedKeys = Object.keys(data);
    for (const key of providedKeys) {
      if (!allowedFields.has(key)) {
        throw new AppError(`Unexpected field "${key}" provided. Only name, phone, email, and role are permitted.`, 400);
      }
    }

    // Validate fields
    const name = validateStaffName(data.name);
    const phone = validateStaffPhone(data.phone);
    const email = validateStaffEmail(data.email);
    const role = validateStaffRole(data.role);

    // 1. Check duplicate email and phone in database/store
    await this.checkDuplicateEmail(email);
    await this.checkDuplicatePhone(phone);

    const now = new Date();
    const newId = new mongoose.Types.ObjectId().toHexString();

    const staffRecord: IStaffMember = {
      _id: newId,
      name,
      phone,
      email,
      role: 'staff',
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Save in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Staff.create({
          _id: new mongoose.Types.ObjectId(newId),
          name: staffRecord.name,
          phone: staffRecord.phone,
          email: staffRecord.email,
          role: 'staff',
          isActive: true,
        });
        staffRecord._id = doc._id.toString();
        staffRecord.createdAt = doc.createdAt;
        staffRecord.updatedAt = doc.updatedAt;
      } catch (err: any) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || 'credential';
          throw new AppError(`Employee with this ${field} already exists.`, 409);
        }
        throw err;
      }
    }

    // Synchronize into persistent local store
    db.updateState((state: any) => {
      if (!state.staff) state.staff = [];
      state.staff.unshift({ ...staffRecord });
    });

    db.logAudit('STAFF_CREATED', actor, `Registered staff employee "${name}" (${staffRecord._id}) with phone ${phone}`);
    return staffRecord;
  },

  /**
   * Service 2: Get all staff members with pagination, search, status filtering, and sorting
   */
  async getAllStaff(query: IStaffQuery = {}): Promise<IStaffListResponse> {
    // Validate pagination parameters
    let page = 1;
    if (query.page !== undefined && query.page !== '') {
      page = parseInt(String(query.page), 10);
      if (isNaN(page) || page < 1) {
        throw new AppError('Page parameter must be a positive integer greater than or equal to 1.', 400);
      }
    }

    let limit = 10;
    if (query.limit !== undefined && query.limit !== '') {
      limit = parseInt(String(query.limit), 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new AppError('Limit parameter must be an integer between 1 and 100.', 400);
      }
    }

    // Validate status filter
    let statusFilter: 'active' | 'inactive' | 'all' = 'active';
    if (query.status !== undefined && (query.status as any) !== '') {
      const s = String(query.status).trim().toLowerCase();
      if (s !== 'active' && s !== 'inactive' && s !== 'all') {
        throw new AppError(`Invalid status filter "${query.status}". Allowed values: 'active', 'inactive', 'all'.`, 400);
      }
      statusFilter = s as any;
    }

    // Validate sorting parameters
    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'name', 'email', 'phone']);
    let sortBy = 'createdAt';
    if (query.sortBy !== undefined && (query.sortBy as any) !== '') {
      const cleanSort = String(query.sortBy).trim();
      if (!allowedSortFields.has(cleanSort)) {
        throw new AppError(`Invalid sortBy field "${query.sortBy}". Allowed fields: createdAt, updatedAt, name, email, phone.`, 400);
      }
      sortBy = cleanSort;
    }

    let order: 'asc' | 'desc' = 'desc';
    if (query.order !== undefined && (query.order as any) !== '') {
      const cleanOrder = String(query.order).trim().toLowerCase();
      if (cleanOrder !== 'asc' && cleanOrder !== 'desc') {
        throw new AppError('Order parameter must be either "asc" or "desc".', 400);
      }
      order = cleanOrder as any;
    }

    const search = query.search ? String(query.search).trim() : '';

    // MongoDB Atlas query when connected
    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (statusFilter === 'active') {
          filter.isActive = true;
        } else if (statusFilter === 'inactive') {
          filter.isActive = false;
        }

        if (search) {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter.$or = [
            { name: { $regex: escapedSearch, $options: 'i' } },
            { phone: { $regex: escapedSearch, $options: 'i' } },
            { email: { $regex: escapedSearch, $options: 'i' } },
          ];
        }

        const total = await Staff.countDocuments(filter);
        const sortOptions: any = { [sortBy]: order === 'asc' ? 1 : -1 };

        const docs = await Staff.find(filter)
          .sort(sortOptions)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        const staff: IStaffMember[] = docs.map((d: any) => ({
          _id: d._id.toString(),
          name: d.name,
          phone: d.phone,
          email: d.email,
          role: 'staff',
          isActive: d.isActive,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));

        return {
          staff,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
        };
      } catch (err: any) {
        console.warn('[StaffService] MongoDB find failed, falling back to persistent local store:', err?.message);
      }
    }

    // Fallback: Persistent local store
    const state = db.getState() as any;
    let records: IStaffMember[] = (state.staff || []).map((s: any) => ({
      _id: String(s._id || s.id),
      name: s.name,
      phone: s.phone,
      email: s.email,
      role: 'staff',
      isActive: Boolean(s.isActive),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    // Filter by status
    if (statusFilter === 'active') {
      records = records.filter((r) => r.isActive === true);
    } else if (statusFilter === 'inactive') {
      records = records.filter((r) => r.isActive === false);
    }

    // Filter by search
    if (search) {
      const term = search.toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.phone.toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term)
      );
    }

    // Sort records
    records.sort((a: any, b: any) => {
      const valA = a[sortBy] ?? '';
      const valB = b[sortBy] ?? '';
      let comp = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comp = valA.localeCompare(valB);
      } else {
        comp = valA < valB ? -1 : valA > valB ? 1 : 0;
      }
      return order === 'asc' ? comp : -comp;
    });

    const total = records.length;
    const paginated = records.slice((page - 1) * limit, page * limit);

    return {
      staff: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Service 3: Get staff member by ID
   */
  async getStaffById(id: string): Promise<IStaffMember> {
    const cleanId = validateObjectId(id, 'staff ID');

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Staff.findById(cleanId).lean();
        if (doc) {
          return {
            _id: doc._id.toString(),
            name: doc.name,
            phone: doc.phone,
            email: doc.email,
            role: 'staff',
            isActive: doc.isActive,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // Continue to fallback
      }
    }

    const state = db.getState() as any;
    const found = (state.staff || []).find((s: any) => String(s._id || s.id) === cleanId);
    if (!found) {
      throw new AppError('Staff member not found.', 404);
    }

    return {
      _id: String(found._id || found.id),
      name: found.name,
      phone: found.phone,
      email: found.email,
      role: 'staff',
      isActive: Boolean(found.isActive),
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };
  },

  /**
   * Service 4: Update staff member information
   */
  async updateStaff(id: string, data: IUpdateStaffDTO, actor = 'admin'): Promise<IStaffMember> {
    const cleanId = validateObjectId(id, 'staff ID');

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('Request body must be a valid JSON object.', 400);
    }

    if (Object.keys(data).length === 0) {
      throw new AppError('Request body cannot be empty.', 400);
    }

    // Verify staff exists first
    const existing = await this.getStaffById(cleanId);

    // Protected field checks
    if ((data as any)._id !== undefined || (data as any).id !== undefined) {
      throw new AppError('Modifying employee ID is not permitted.', 400);
    }
    if ((data as any).isActive !== undefined) {
      throw new AppError('Direct modification of activation status is not permitted. Use the delete endpoint for deactivation.', 400);
    }
    if ((data as any).createdAt !== undefined) {
      throw new AppError('Modifying creation timestamp is not permitted.', 400);
    }
    if (data.role !== undefined) {
      const cleanRole = String(data.role).trim().toLowerCase();
      if (cleanRole !== 'staff') {
        throw new AppError(`Cannot change employee role to "${data.role}". Only 'staff' role is permitted.`, 400);
      }
    }

    // Validate unexpected fields
    const allowedFields = new Set(['name', 'phone', 'email', 'role']);
    for (const key of Object.keys(data)) {
      if (!allowedFields.has(key)) {
        throw new AppError(`Unexpected field "${key}" provided. Only name, phone, and email can be updated.`, 400);
      }
    }

    const updates: Partial<IStaffMember> = {};

    if (data.name !== undefined) {
      updates.name = validateStaffName(data.name);
    }

    if (data.email !== undefined) {
      const newEmail = validateStaffEmail(data.email);
      if (newEmail !== existing.email.toLowerCase()) {
        await this.checkDuplicateEmail(newEmail, cleanId);
        updates.email = newEmail;
      }
    }

    if (data.phone !== undefined) {
      const newPhone = validateStaffPhone(data.phone);
      if (newPhone !== existing.phone) {
        await this.checkDuplicatePhone(newPhone, cleanId);
        updates.phone = newPhone;
      }
    }

    const now = new Date();
    updates.updatedAt = now.toISOString();

    // Persist to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const updatedDoc = await Staff.findByIdAndUpdate(
          cleanId,
          { $set: updates },
          { new: true, runValidators: true }
        ).lean();

        if (updatedDoc) {
          updates.updatedAt = updatedDoc.updatedAt;
        }
      } catch (err: any) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || 'field';
          throw new AppError(`Employee with this ${field} already exists.`, 409);
        }
        throw err;
      }
    }

    // Persist to local store
    db.updateState((state: any) => {
      if (!state.staff) state.staff = [];
      const idx = state.staff.findIndex((s: any) => String(s._id || s.id) === cleanId);
      if (idx !== -1) {
        state.staff[idx] = {
          ...state.staff[idx],
          ...updates,
          updatedAt: updates.updatedAt,
        };
      }
    });

    const updated = {
      ...existing,
      ...updates,
      role: 'staff' as const,
    };

    db.logAudit('STAFF_UPDATED', actor, `Updated staff employee "${updated.name}" (${cleanId})`);
    return updated;
  },

  /**
   * Service 5: Soft delete (deactivate) staff member
   */
  async deleteStaff(id: string, actor = 'admin'): Promise<{ success: boolean; message: string }> {
    const cleanId = validateObjectId(id, 'staff ID');

    // Verify staff exists
    const existing = await this.getStaffById(cleanId);

    // Check if already inactive
    if (!existing.isActive) {
      throw new AppError('Staff member is already inactive.', 400);
    }

    const now = new Date();

    // Update in MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await Staff.findByIdAndUpdate(cleanId, {
          $set: { isActive: false, updatedAt: now },
        });
      } catch (err: any) {
        console.warn('[StaffService] MongoDB soft delete failed:', err?.message);
      }
    }

    // Update in local store
    db.updateState((state: any) => {
      if (!state.staff) state.staff = [];
      const idx = state.staff.findIndex((s: any) => String(s._id || s.id) === cleanId);
      if (idx !== -1) {
        state.staff[idx].isActive = false;
        state.staff[idx].updatedAt = now.toISOString();
      }
    });

    db.logAudit('STAFF_DEACTIVATED', actor, `Deactivated staff employee "${existing.name}" (${cleanId})`);
    return {
      success: true,
      message: 'Staff member deactivated successfully',
    };
  },

  /**
   * Helper: Check for duplicate email across MongoDB and store
   */
  async checkDuplicateEmail(email: string, excludeId?: string): Promise<void> {
    const normalized = email.trim().toLowerCase();

    if (mongoose.connection.readyState === 1) {
      const query: any = { email: normalized };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
      const existing = await Staff.findOne(query).lean();
      if (existing) {
        throw new AppError('Employee with this email address already exists.', 409);
      }
    }

    const state = db.getState() as any;
    const duplicate = (state.staff || []).find((s: any) => {
      const matchEmail = s.email && s.email.toLowerCase() === normalized;
      const matchId = excludeId && String(s._id || s.id) === excludeId;
      return matchEmail && !matchId;
    });

    if (duplicate) {
      throw new AppError('Employee with this email address already exists.', 409);
    }
  },

  /**
   * Helper: Check for duplicate phone across MongoDB and store
   */
  async checkDuplicatePhone(phone: string, excludeId?: string): Promise<void> {
    const normalized = phone.trim();

    if (mongoose.connection.readyState === 1) {
      const query: any = { phone: normalized };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
      const existing = await Staff.findOne(query).lean();
      if (existing) {
        throw new AppError('Employee with this phone number already exists.', 409);
      }
    }

    const state = db.getState() as any;
    const duplicate = (state.staff || []).find((s: any) => {
      const matchPhone = s.phone && s.phone === normalized;
      const matchId = excludeId && String(s._id || s.id) === excludeId;
      return matchPhone && !matchId;
    });

    if (duplicate) {
      throw new AppError('Employee with this phone number already exists.', 409);
    }
  },
};

export default staffService;
