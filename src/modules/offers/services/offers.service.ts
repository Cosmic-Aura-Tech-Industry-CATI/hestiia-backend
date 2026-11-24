import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Offer } from '../models/offer.model.js';
import { OfferRedemption } from '../models/offerRedemption.model.js';
import {
  IOffer,
  ICreateOfferDTO,
  IUpdateOfferDTO,
  IOfferQuery,
  IOfferSummary,
  IOfferAnalytics,
} from '../interfaces/offer.interface.js';
import {
  validateObjectId,
  validateOfferTitle,
  validateOfferDescription,
  validateDiscountConfig,
  validateMinOrderValue,
  validateOfferDates,
  validatePlacements,
  validateDisplayPriority,
} from '../validators/offer.validator.js';
import { discountCalculationService } from './discountCalculation.service.js';

export const offersService = {
  /**
   * Service 1: Create a new offer (Admin)
   */
  async createOffer(data: ICreateOfferDTO, actor = 'admin'): Promise<IOffer> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('Request body must be a valid JSON object.', 400);
    }

    // Check for unexpected fields
    const allowedKeys = new Set([
      'title',
      'description',
      'discountType',
      'discountValue',
      'minOrderValue',
      'maxDiscount',
      'startDate',
      'endDate',
      'placements',
      'bannerImage',
      'termsAndConditions',
      'displayPriority',
      'isActive',
    ]);
    for (const key of Object.keys(data)) {
      if (!allowedKeys.has(key)) {
        throw new AppError(`Unexpected field "${key}" provided.`, 400);
      }
    }

    // Validations
    const title = validateOfferTitle(data.title);
    const description = validateOfferDescription(data.description);
    const { discountType, discountValue, maxDiscount } = validateDiscountConfig(
      data.discountType,
      data.discountValue,
      data.maxDiscount
    );
    const minOrderValue = validateMinOrderValue(data.minOrderValue);
    const { startDate, endDate } = validateOfferDates(data.startDate, data.endDate);
    const placements = validatePlacements(data.placements);
    const displayPriority = validateDisplayPriority(data.displayPriority);
    const bannerImage = typeof data.bannerImage === 'string' ? data.bannerImage.trim() : '';
    const termsAndConditions = Array.isArray(data.termsAndConditions)
      ? data.termsAndConditions.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;

    const newId = new mongoose.Types.ObjectId().toHexString();
    const now = new Date();

    const offerRecord: IOffer = {
      _id: newId,
      id: newId,
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      placements,
      bannerImage,
      termsAndConditions,
      displayPriority,
      isActive,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Save in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Offer.create({
          _id: new mongoose.Types.ObjectId(newId),
          title: offerRecord.title,
          description: offerRecord.description,
          discountType: offerRecord.discountType,
          discountValue: offerRecord.discountValue,
          minOrderValue: offerRecord.minOrderValue,
          maxDiscount: offerRecord.maxDiscount,
          startDate,
          endDate,
          placements: offerRecord.placements,
          bannerImage: offerRecord.bannerImage,
          termsAndConditions: offerRecord.termsAndConditions,
          displayPriority: offerRecord.displayPriority,
          isActive: offerRecord.isActive,
          isArchived: false,
        });
        offerRecord._id = doc._id.toString();
        offerRecord.createdAt = doc.createdAt;
        offerRecord.updatedAt = doc.updatedAt;
      } catch (err: any) {
        console.warn('[OffersService] MongoDB create failed, falling back to local store:', err?.message);
      }
    }

    // Save in local resilient store
    db.updateState((s: any) => {
      if (!s.offers) s.offers = [];
      s.offers.unshift({ ...offerRecord });
    });

    db.logAudit('OFFER_CREATED', actor, `Created offer "${title}" (${offerRecord._id}) with ${discountType} discount of ${discountValue}`);
    return offerRecord;
  },

  /**
   * Service 2: Get all offers for Admin Dashboard with pagination, filtering & sorting
   */
  async getAllAdminOffers(query: IOfferQuery = {}): Promise<{ offers: any[]; total: number; page: number; limit: number; totalPages: number }> {
    let page = 1;
    if (query.page !== undefined && query.page !== '') {
      page = parseInt(String(query.page), 10);
      if (isNaN(page) || page < 1) {
        throw new AppError('Page must be a positive integer >= 1.', 400);
      }
    }

    let limit = 10;
    if (query.limit !== undefined && query.limit !== '') {
      limit = parseInt(String(query.limit), 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new AppError('Limit must be an integer between 1 and 100.', 400);
      }
    }

    const search = query.search ? String(query.search).trim() : '';
    const status = query.status ? String(query.status).trim().toLowerCase() : 'all';
    const validStatuses = new Set(['active', 'inactive', 'expired', 'upcoming', 'archived', 'all']);
    if (!validStatuses.has(status)) {
      throw new AppError(`Invalid status filter "${query.status}". Allowed: active, inactive, expired, upcoming, archived, all.`, 400);
    }

    if (query.discountType && query.discountType !== 'fixed' && query.discountType !== 'percentage') {
      throw new AppError(`Invalid discountType filter "${query.discountType}". Allowed: fixed, percentage.`, 400);
    }

    if (query.placement && query.placement !== 'home' && query.placement !== 'menu') {
      throw new AppError(`Invalid placement filter "${query.placement}". Allowed: home, menu.`, 400);
    }

    const sortBy = query.sortBy || 'createdAt';
    const allowedSort = new Set(['createdAt', 'endDate', 'displayPriority', 'discountValue']);
    if (!allowedSort.has(sortBy)) {
      throw new AppError(`Invalid sortBy field "${query.sortBy}". Allowed: createdAt, endDate, displayPriority, discountValue.`, 400);
    }

    const order = query.order === 'asc' ? 'asc' : 'desc';

    // Retrieve from store/db
    const state = db.getState() as any;
    let allOffers: IOffer[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await Offer.find({}).sort({ [sortBy]: order === 'asc' ? 1 : -1 }).lean();
        allOffers = docs.map((d: any) => ({
          _id: d._id.toString(),
          title: d.title,
          description: d.description,
          discountType: d.discountType,
          discountValue: d.discountValue,
          minOrderValue: d.minOrderValue,
          maxDiscount: d.maxDiscount,
          startDate: d.startDate,
          endDate: d.endDate,
          placements: d.placements,
          bannerImage: d.bannerImage,
          termsAndConditions: d.termsAndConditions,
          displayPriority: d.displayPriority,
          isActive: d.isActive,
          isArchived: d.isArchived,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
      } catch {
        allOffers = (state.offers || []).map((o: any) => ({ ...o, _id: String(o._id || o.id) }));
      }
    } else {
      allOffers = (state.offers || []).map((o: any) => ({ ...o, _id: String(o._id || o.id) }));
    }

    const now = Date.now();

    // Filter by search
    if (search) {
      const term = search.toLowerCase();
      allOffers = allOffers.filter((o) => o.title.toLowerCase().includes(term) || o.description.toLowerCase().includes(term));
    }

    // Filter by discountType
    if (query.discountType) {
      allOffers = allOffers.filter((o) => o.discountType === query.discountType);
    }

    // Filter by placement
    if (query.placement) {
      allOffers = allOffers.filter((o) => o.placements.includes(query.placement as any));
    }

    // Filter by status
    if (status === 'archived') {
      allOffers = allOffers.filter((o) => o.isArchived === true);
    } else {
      if (status !== 'all') {
        allOffers = allOffers.filter((o) => !o.isArchived);
        if (status === 'active') {
          allOffers = allOffers.filter((o) => o.isActive && new Date(o.startDate).getTime() <= now && new Date(o.endDate).getTime() >= now);
        } else if (status === 'inactive') {
          allOffers = allOffers.filter((o) => !o.isActive);
        } else if (status === 'expired') {
          allOffers = allOffers.filter((o) => new Date(o.endDate).getTime() < now);
        } else if (status === 'upcoming') {
          allOffers = allOffers.filter((o) => new Date(o.startDate).getTime() > now);
        }
      }
    }

    // Sort
    allOffers.sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      let cmp = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        cmp = valA.localeCompare(valB);
      } else {
        cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      }
      return order === 'asc' ? cmp : -cmp;
    });

    const total = allOffers.length;
    const paginated = allOffers.slice((page - 1) * limit, page * limit);

    // Enriched with redemption counts
    const redemptions = state.offerRedemptions || [];
    const enriched = paginated.map((off) => {
      const relRedemptions = redemptions.filter((r: any) => String(r.offerId) === off._id);
      const totalRedemptions = relRedemptions.length;
      const totalDiscountGiven = relRedemptions.reduce((acc: number, cur: any) => acc + (cur.discountAmount || 0), 0);
      return {
        ...off,
        totalRedemptions,
        totalDiscountGiven,
      };
    });

    return {
      offers: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Service 3: Get offer by ID (Admin)
   */
  async getOfferById(id: string): Promise<IOffer & { totalRedemptions: number; totalDiscountGiven: number }> {
    const cleanId = validateObjectId(id, 'offer ID');
    let offer: IOffer | null = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Offer.findById(cleanId).lean();
        if (doc) {
          offer = {
            _id: doc._id.toString(),
            title: doc.title,
            description: doc.description,
            discountType: doc.discountType,
            discountValue: doc.discountValue,
            minOrderValue: doc.minOrderValue,
            maxDiscount: doc.maxDiscount,
            startDate: doc.startDate,
            endDate: doc.endDate,
            placements: doc.placements,
            bannerImage: doc.bannerImage,
            termsAndConditions: doc.termsAndConditions,
            displayPriority: doc.displayPriority,
            isActive: doc.isActive,
            isArchived: doc.isArchived,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback to store
      }
    }

    if (!offer) {
      const state = db.getState() as any;
      const found = (state.offers || []).find((o: any) => String(o._id || o.id) === cleanId);
      if (found) {
        offer = { ...found, _id: String(found._id || found.id) };
      }
    }

    if (!offer) {
      throw new AppError('Offer not found.', 404);
    }

    const state = db.getState() as any;
    const relRedemptions = (state.offerRedemptions || []).filter((r: any) => String(r.offerId) === offer!._id);
    const totalRedemptions = relRedemptions.length;
    const totalDiscountGiven = relRedemptions.reduce((acc: number, cur: any) => acc + (cur.discountAmount || 0), 0);

    return {
      ...offer,
      totalRedemptions,
      totalDiscountGiven,
    };
  },

  /**
   * Service 4: Update offer (Admin)
   */
  async updateOffer(id: string, data: IUpdateOfferDTO, actor = 'admin'): Promise<IOffer> {
    const cleanId = validateObjectId(id, 'offer ID');
    const existing = await this.getOfferById(cleanId);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('Request body must be a valid JSON object.', 400);
    }
    if (Object.keys(data).length === 0) {
      throw new AppError('Request body cannot be empty.', 400);
    }

    // Protected field checks
    if ((data as any)._id !== undefined || (data as any).id !== undefined) {
      throw new AppError('Modifying offer ID is not permitted.', 400);
    }
    if ((data as any).createdAt !== undefined) {
      throw new AppError('Modifying creation timestamp is not permitted.', 400);
    }
    if ((data as any).redemptionHistory !== undefined || (data as any).usageCount !== undefined) {
      throw new AppError('Modifying redemption history or counters is not permitted.', 400);
    }

    // Check unexpected fields
    const allowedKeys = new Set([
      'title',
      'description',
      'discountType',
      'discountValue',
      'minOrderValue',
      'maxDiscount',
      'startDate',
      'endDate',
      'placements',
      'bannerImage',
      'termsAndConditions',
      'displayPriority',
      'isActive',
    ]);
    for (const key of Object.keys(data)) {
      if (!allowedKeys.has(key)) {
        throw new AppError(`Unexpected field "${key}" provided.`, 400);
      }
    }

    const updates: Partial<IOffer> = {};

    if (data.title !== undefined) updates.title = validateOfferTitle(data.title);
    if (data.description !== undefined) updates.description = validateOfferDescription(data.description);

    const targetType = data.discountType || existing.discountType;
    const targetValue = data.discountValue !== undefined ? data.discountValue : existing.discountValue;
    const targetMax = data.maxDiscount !== undefined ? data.maxDiscount : existing.maxDiscount;

    if (data.discountType !== undefined || data.discountValue !== undefined || data.maxDiscount !== undefined) {
      const cfg = validateDiscountConfig(targetType, targetValue, targetMax);
      updates.discountType = cfg.discountType;
      updates.discountValue = cfg.discountValue;
      updates.maxDiscount = cfg.maxDiscount;
    }

    if (data.minOrderValue !== undefined) {
      updates.minOrderValue = validateMinOrderValue(data.minOrderValue);
    }

    const targetStart = data.startDate || existing.startDate;
    const targetEnd = data.endDate || existing.endDate;
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const dates = validateOfferDates(targetStart, targetEnd);
      updates.startDate = dates.startDate.toISOString();
      updates.endDate = dates.endDate.toISOString();
    }

    if (data.placements !== undefined) updates.placements = validatePlacements(data.placements);
    if (data.bannerImage !== undefined) updates.bannerImage = String(data.bannerImage).trim();
    if (data.termsAndConditions !== undefined) {
      updates.termsAndConditions = Array.isArray(data.termsAndConditions)
        ? data.termsAndConditions.map((t) => String(t).trim()).filter(Boolean)
        : [];
    }
    if (data.displayPriority !== undefined) updates.displayPriority = validateDisplayPriority(data.displayPriority);
    if (data.isActive !== undefined) updates.isActive = Boolean(data.isActive);

    const now = new Date();
    updates.updatedAt = now.toISOString();

    // Persist in MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await Offer.findByIdAndUpdate(cleanId, { $set: updates }, { new: true, runValidators: true });
      } catch (err: any) {
        console.warn('[OffersService] MongoDB update failed:', err?.message);
      }
    }

    // Persist in local store
    db.updateState((s: any) => {
      if (!s.offers) s.offers = [];
      const idx = s.offers.findIndex((o: any) => String(o._id || o.id) === cleanId);
      if (idx !== -1) {
        s.offers[idx] = { ...s.offers[idx], ...updates };
      }
    });

    const updated = {
      ...existing,
      ...updates,
    };

    db.logAudit('OFFER_UPDATED', actor, `Updated offer "${updated.title}" (${cleanId})`);
    return updated;
  },

  /**
   * Service 5: Activate / Deactivate offer (Admin)
   */
  async updateOfferStatus(id: string, isActive: any, actor = 'admin'): Promise<IOffer> {
    const cleanId = validateObjectId(id, 'offer ID');
    if (isActive === undefined || typeof isActive !== 'boolean') {
      throw new AppError('Status parameter "isActive" is required and must be a boolean.', 400);
    }

    const existing = await this.getOfferById(cleanId);
    const now = new Date();

    if (mongoose.connection.readyState === 1) {
      try {
        await Offer.findByIdAndUpdate(cleanId, { $set: { isActive, updatedAt: now } });
      } catch (err: any) {
        console.warn('[OffersService] MongoDB status update failed:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.offers) s.offers = [];
      const idx = s.offers.findIndex((o: any) => String(o._id || o.id) === cleanId);
      if (idx !== -1) {
        s.offers[idx].isActive = isActive;
        s.offers[idx].updatedAt = now.toISOString();
      }
    });

    const updated = {
      ...existing,
      isActive,
      updatedAt: now.toISOString(),
    };

    db.logAudit('OFFER_STATUS_CHANGED', actor, `${isActive ? 'Activated' : 'Deactivated'} offer "${existing.title}" (${cleanId})`);
    return updated;
  },

  /**
   * Service 6: Archive offer (Admin soft delete)
   */
  async archiveOffer(id: string, actor = 'admin'): Promise<{ success: boolean; message: string }> {
    const cleanId = validateObjectId(id, 'offer ID');
    const existing = await this.getOfferById(cleanId);

    if (existing.isArchived) {
      throw new AppError('Offer is already archived.', 400);
    }

    const now = new Date();

    if (mongoose.connection.readyState === 1) {
      try {
        await Offer.findByIdAndUpdate(cleanId, { $set: { isArchived: true, isActive: false, updatedAt: now } });
      } catch (err: any) {
        console.warn('[OffersService] MongoDB archive failed:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.offers) s.offers = [];
      const idx = s.offers.findIndex((o: any) => String(o._id || o.id) === cleanId);
      if (idx !== -1) {
        s.offers[idx].isArchived = true;
        s.offers[idx].isActive = false;
        s.offers[idx].updatedAt = now.toISOString();
      }
    });

    db.logAudit('OFFER_ARCHIVED', actor, `Archived offer "${existing.title}" (${cleanId})`);
    return {
      success: true,
      message: 'Offer archived successfully',
    };
  },

  /**
   * Service 7: Get individual offer analytics (Admin)
   */
  async getOfferAnalytics(id: string): Promise<IOfferAnalytics> {
    const cleanId = validateObjectId(id, 'offer ID');
    const offer = await this.getOfferById(cleanId);

    const state = db.getState() as any;
    let redemptions: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        redemptions = await OfferRedemption.find({ offerId: cleanId }).lean();
      } catch {
        redemptions = (state.offerRedemptions || []).filter((r: any) => String(r.offerId) === cleanId);
      }
    } else {
      redemptions = (state.offerRedemptions || []).filter((r: any) => String(r.offerId) === cleanId);
    }

    const totalRedemptions = redemptions.length;
    const totalDiscountProvided = redemptions.reduce((acc, r) => acc + (r.discountAmount || 0), 0);
    const uniqueOrders = new Set(redemptions.map((r) => r.orderId)).size;

    const now = Date.now();
    let currentStatus = 'active';
    if (offer.isArchived) currentStatus = 'archived';
    else if (!offer.isActive) currentStatus = 'inactive';
    else if (new Date(offer.endDate).getTime() < now) currentStatus = 'expired';
    else if (new Date(offer.startDate).getTime() > now) currentStatus = 'upcoming';

    return {
      offerId: offer._id,
      title: offer.title,
      totalRedemptions,
      totalDiscountProvided: Math.round(totalDiscountProvided * 100) / 100,
      totalOrders: uniqueOrders,
      createdAt: offer.createdAt,
      endDate: offer.endDate,
      status: currentStatus,
    };
  },

  /**
   * Service 8: Get overall Offer Dashboard summary (Admin)
   */
  async getOffersSummary(): Promise<IOfferSummary> {
    const state = db.getState() as any;
    let offers: any[] = [];
    let redemptions: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        offers = await Offer.find({}).lean();
        redemptions = await OfferRedemption.find({}).lean();
      } catch {
        offers = state.offers || [];
        redemptions = state.offerRedemptions || [];
      }
    } else {
      offers = state.offers || [];
      redemptions = state.offerRedemptions || [];
    }

    const now = Date.now();
    let activeOffers = 0;
    let inactiveOffers = 0;
    let upcomingOffers = 0;
    let expiredOffers = 0;
    let archivedOffers = 0;

    for (const o of offers) {
      if (o.isArchived) {
        archivedOffers++;
      } else if (!o.isActive) {
        inactiveOffers++;
      } else {
        const start = new Date(o.startDate).getTime();
        const end = new Date(o.endDate).getTime();
        if (now < start) {
          upcomingOffers++;
        } else if (now > end) {
          expiredOffers++;
        } else {
          activeOffers++;
        }
      }
    }

    const totalRedemptions = redemptions.length;
    const totalDiscountProvided = redemptions.reduce((acc: number, cur: any) => acc + (cur.discountAmount || 0), 0);

    return {
      totalOffers: offers.length,
      activeOffers,
      inactiveOffers,
      upcomingOffers,
      expiredOffers,
      archivedOffers,
      totalRedemptions,
      totalDiscountProvided: Math.round(totalDiscountProvided * 100) / 100,
    };
  },

  /**
   * Customer Service 1: Get current valid offers
   */
  async getCurrentOffers(): Promise<IOffer[]> {
    const state = db.getState() as any;
    let offers: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const now = new Date();
        const docs = await Offer.find({
          isActive: true,
          isArchived: false,
          startDate: { $lte: now },
          endDate: { $gte: now },
        })
          .sort({ displayPriority: 1, createdAt: -1 })
          .lean();
        offers = docs.map((d: any) => ({ ...d, _id: d._id.toString() }));
      } catch {
        offers = state.offers || [];
      }
    } else {
      offers = state.offers || [];
    }

    const now = Date.now();
    return offers
      .filter((o) => {
        if (!o.isActive || o.isArchived) return false;
        const start = new Date(o.startDate).getTime();
        const end = new Date(o.endDate).getTime();
        return now >= start && now <= end;
      })
      .sort((a, b) => (a.displayPriority || 1) - (b.displayPriority || 1));
  },

  /**
   * Customer Service 2: Get Home Page offers
   */
  async getHomeOffers(): Promise<any[]> {
    const activeOffers = await this.getCurrentOffers();
    return activeOffers
      .filter((o) => o.placements && o.placements.includes('home'))
      .map((o) => ({
        _id: o._id,
        id: o._id,
        title: o.title,
        description: o.description,
        discountType: o.discountType,
        discountValue: o.discountValue,
        minOrderValue: o.minOrderValue,
        maxDiscount: o.maxDiscount,
        placements: o.placements,
        bannerImage: o.bannerImage,
        termsAndConditions: o.termsAndConditions,
        displayPriority: o.displayPriority,
      }));
  },

  /**
   * Customer Service 3: Get Menu Page offers
   */
  async getMenuOffers(): Promise<any[]> {
    const activeOffers = await this.getCurrentOffers();
    return activeOffers
      .filter((o) => o.placements && o.placements.includes('menu'))
      .map((o) => ({
        _id: o._id,
        id: o._id,
        title: o.title,
        description: o.description,
        discountType: o.discountType,
        discountValue: o.discountValue,
        minOrderValue: o.minOrderValue,
        maxDiscount: o.maxDiscount,
        placements: o.placements,
        bannerImage: o.bannerImage,
        termsAndConditions: o.termsAndConditions,
        displayPriority: o.displayPriority,
      }));
  },

  /**
   * Customer Service 4: Get single offer details
   */
  async getCustomerOfferById(id: string): Promise<any> {
    const cleanId = validateObjectId(id, 'offer ID');
    const offer = await this.getOfferById(cleanId);

    const check = discountCalculationService.isOfferAvailable(offer);
    if (!check.available) {
      throw new AppError(`Offer is not currently available: ${check.reason}`, 404);
    }

    return {
      _id: offer._id,
      id: offer._id,
      title: offer.title,
      description: offer.description,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      minOrderValue: offer.minOrderValue,
      maxDiscount: offer.maxDiscount,
      startDate: offer.startDate,
      endDate: offer.endDate,
      placements: offer.placements,
      bannerImage: offer.bannerImage,
      termsAndConditions: offer.termsAndConditions,
      displayPriority: offer.displayPriority,
    };
  },

  /**
   * Helper: Idempotent Redemption Recording on Payment/Order Completion
   */
  async recordRedemption(params: {
    offerId: string;
    orderId: string;
    discountAmount: number;
    orderSubtotal: number;
  }): Promise<void> {
    const { offerId, orderId, discountAmount, orderSubtotal } = params;
    if (!offerId || !orderId || discountAmount <= 0) return;

    // Idempotency check: Ensure not already redeemed for this order
    const state = db.getState() as any;
    const existing = (state.offerRedemptions || []).find((r: any) => r.orderId === orderId);
    if (existing) {
      return; // Already recorded idempotently
    }

    const redemptionDoc = {
      _id: new mongoose.Types.ObjectId().toHexString(),
      offerId,
      orderId,
      discountAmount,
      orderSubtotal,
      redeemedAt: new Date().toISOString(),
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await OfferRedemption.create({
          offerId,
          orderId,
          discountAmount,
          orderSubtotal,
        });
      } catch (err: any) {
        if (err.code === 11000) return; // Duplicate index handled
        console.warn('[OffersService] MongoDB redemption record failed:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.offerRedemptions) s.offerRedemptions = [];
      s.offerRedemptions.push(redemptionDoc);
    });

    db.logAudit('OFFER_REDEEMED', 'System', `Redeemed offer ${offerId} on order ${orderId} for ₹${discountAmount}`);
  },
};

export default offersService;
