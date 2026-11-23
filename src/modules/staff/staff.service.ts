import mongoose from 'mongoose';
import { StaffMember, StaffShift } from './staff.model.js';
import { ordersService } from '../orders/orders.service.js';
import { tablesService } from '../tables/tables.service.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';
import { logger } from '../../config/logger.js';
import type {
  IStaffMember,
  IStaffShift,
  CreateStaffMemberDTO,
  UpdateStaffMemberDTO,
  ClockInDTO,
  ClockOutDTO,
  KitchenKDSQuery,
  KitchenKDSTicket,
  KitchenStats,
} from './staff.interface.js';

// Seed default staff members when collection is empty
const INITIAL_STAFF_MEMBERS: IStaffMember[] = [
  {
    employeeId: 'HST-EMP-01',
    name: 'Chef Vikram Sharma',
    email: 'vikram.chef@hestiia.com',
    phone: '+91 98765 01001',
    role: 'chef',
    department: 'kitchen',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-01-15',
    hourlyRate: 350,
    notes: 'Executive Chef specializing in Awadhi & North Indian cuisine',
  },
  {
    employeeId: 'HST-EMP-02',
    name: 'Chef Priya Nair',
    email: 'priya.sous@hestiia.com',
    phone: '+91 98765 01002',
    role: 'sous_chef',
    department: 'kitchen',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-03-20',
    hourlyRate: 280,
    notes: 'Sous Chef leading appetizers and dessert presentation',
  },
  {
    employeeId: 'HST-EMP-03',
    name: 'Rahul Verma',
    email: 'rahul.captain@hestiia.com',
    phone: '+91 98765 01003',
    role: 'captain',
    department: 'front_of_house',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-02-10',
    hourlyRate: 220,
    notes: 'Floor Captain & VIP guest concierge',
  },
  {
    employeeId: 'HST-EMP-04',
    name: 'Aman Singh',
    email: 'aman.waiter@hestiia.com',
    phone: '+91 98765 01004',
    role: 'waiter',
    department: 'front_of_house',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-06-01',
    hourlyRate: 160,
    notes: 'Senior Server assigned to central dining section',
  },
  {
    employeeId: 'HST-EMP-05',
    name: 'Ravi Kumar',
    email: 'ravi.rider@hestiia.com',
    phone: '+91 98765 01005',
    role: 'delivery',
    department: 'logistics',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-04-12',
    hourlyRate: 180,
    notes: 'Primary express delivery rider (Bike UP-78-EF-9012)',
  },
  {
    employeeId: 'HST-EMP-06',
    name: 'Neha Gupta',
    email: 'neha.cashier@hestiia.com',
    phone: '+91 98765 01006',
    role: 'cashier',
    department: 'management',
    branchId: 'branch_shyam_nagar',
    status: 'active',
    joiningDate: '2023-05-18',
    hourlyRate: 200,
    notes: 'Billing desk supervisor & POS terminal operator',
  },
];

// In-memory fallbacks
let inMemoryStaff: IStaffMember[] = [...INITIAL_STAFF_MEMBERS];
let inMemoryShifts: IStaffShift[] = [];

