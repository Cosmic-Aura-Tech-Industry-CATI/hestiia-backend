import mongoose from 'mongoose';
import { DeliveryAssignment, type IDeliveryAssignmentDocument } from './delivery.model.js';
import { Order } from '../orders/order.model.js';
import { Setting } from '../settings/setting.model.js';
import { db } from '../../shared/config/store.js';
import { broadcast } from '../../sockets/socketServer.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.js';
import type {
  IDeliveryZone,
  IDeliveryAssignment,
  DeliveryTrackingStatus,
  ServiceabilityCheckResult,
} from './delivery.interface.js';

// Default delivery zones for dining radius
let deliveryZones: IDeliveryZone[] = [
  {
    id: 'zone_central',
    name: 'Sector 18 & Royal Boulevard (0-3 km)',
    pincodes: ['226001', '226010', '226016'],
    minOrderValue: 249,
    deliveryFee: 30,
    estimatedMinutes: 30,
    isActive: true,
  },
  {
    id: 'zone_suburban',
    name: 'Gomti Nagar & Aliganj (3-7 km)',
    pincodes: ['226020', '226024', '226028'],
    minOrderValue: 399,
    deliveryFee: 50,
    estimatedMinutes: 45,
    isActive: true,
  },
  {
    id: 'zone_outer',
    name: 'Outer Metro Express Zone (7-12 km)',
    pincodes: ['226012', '226021', '226025'],
    minOrderValue: 599,
    deliveryFee: 80,
    estimatedMinutes: 60,
    isActive: true,
  },
];

const fallbackDeliveriesStore: IDeliveryAssignment[] = [];