export const staffService = {
  /**
   * Auto-seed staff members in Atlas if collection is empty
   */
  async ensureSeedData() {
    if (mongoose.connection.readyState === 1) {
      try {
        const count = await StaffMember.countDocuments();
        if (count === 0) {
          await StaffMember.insertMany(INITIAL_STAFF_MEMBERS);
          logger.info('[StaffService] Seeded default staff members into MongoDB Atlas');
        }
      } catch (err) {
        logger.warn('[StaffService] Failed to auto-seed staff members:', err);
      }
    }
  },

  // -------------------------------------------------------------
  // 1. Staff Member Directory Management
  // -------------------------------------------------------------

  async getStaffMembers(query: {
    role?: string;
    department?: string;
    status?: string;
    branchId?: string;
    search?: string;
  } = {}) {
    await this.ensureSeedData();
    const { role, department, status, branchId, search } = query;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (role) filter.role = role.toLowerCase();
        if (department) filter.department = department.toLowerCase();
        if (status) filter.status = status.toLowerCase();
        if (branchId) filter.branchId = branchId;

        if (search) {
          const regex = new RegExp(search.trim(), 'i');
          filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { employeeId: regex }];
        }

        const members = await StaffMember.find(filter).sort({ name: 1 }).lean();
        return members.map((m: any) => ({
          ...m,
          id: m._id ? m._id.toString() : m.id,
        }));
      } catch { }
    }

    // In-memory fallback
    return inMemoryStaff.filter((m) => {
      if (role && m.role !== role.toLowerCase()) return false;
      if (department && m.department !== department.toLowerCase()) return false;
      if (status && m.status !== status.toLowerCase()) return false;
      if (branchId && m.branchId !== branchId) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          m.phone.toLowerCase().includes(s) ||
          m.employeeId.toLowerCase().includes(s)
        );
      }
      return true;
    });
  },

  async getStaffMemberById(id: string) {
    if (!id) throw new AppError('Staff ID is required', 400);

    if (mongoose.connection.readyState === 1) {
      try {
        let member: any = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          member = await StaffMember.findById(id).lean();
        }
        if (!member) {
          member = await StaffMember.findOne({ employeeId: id.toUpperCase() }).lean();
        }
        if (member) {
          return { ...member, id: member._id ? member._id.toString() : member.id };
        }
      } catch { }
    }

    const found = inMemoryStaff.find((m) => m.id === id || m.employeeId === id.toUpperCase());
    if (!found) throw new AppError(`Staff member with identifier "${id}" not found`, 404);
    return found;
  },

  async createStaffMember(dto: CreateStaffMemberDTO, actor = 'Superadmin') {
    if (!dto.name || !dto.email || !dto.phone) {
      throw new AppError('Staff name, email, and phone number are required', 400);
    }

    const employeeId =
      dto.employeeId?.toUpperCase() ||
      `HST-EMP-${Math.floor(100 + Math.random() * 900)}`;

    const newStaff: IStaffMember = {
      employeeId,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      role: dto.role || 'staff',
      department: dto.department || 'kitchen',
      branchId: dto.branchId || 'branch_shyam_nagar',
      status: dto.status || 'active',
      joiningDate: dto.joiningDate || new Date().toISOString().split('T')[0],
      emergencyContact: dto.emergencyContact || '',
      hourlyRate: dto.hourlyRate !== undefined ? Number(dto.hourlyRate) : 0,
      notes: dto.notes || '',
    };

    let created: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await StaffMember.create(newStaff);
        created = doc.toJSON();
      } catch (err: any) {
        if (err.code === 11000) {
          throw new AppError('A staff member with this email or Employee ID already exists', 409);
        }
        throw err;
      }
    }

    if (!created) {
      const id = new mongoose.Types.ObjectId().toString();
      created = { ...newStaff, id, createdAt: new Date(), updatedAt: new Date() };
      inMemoryStaff.push(created);
    }

    db.logAudit('CREATE_STAFF_MEMBER', actor, `Added staff member: ${newStaff.name} (${newStaff.employeeId})`);
    return created;
  },

  async updateStaffMember(id: string, dto: UpdateStaffMemberDTO, actor = 'Superadmin') {
    if (!id) throw new AppError('Staff ID is required', 400);

    const updateFields: any = { ...dto };
    if (updateFields.email) updateFields.email = updateFields.email.trim().toLowerCase();
    if (updateFields.hourlyRate !== undefined) updateFields.hourlyRate = Number(updateFields.hourlyRate);

    let updated: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          updated = await StaffMember.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).lean();
        } else {
          updated = await StaffMember.findOneAndUpdate(
            { employeeId: id.toUpperCase() },
            { $set: updateFields },
            { new: true }
          ).lean();
        }
        if (updated) {
          updated.id = updated._id ? updated._id.toString() : updated.id;
        }
      } catch { }
    }

    if (!updated) {
      const idx = inMemoryStaff.findIndex((m) => m.id === id || m.employeeId === id.toUpperCase());
      if (idx === -1) throw new AppError('Staff member not found', 404);
      inMemoryStaff[idx] = { ...inMemoryStaff[idx], ...updateFields, updatedAt: new Date() };
      updated = inMemoryStaff[idx];
    }

    db.logAudit('UPDATE_STAFF_MEMBER', actor, `Updated staff profile for: ${updated.name}`);
    return updated;
  },

  async deleteStaffMember(id: string, actor = 'Superadmin') {
    return this.updateStaffMember(id, { status: 'terminated' }, actor);
  },

  // -------------------------------------------------------------
  // 2. Staff Shifts & Clock-In / Clock-Out
  // -------------------------------------------------------------

  async clockIn(dto: ClockInDTO, actor = 'Staff') {
    let staffMember: any = null;
    if (dto.staffId) {
      staffMember = await this.getStaffMemberById(dto.staffId);
    } else {
      const staffList = await this.getStaffMembers();
      staffMember = staffList.find((s) => s.name.toLowerCase() === actor.toLowerCase()) || staffList[0];
    }

    if (!staffMember) {
      throw new AppError('Staff member profile not found for clock in', 404);
    }

    // Check if staff member already has an active shift
    const existingActive = await this.findActiveShiftForStaff(staffMember.id || staffMember.employeeId);
    if (existingActive) {
      throw new AppError(
        `Staff member "${staffMember.name}" already has an active shift started at ${existingActive.startTime}`,
        400
      );
    }

    const shiftNumber = `HST-SH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const newShift: IStaffShift = {
      shiftNumber,
      staffId: staffMember.id || staffMember.employeeId,
      staffName: staffMember.name,
      staffRole: staffMember.role || dto.role || 'staff',
      department: staffMember.department || dto.department || 'kitchen',
      branchId: staffMember.branchId || dto.branchId || 'branch_shyam_nagar',
      shiftType: dto.shiftType || 'morning',
      startTime: new Date(),
      breakDurationMinutes: 0,
      status: 'active',
      clockInNotes: dto.clockInNotes || '',
    };

    let created: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await StaffShift.create(newShift);
        created = doc.toJSON();
      } catch { }
    }

    if (!created) {
      const id = new mongoose.Types.ObjectId().toString();
      created = { ...newShift, id, createdAt: new Date(), updatedAt: new Date() };
      inMemoryShifts.push(created);
    }

    db.logAudit('STAFF_CLOCK_IN', staffMember.name, `Clocked in for shift ${shiftNumber}`);
    return created;
  },

  async clockOut(shiftId?: string, dto: ClockOutDTO = {}, actor = 'Staff') {
    let targetShift: any = null;

    if (shiftId) {
      if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(shiftId)) {
        targetShift = await StaffShift.findById(shiftId);
      }
      if (!targetShift) {
        targetShift = inMemoryShifts.find((s) => s.id === shiftId || s.shiftNumber === shiftId);
      }
    } else {
      // Find latest active shift for actor
      const activeShifts = await this.getActiveShifts();
      targetShift = activeShifts.find((s) => s.staffName.toLowerCase() === actor.toLowerCase()) || activeShifts[0];
    }

    if (!targetShift) {
      throw new AppError('No active shift found to clock out from', 404);
    }

    if (targetShift.status === 'completed') {
      throw new AppError('This shift has already been completed', 400);
    }

    const endTime = new Date();
    const startTime = new Date(targetShift.startTime);
    const breakMinutes = dto.breakDurationMinutes !== undefined ? Number(dto.breakDurationMinutes) : targetShift.breakDurationMinutes || 0;
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const totalHours = Math.max(0, Number((diffHours - breakMinutes / 60).toFixed(2)));

    let updated: any = null;
    if (mongoose.connection.readyState === 1 && targetShift._id) {
      try {
        targetShift.endTime = endTime;
        targetShift.breakDurationMinutes = breakMinutes;
        targetShift.clockOutNotes = dto.clockOutNotes || '';
        targetShift.totalHours = totalHours;
        targetShift.status = 'completed';
        await targetShift.save();
        updated = targetShift.toJSON();
      } catch { }
    }

    if (!updated) {
      targetShift.endTime = endTime;
      targetShift.breakDurationMinutes = breakMinutes;
      targetShift.clockOutNotes = dto.clockOutNotes || '';
      targetShift.totalHours = totalHours;
      targetShift.status = 'completed';
      updated = targetShift;
    }

    db.logAudit('STAFF_CLOCK_OUT', targetShift.staffName, `Clocked out shift ${targetShift.shiftNumber} (Duration: ${totalHours} hrs)`);
    return updated;
  },

  async findActiveShiftForStaff(staffId: string) {
    if (mongoose.connection.readyState === 1) {
      try {
        const shift = await StaffShift.findOne({ staffId, status: 'active' }).lean();
        if (shift) return { ...shift, id: (shift as any)._id?.toString() || shift.id };
      } catch { }
    }
    return inMemoryShifts.find((s) => s.staffId === staffId && s.status === 'active') || null;
  },

  async getActiveShifts(branchId = 'branch_shyam_nagar') {
    if (mongoose.connection.readyState === 1) {
      try {
        const shifts = await StaffShift.find({ status: 'active', branchId }).sort({ startTime: -1 }).lean();
        return shifts.map((s: any) => ({
          ...s,
          id: s._id ? s._id.toString() : s.id,
        }));
      } catch { }
    }
    return inMemoryShifts.filter((s) => s.status === 'active' && s.branchId === branchId);
  },

  async getShifts(query: {
    staffId?: string;
    status?: string;
    branchId?: string;
    limit?: number;
    skip?: number;
  } = {}) {
    const { staffId, status, branchId, limit = 50, skip = 0 } = query;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (staffId) filter.staffId = staffId;
        if (status) filter.status = status.toLowerCase();
        if (branchId) filter.branchId = branchId;

        const shifts = await StaffShift.find(filter)
          .sort({ startTime: -1 })
          .skip(Number(skip))
          .limit(Number(limit))
          .lean();

        const total = await StaffShift.countDocuments(filter);
        return {
          shifts: shifts.map((s: any) => ({ ...s, id: s._id ? s._id.toString() : s.id })),
          total,
        };
      } catch { }
    }

    const filtered = inMemoryShifts.filter((s) => {
      if (staffId && s.staffId !== staffId) return false;
      if (status && s.status !== status.toLowerCase()) return false;
      if (branchId && s.branchId !== branchId) return false;
      return true;
    });

    return {
      shifts: filtered.slice(skip, skip + limit),
      total: filtered.length,
    };
  },

  // -------------------------------------------------------------
  // 3. Kitchen Display System (KDS) & Order Processing
  // -------------------------------------------------------------

  /**
   * Retrieves active kitchen tickets (confirmed & preparing orders)
   * Ordered FIFO by creation time with prep timer calculation
   */
  async getKitchenOrders(query: KitchenKDSQuery = {}) {
    const activeStatuses = query.orderStatus
      ? [query.orderStatus.toLowerCase()]
      : ['confirmed', 'preparing'];

    const result = await ordersService.getAdminOrders({
      ...query,
      orderStatus: activeStatuses.join(','),
      limit: 100,
    });

    const orders = result?.orders || [];
    const now = Date.now();

    const tickets: KitchenKDSTicket[] = orders.map((o: any) => {
      const createdAtMs = new Date(o.createdAt).getTime();
      const elapsedMinutes = Math.max(0, Math.floor((now - createdAtMs) / (1000 * 60)));
      const isDelayed = elapsedMinutes >= 25 && o.orderStatus !== 'ready_for_pickup';

      return {
        id: o.id || o._id,
        orderNumber: o.orderNumber,
        orderStatus: o.orderStatus,
        fulfillmentType: o.fulfillmentType || 'dine_in',
        customerName: o.customerName || 'Diner',
        customerPhone: o.customerPhone || '',
        deliveryAddress: o.deliveryAddress,
        notes: o.notes,
        items: (o.items || []).map((it: any) => ({
          dishId: it.dishId,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          itemNotes: it.itemNotes || '',
        })),
        itemCount: (o.items || []).reduce((acc: number, curr: any) => acc + (curr.quantity || 1), 0),
        elapsedMinutes,
        isDelayed,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    // Sort FIFO: oldest tickets first so kitchen prioritizes correctly
    tickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      count: tickets.length,
      delayedCount: tickets.filter((t) => t.isDelayed).length,
      tickets,
    };
  },

  /**
   * Updates order lifecycle state on kitchen station
   */
  async updateKitchenOrderStatus(orderId: string, status: string, note?: string, actor = 'Kitchen Station') {
    const updated = await ordersService.updateOrderStatus(orderId, status, note, actor);
    return updated;
  },

  /**
   * Fast actions for kitchen station
   */
  async markOrderPreparing(orderId: string, note = 'Chef accepted ticket and began cooking', actor = 'Chef') {
    return this.updateKitchenOrderStatus(orderId, 'preparing', note, actor);
  },

  async markOrderReady(orderId: string, note = 'Plated and marked ready by kitchen station', actor = 'Chef') {
    return this.updateKitchenOrderStatus(orderId, 'ready_for_pickup', note, actor);
  },

  /**
   * Real-time kitchen throughput & SLA metrics
   */
  async getKitchenStats(): Promise<KitchenStats> {
    const kdsResult = await this.getKitchenOrders();
    const tickets = kdsResult.tickets;

    const confirmedCount = tickets.filter((t) => t.orderStatus === 'confirmed').length;
    const preparingCount = tickets.filter((t) => t.orderStatus === 'preparing').length;

    // Also get orders marked ready_for_pickup awaiting delivery rider or waitstaff pickup
    const readyResult = await ordersService.getAdminOrders({ orderStatus: 'ready_for_pickup', limit: 100 });
    const readyForPickupCount = readyResult?.orders?.length || 0;

    const delayedTicketsCount = tickets.filter((t) => t.isDelayed).length;
    const totalActiveTickets = confirmedCount + preparingCount;

    const totalPrepMinutes = tickets.reduce((acc, t) => acc + t.elapsedMinutes, 0);
    const avgPrepTimeMinutes = totalActiveTickets > 0 ? Math.round(totalPrepMinutes / totalActiveTickets) : 0;

    return {
      confirmedCount,
      preparingCount,
      readyForPickupCount,
      totalActiveTickets,
      delayedTicketsCount,
      avgPrepTimeMinutes,
    };
  },

  // -------------------------------------------------------------
  // 4. Dining Room & Tables Coordination
  // -------------------------------------------------------------

  async getStaffTables() {
    return tablesService.getTables();
  },

  async getStatus() {
    return {
      module: 'staff',
      status: 'operational',
      activeShifts: (await this.getActiveShifts()).length,
      kitchenActiveTickets: (await this.getKitchenStats()).totalActiveTickets,
      timestamp: new Date().toISOString(),
    };
  },
};

export default staffService;