export const deliveryService = {
  /**
   * Check if delivery is serviceable to customer pincode & calculate fee
   */
  async checkServiceability(pincode: string, _address?: string): Promise<ServiceabilityCheckResult> {
    const cleanPincode = String(pincode || '').trim();
    if (!cleanPincode) {
      throw new BadRequestError('Pincode is required to check delivery serviceability');
    }

    const matchedZone = deliveryZones.find(
      (z) => z.isActive && z.pincodes.includes(cleanPincode)
    );

    if (matchedZone) {
      return {
        serviceable: true,
        pincode: cleanPincode,
        zoneName: matchedZone.name,
        deliveryFee: matchedZone.deliveryFee,
        minOrderValue: matchedZone.minOrderValue,
        estimatedMinutes: matchedZone.estimatedMinutes,
        message: `Delivery available in ${matchedZone.name}. Estimated delivery in ${matchedZone.estimatedMinutes} mins.`,
      };
    }

    // Default restaurant settings check
    let defaultFee = 40;
    let minOrder = 299;
    try {
      if (mongoose.connection.readyState === 1) {
        const settings = await Setting.findOne().lean();
        if (settings) {
          defaultFee = settings.deliveryFee ?? defaultFee;
          minOrder = settings.minOrderValue ?? minOrder;
        }
      }
    } catch {}

    // Pincode is not in configured priority zones
    return {
      serviceable: false,
      pincode: cleanPincode,
      deliveryFee: defaultFee,
      minOrderValue: minOrder,
      estimatedMinutes: 60,
      message: `We currently do not offer standard express delivery to pincode ${cleanPincode}. Please select Pickup or Dine-In.`,
    };
  },

  /**
   * Assign a delivery rider to an order and dispatch tracking events
   */
  async assignRider(
    orderNumber: string,
    riderData: {
      riderName: string;
      riderPhone: string;
      vehicleNumber?: string;
      estimatedMinutes?: number;
      deliveryNotes?: string;
    },
    staffUser?: any
  ): Promise<any> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required');
    }
    if (!riderData.riderName?.trim()) {
      throw new BadRequestError('Rider name is required');
    }
    if (!riderData.riderPhone?.trim()) {
      throw new BadRequestError('Rider phone is required');
    }

    let orderDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      orderDoc = await Order.findOne({ orderNumber: cleanOrderNumber }).lean();
    }
    if (!orderDoc) {
      const state = db.getState();
      orderDoc = state.orders.find((o) => o.orderNumber === cleanOrderNumber);
    }
    if (!orderDoc) {
      throw new NotFoundError(`Order #${cleanOrderNumber} not found`);
    }

    // Generate 4-digit customer delivery confirmation OTP
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const estMinutes = Number(riderData.estimatedMinutes) || 35;
    const estimatedArrival = new Date(Date.now() + estMinutes * 60000);

    const assignmentPayload: Partial<IDeliveryAssignment> = {
      orderNumber: cleanOrderNumber,
      riderName: riderData.riderName.trim(),
      riderPhone: riderData.riderPhone.trim(),
      vehicleNumber: riderData.vehicleNumber?.trim() || '',
      trackingStatus: 'assigned',
      destinationAddress: orderDoc.deliveryAddress || 'Delivery Address',
      customerName: orderDoc.customerName || '',
      customerPhone: orderDoc.customerPhone || '',
      estimatedArrival,
      deliveryNotes: riderData.deliveryNotes?.trim() || '',
      otp: deliveryOtp,
      assignedBy: staffUser?.name || staffUser?.email || staffUser?.id || 'Staff',
    };

    let savedDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        savedDoc = await DeliveryAssignment.findOneAndUpdate(
          { orderNumber: cleanOrderNumber },
          { $set: assignmentPayload },
          { new: true, upsert: true }
        ).lean();

        // Advance Order Status to ready_for_pickup or out_for_delivery
        await Order.findOneAndUpdate(
          { orderNumber: cleanOrderNumber },
          {
            $set: {
              orderStatus: 'ready_for_pickup',
              deliveryPersonnel: {
                name: assignmentPayload.riderName,
                phone: assignmentPayload.riderPhone,
                vehicleNumber: assignmentPayload.vehicleNumber,
              },
            },
          }
        );
      } catch (err: any) {
        console.warn(`[DeliveryService] Mongo assignment failed: ${err?.message}`);
      }
    }

    // In-memory fallback
    const idx = fallbackDeliveriesStore.findIndex((d) => d.orderNumber === cleanOrderNumber);
    if (idx !== -1) {
      fallbackDeliveriesStore[idx] = {
        ...fallbackDeliveriesStore[idx],
        ...assignmentPayload,
        updatedAt: new Date(),
      } as IDeliveryAssignment;
      if (!savedDoc) savedDoc = fallbackDeliveriesStore[idx];
    } else {
      const newItem = {
        id: 'del_' + Date.now(),
        ...assignmentPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fallbackDeliveriesStore.unshift(newItem as any);
      if (!savedDoc) savedDoc = newItem;
    }

    // Broadcast live WebSocket tracking update
    broadcast(`room:order:${cleanOrderNumber}`, 'delivery:assigned', savedDoc);
    broadcast('room:admin:chat', 'delivery:assigned', savedDoc);

    return savedDoc;
  },

  /**
   * Update live delivery tracking status and coordinates
   */
  async updateTrackingStatus(
    orderNumber: string,
    status: DeliveryTrackingStatus,
    location?: { lat: number; lng: number },
    notes?: string
  ): Promise<any> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required');
    }

    const validStatuses: DeliveryTrackingStatus[] = [
      'unassigned',
      'assigned',
      'picked_up',
      'on_the_way',
      'delivered',
      'failed',
      'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid tracking status. Allowed: ${validStatuses.join(', ')}`);
    }

    const updateFields: any = { trackingStatus: status };
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      updateFields.currentLocation = {
        lat: location.lat,
        lng: location.lng,
        updatedAt: new Date(),
      };
    }
    if (notes) {
      updateFields.deliveryNotes = notes;
    }

    if (status === 'delivered') {
      updateFields.deliveredAt = new Date();
    }

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        updatedDoc = await DeliveryAssignment.findOneAndUpdate(
          { orderNumber: cleanOrderNumber },
          { $set: updateFields },
          { new: true }
        ).lean();

        // Synchronize Order status
        if (status === 'on_the_way') {
          await Order.findOneAndUpdate(
            { orderNumber: cleanOrderNumber },
            { $set: { orderStatus: 'out_for_delivery' } }
          );
        } else if (status === 'delivered') {
          await Order.findOneAndUpdate(
            { orderNumber: cleanOrderNumber },
            { $set: { orderStatus: 'completed' } }
          );
        }
      } catch (err: any) {
        console.warn(`[DeliveryService] Mongo status update failed: ${err?.message}`);
      }
    }

    // In-memory fallback
    const idx = fallbackDeliveriesStore.findIndex((d) => d.orderNumber === cleanOrderNumber);
    if (idx !== -1) {
      fallbackDeliveriesStore[idx] = {
        ...fallbackDeliveriesStore[idx],
        ...updateFields,
        updatedAt: new Date(),
      };
      if (!updatedDoc) updatedDoc = fallbackDeliveriesStore[idx];
    }

    if (!updatedDoc) {
      throw new NotFoundError(`Delivery assignment for Order #${cleanOrderNumber} not found`);
    }

    // Broadcast live WebSocket event
    broadcast(`room:order:${cleanOrderNumber}`, 'delivery:status', updatedDoc);
    broadcast('room:admin:chat', 'delivery:status', updatedDoc);

    return updatedDoc;
  },

  /**
   * Complete delivery via Customer Delivery OTP verification
   */
  async verifyDeliveryOtp(orderNumber: string, otp: string): Promise<any> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    const cleanOtp = String(otp || '').trim();

    if (!cleanOrderNumber) throw new BadRequestError('Order number is required');
    if (!cleanOtp) throw new BadRequestError('Delivery OTP is required');

    const deliveryDoc = await this.getDeliveryByOrder(cleanOrderNumber);
    if (!deliveryDoc) {
      throw new NotFoundError(`Delivery record for Order #${cleanOrderNumber} not found`);
    }

    if (deliveryDoc.otp && deliveryDoc.otp !== cleanOtp) {
      throw new BadRequestError('Invalid Delivery OTP. Please verify with customer.');
    }

    return this.updateTrackingStatus(cleanOrderNumber, 'delivered');
  },

  /**
   * Get delivery tracking info for a specific order
   */
  async getDeliveryByOrder(orderNumber: string): Promise<any> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required');
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const item = await DeliveryAssignment.findOne({ orderNumber: cleanOrderNumber }).lean();
        if (item) return item;
      } catch (err: any) {
        console.warn(`[DeliveryService] Mongo findOne error: ${err?.message}`);
      }
    }

    const memoryItem = fallbackDeliveriesStore.find((d) => d.orderNumber === cleanOrderNumber);
    if (!memoryItem) {
      // Fallback check order exists and return synthesized tracking info
      const state = db.getState();
      const order = state.orders.find((o) => o.orderNumber === cleanOrderNumber);
      if (order && order.fulfillmentType === 'delivery') {
        return {
          orderNumber: cleanOrderNumber,
          trackingStatus:
            order.orderStatus === 'completed'
              ? 'delivered'
              : order.orderStatus === 'out_for_delivery'
              ? 'on_the_way'
              : 'assigned',
          destinationAddress: order.deliveryAddress,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
        };
      }
      throw new NotFoundError(`Delivery tracking for Order #${cleanOrderNumber} not found`);
    }

    return memoryItem;
  },

  /**
   * Retrieve all deliveries with status filtering & pagination (Staff / Dispatcher)
   */
  async getAllDeliveries(query: any = {}): Promise<{
    deliveries: any[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
    countsByStatus: Record<string, number>;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (query.status) filter.trackingStatus = query.status;
        if (query.riderPhone) filter.riderPhone = query.riderPhone;

        const [deliveries, total, assignedCount, pickedUpCount, onTheWayCount, deliveredCount] =
          await Promise.all([
            DeliveryAssignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            DeliveryAssignment.countDocuments(filter),
            DeliveryAssignment.countDocuments({ trackingStatus: 'assigned' }),
            DeliveryAssignment.countDocuments({ trackingStatus: 'picked_up' }),
            DeliveryAssignment.countDocuments({ trackingStatus: 'on_the_way' }),
            DeliveryAssignment.countDocuments({ trackingStatus: 'delivered' }),
          ]);

        return {
          deliveries,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
          countsByStatus: {
            total,
            assigned: assignedCount,
            picked_up: pickedUpCount,
            on_the_way: onTheWayCount,
            delivered: deliveredCount,
          },
        };
      } catch (err: any) {
        console.warn(`[DeliveryService] Mongo getAll error: ${err?.message}`);
      }
    }

    // In-memory fallback
    let items = [...fallbackDeliveriesStore];
    if (query.status) items = items.filter((d) => d.trackingStatus === query.status);
    const total = items.length;

    return {
      deliveries: items.slice(skip, skip + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      countsByStatus: {
        total: fallbackDeliveriesStore.length,
        assigned: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'assigned').length,
        picked_up: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'picked_up').length,
        on_the_way: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'on_the_way').length,
        delivered: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'delivered').length,
      },
    };
  },

  /**
   * Get operational dispatch metrics for delivery monitor
   */
  async getDeliveryStats(): Promise<{
    activeDeliveries: number;
    onTheWay: number;
    deliveredToday: number;
    averageDeliveryMinutes: number;
  }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (mongoose.connection.readyState === 1) {
      try {
        const [active, onWay, deliveredToday] = await Promise.all([
          DeliveryAssignment.countDocuments({
            trackingStatus: { $in: ['assigned', 'picked_up', 'on_the_way'] },
          }),
          DeliveryAssignment.countDocuments({ trackingStatus: 'on_the_way' }),
          DeliveryAssignment.countDocuments({
            trackingStatus: 'delivered',
            deliveredAt: { $gte: startOfToday },
          }),
        ]);

        return {
          activeDeliveries: active,
          onTheWay: onWay,
          deliveredToday,
          averageDeliveryMinutes: 34,
        };
      } catch (err: any) {
        console.warn(`[DeliveryService] Mongo stats error: ${err?.message}`);
      }
    }

    return {
      activeDeliveries: fallbackDeliveriesStore.filter((d) =>
        ['assigned', 'picked_up', 'on_the_way'].includes(d.trackingStatus)
      ).length,
      onTheWay: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'on_the_way').length,
      deliveredToday: fallbackDeliveriesStore.filter((d) => d.trackingStatus === 'delivered').length,
      averageDeliveryMinutes: 35,
    };
  },

  /**
   * Retrieve active delivery zones
   */
  async getDeliveryZones(): Promise<IDeliveryZone[]> {
    return deliveryZones;
  },

  /**
   * Update delivery zones configuration
   */
  async updateDeliveryZones(zones: IDeliveryZone[]): Promise<IDeliveryZone[]> {
    if (!Array.isArray(zones)) {
      throw new BadRequestError('Delivery zones must be an array');
    }
    deliveryZones = zones;
    return deliveryZones;
  },

  /**
   * Module health status
   */
  async getStatus() {
    return {
      module: 'delivery',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      zonesCount: deliveryZones.length,
      timestamp: new Date().toISOString(),
    };
  },
};

export default deliveryService;
