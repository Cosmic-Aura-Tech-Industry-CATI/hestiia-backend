import mongoose from 'mongoose';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  type ILoyaltyAccountDocument,
  type ILoyaltyTransactionDocument,
} from './loyalty.model.js';
import { Customer } from '../customers/customer.model.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.js';
import type {
  LoyaltyTier,
  ILoyaltyTierBenefit,
  IRewardVoucher,
} from './loyalty.interface.js';

export const LOYALTY_TIER_RULES: Record<LoyaltyTier, ILoyaltyTierBenefit> = {
  bronze: {
    tier: 'bronze',
    minPoints: 0,
    multiplier: 1.0,
    discountPercent: 0,
    perks: ['Standard Point Accumulation (1 pt / ₹100)', 'Exclusive Seasonal Tasting Invites'],
  },
  silver: {
    tier: 'silver',
    minPoints: 1000,
    multiplier: 1.25,
    discountPercent: 5,
    perks: ['25% Bonus Points Earning', '5% Direct Dining Discount', 'Priority Table Booking'],
  },
  gold: {
    tier: 'gold',
    minPoints: 5000,
    multiplier: 1.5,
    discountPercent: 10,
    perks: [
      '50% Bonus Points Earning',
      '10% Direct Dining Discount',
      'Complimentary Chef Dessert on Dine-In',
      'Priority Express Delivery',
    ],
  },
  platinum: {
    tier: 'platinum',
    minPoints: 10000,
    multiplier: 2.0,
    discountPercent: 15,
    perks: [
      'Double Points on All Dining & Delivery',
      '15% VIP Direct Dining Discount',
      'Dedicated Banquet Concierge',
      'Private Chef Table Access',
    ],
  },
};

export const REWARD_VOUCHERS: IRewardVoucher[] = [
  {
    id: 'reward_50',
    title: '₹50 Dining Voucher',
    description: 'Instant ₹50 discount on your order',
    pointsCost: 100,
    rewardType: 'discount_fixed',
    discountValue: 50,
    minOrderValue: 299,
    codePrefix: 'HEST50',
    isActive: true,
  },
  {
    id: 'reward_100',
    title: '₹100 Dining Voucher',
    description: 'Instant ₹100 discount on your order',
    pointsCost: 200,
    rewardType: 'discount_fixed',
    discountValue: 100,
    minOrderValue: 499,
    codePrefix: 'HEST100',
    isActive: true,
  },
  {
    id: 'reward_250',
    title: '₹250 Gourmet Dining Voucher',
    description: 'Instant ₹250 discount on dining orders',
    pointsCost: 500,
    rewardType: 'discount_fixed',
    discountValue: 250,
    minOrderValue: 999,
    codePrefix: 'HEST250',
    isActive: true,
  },
  {
    id: 'reward_dessert',
    title: 'Complimentary Handcrafted Dessert',
    description: 'Free chef special dessert with your meal',
    pointsCost: 400,
    rewardType: 'free_item',
    discountValue: 220,
    minOrderValue: 399,
    codePrefix: 'SWEET',
    isActive: true,
  },
];

// In-memory fallback stores
const fallbackAccounts: any[] = [];
const fallbackTransactions: any[] = [];

export const loyaltyService = {
  /**
   * Helper: Calculate tier according to lifetime earned points
   */
  calculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= 10000) return 'platinum';
    if (lifetimePoints >= 5000) return 'gold';
    if (lifetimePoints >= 1000) return 'silver';
    return 'bronze';
  },

  /**
   * Retrieve or auto-provision loyalty profile for customer by phone number
   */
  async getOrCreateAccount(
    phone: string,
    customerName?: string,
    email?: string
  ): Promise<any> {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) {
      throw new BadRequestError('Customer phone number is required');
    }

    if (mongoose.connection.readyState === 1) {
      try {
        let account = await LoyaltyAccount.findOne({ phone: cleanPhone });
        if (!account) {
          // Attempt customer lookup to link
          const customer = await Customer.findOne({ phone: cleanPhone }).lean();
          const name = customerName || customer?.name || 'Valued Guest';
          const custEmail = email || customer?.email || '';
          const refCode = `HEST-${cleanPhone.slice(-4)}-${Math.floor(10 + Math.random() * 90)}`;

          account = await LoyaltyAccount.create({
            customerId: customer?._id,
            phone: cleanPhone,
            customerName: name,
            email: custEmail,
            tier: 'bronze',
            currentPoints: 100, // 100 Welcome Points
            lifetimePointsEarned: 100,
            lifetimePointsRedeemed: 0,
            referralCode: refCode,
            isActive: true,
          });

          // Record welcome bonus transaction
          await LoyaltyTransaction.create({
            loyaltyAccountId: account._id,
            phone: cleanPhone,
            type: 'bonus',
            points: 100,
            balanceAfter: 100,
            description: 'Welcome to Hestiia Dining Club! 100 Bonus Points credited.',
            performedBy: 'system',
          });
        }
        return account.toJSON ? account.toJSON() : account;
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo find/create error: ${err?.message}`);
      }
    }

    // Fallback store
    let memAcc = fallbackAccounts.find((a) => a.phone === cleanPhone);
    if (!memAcc) {
      memAcc = {
        id: 'loy_' + Date.now(),
        phone: cleanPhone,
        customerName: customerName || 'Valued Guest',
        email: email || '',
        tier: 'bronze',
        currentPoints: 100,
        lifetimePointsEarned: 100,
        lifetimePointsRedeemed: 0,
        referralCode: `HEST-${cleanPhone.slice(-4)}-77`,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      fallbackAccounts.push(memAcc);
      fallbackTransactions.push({
        id: 'tx_' + Date.now(),
        phone: cleanPhone,
        type: 'bonus',
        points: 100,
        balanceAfter: 100,
        description: 'Welcome Bonus Points',
        createdAt: new Date().toISOString(),
      });
    }
    return memAcc;
  },

  /**
   * Get full profile, tier progress, and transaction history
   */
  async getProfile(phone: string): Promise<any> {
    const cleanPhone = String(phone || '').trim();
    const account = await this.getOrCreateAccount(cleanPhone);
    const tierRules = LOYALTY_TIER_RULES[account.tier as LoyaltyTier] || LOYALTY_TIER_RULES.bronze;

    // Next tier calculation
    let nextTier: LoyaltyTier | null = null;
    let pointsNeededForNextTier = 0;
    if (account.tier === 'bronze') {
      nextTier = 'silver';
      pointsNeededForNextTier = Math.max(0, 1000 - account.lifetimePointsEarned);
    } else if (account.tier === 'silver') {
      nextTier = 'gold';
      pointsNeededForNextTier = Math.max(0, 5000 - account.lifetimePointsEarned);
    } else if (account.tier === 'gold') {
      nextTier = 'platinum';
      pointsNeededForNextTier = Math.max(0, 10000 - account.lifetimePointsEarned);
    }

    // Fetch transactions
    let transactions: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        transactions = await LoyaltyTransaction.find({ phone: cleanPhone })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      } catch {}
    } else {
      transactions = fallbackTransactions
        .filter((t) => t.phone === cleanPhone)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);
    }

    return {
      account,
      tierInfo: {
        currentTier: account.tier,
        benefits: tierRules,
        nextTier,
        pointsNeededForNextTier,
        cashValueInRupees: Math.floor(account.currentPoints * 0.5), // 1 point = ₹0.50
      },
      transactions,
    };
  },

  /**
   * Award points when an order is paid
   */
  async awardPointsForOrder(
    orderNumber: string,
    phone: string,
    grandTotal: number
  ): Promise<any> {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return null;

    const account = await this.getOrCreateAccount(cleanPhone);
    const tierBenefit = LOYALTY_TIER_RULES[account.tier as LoyaltyTier] || LOYALTY_TIER_RULES.bronze;

    // 1 base point per ₹100 spent * tier multiplier
    const rawPoints = (Math.max(0, grandTotal) / 100) * tierBenefit.multiplier;
    const pointsToAward = Math.max(1, Math.round(rawPoints));

    const newCurrent = account.currentPoints + pointsToAward;
    const newLifetime = account.lifetimePointsEarned + pointsToAward;
    const updatedTier = this.calculateTier(newLifetime);

    if (mongoose.connection.readyState === 1) {
      try {
        await LoyaltyAccount.updateOne(
          { phone: cleanPhone },
          {
            $set: {
              currentPoints: newCurrent,
              lifetimePointsEarned: newLifetime,
              tier: updatedTier,
            },
          }
        );

        await LoyaltyTransaction.create({
          loyaltyAccountId: account.id || account._id,
          phone: cleanPhone,
          orderNumber,
          type: 'earn',
          points: pointsToAward,
          balanceAfter: newCurrent,
          description: `Earned ${pointsToAward} points on Order #${orderNumber} (${tierBenefit.multiplier}x ${account.tier} multiplier)`,
          performedBy: 'order-service',
        });
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo award failed: ${err?.message}`);
      }
    }

    // In-memory fallback
    account.currentPoints = newCurrent;
    account.lifetimePointsEarned = newLifetime;
    account.tier = updatedTier;
    fallbackTransactions.push({
      id: 'tx_' + Date.now(),
      phone: cleanPhone,
      orderNumber,
      type: 'earn',
      points: pointsToAward,
      balanceAfter: newCurrent,
      description: `Earned ${pointsToAward} points on Order #${orderNumber}`,
      createdAt: new Date().toISOString(),
    });

    return {
      pointsAwarded: pointsToAward,
      newBalance: newCurrent,
      tier: updatedTier,
    };
  },

  /**
   * Reverse points when an order is cancelled or refunded
   */
  async reversePointsForOrder(
    orderNumber: string,
    phone: string,
    grandTotal?: number
  ): Promise<any> {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone || !orderNumber) return null;

    let pointsToDeduct = 0;

    // Check if an earn transaction exists for this order in MongoDB Atlas or in-memory fallback
    if (mongoose.connection.readyState === 1) {
      try {
        const earnTx = await LoyaltyTransaction.findOne({
          orderNumber,
          phone: cleanPhone,
          type: 'earn',
        }).lean();

        if (earnTx) {
          pointsToDeduct = Math.abs(earnTx.points);
        }
      } catch {}
    }

    if (!pointsToDeduct) {
      const fallbackTx = fallbackTransactions.find(
        (t) => t.orderNumber === orderNumber && t.phone === cleanPhone && t.type === 'earn'
      );
      if (fallbackTx) {
        pointsToDeduct = Math.abs(fallbackTx.points);
      } else if (grandTotal && grandTotal > 0) {
        pointsToDeduct = Math.max(1, Math.round(grandTotal / 100));
      }
    }

    if (!pointsToDeduct) return null;

    const account = await this.getOrCreateAccount(cleanPhone);
    const newCurrent = Math.max(0, account.currentPoints - pointsToDeduct);
    const newLifetime = Math.max(0, account.lifetimePointsEarned - pointsToDeduct);
    const updatedTier = this.calculateTier(newLifetime);

    if (mongoose.connection.readyState === 1) {
      try {
        await LoyaltyAccount.updateOne(
          { phone: cleanPhone },
          {
            $set: {
              currentPoints: newCurrent,
              lifetimePointsEarned: newLifetime,
              tier: updatedTier,
            },
          }
        );

        await LoyaltyTransaction.create({
          loyaltyAccountId: account.id || account._id,
          phone: cleanPhone,
          orderNumber,
          type: 'adjustment',
          points: -pointsToDeduct,
          balanceAfter: newCurrent,
          description: `Reversal of ${pointsToDeduct} points for cancelled Order #${orderNumber}`,
          performedBy: 'order-service',
        });
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo reverse failed: ${err?.message}`);
      }
    }

    account.currentPoints = newCurrent;
    account.lifetimePointsEarned = newLifetime;
    account.tier = updatedTier;
    fallbackTransactions.push({
      id: 'tx_' + Date.now(),
      phone: cleanPhone,
      orderNumber,
      type: 'adjustment',
      points: -pointsToDeduct,
      balanceAfter: newCurrent,
      description: `Reversal of ${pointsToDeduct} points for cancelled Order #${orderNumber}`,
      createdAt: new Date().toISOString(),
    });

    return {
      pointsReversed: pointsToDeduct,
      newBalance: newCurrent,
      tier: updatedTier,
    };
  },

  /**
   * Redeem loyalty points for instant dining bill discount (1 point = ₹0.50)
   */
  async redeemPoints(
    phone: string,
    pointsToRedeem: number,
    orderNumber?: string
  ): Promise<{ pointsRedeemed: number; discountAmount: number; remainingPoints: number }> {
    const cleanPhone = String(phone || '').trim();
    const points = Math.floor(Number(pointsToRedeem));

    if (!cleanPhone) throw new BadRequestError('Phone number is required');
    if (!points || points <= 0) {
      throw new BadRequestError('Points to redeem must be greater than zero');
    }
    if (points < 100) {
      throw new BadRequestError('Minimum points redemption threshold is 100 points (₹50 discount)');
    }

    const account = await this.getOrCreateAccount(cleanPhone);
    if (account.currentPoints < points) {
      throw new BadRequestError(
        `Insufficient points. Current balance is ${account.currentPoints} points, but attempted to redeem ${points}.`
      );
    }

    const discountAmount = Math.round(points * 0.5); // 1 pt = ₹0.50
    const remainingPoints = account.currentPoints - points;
    const newLifetimeRedeemed = (account.lifetimePointsRedeemed || 0) + points;

    if (mongoose.connection.readyState === 1) {
      try {
        await LoyaltyAccount.updateOne(
          { phone: cleanPhone },
          {
            $set: {
              currentPoints: remainingPoints,
              lifetimePointsRedeemed: newLifetimeRedeemed,
            },
          }
        );

        await LoyaltyTransaction.create({
          loyaltyAccountId: account.id || account._id,
          phone: cleanPhone,
          orderNumber,
          type: 'redeem',
          points: -points,
          balanceAfter: remainingPoints,
          description: `Redeemed ${points} points for ₹${discountAmount} discount${
            orderNumber ? ` on Order #${orderNumber}` : ''
          }`,
          performedBy: 'customer',
        });
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo redeem error: ${err?.message}`);
      }
    }

    account.currentPoints = remainingPoints;
    account.lifetimePointsRedeemed = newLifetimeRedeemed;
    fallbackTransactions.push({
      id: 'tx_' + Date.now(),
      phone: cleanPhone,
      orderNumber,
      type: 'redeem',
      points: -points,
      balanceAfter: remainingPoints,
      description: `Redeemed ${points} points for ₹${discountAmount} discount`,
      createdAt: new Date().toISOString(),
    });

    return {
      pointsRedeemed: points,
      discountAmount,
      remainingPoints,
    };
  },

  /**
   * Redeem a preconfigured reward voucher from the catalog
   */
  async redeemRewardVoucher(
    phone: string,
    voucherId: string
  ): Promise<{ voucher: IRewardVoucher; promoCode: string; remainingPoints: number }> {
    const cleanPhone = String(phone || '').trim();
    const cleanVoucherId = String(voucherId || '').trim();

    const voucher = REWARD_VOUCHERS.find((v) => v.id === cleanVoucherId && v.isActive);
    if (!voucher) {
      throw new NotFoundError(`Reward voucher '${cleanVoucherId}' not found`);
    }

    const account = await this.getOrCreateAccount(cleanPhone);
    if (account.currentPoints < voucher.pointsCost) {
      throw new BadRequestError(
        `Insufficient points for ${voucher.title}. Requires ${voucher.pointsCost} points, but you have ${account.currentPoints}.`
      );
    }

    const promoCode = `${voucher.codePrefix}-${cleanPhone.slice(-4)}-${Math.floor(
      100 + Math.random() * 900
    )}`;
    const remainingPoints = account.currentPoints - voucher.pointsCost;

    if (mongoose.connection.readyState === 1) {
      try {
        await LoyaltyAccount.updateOne(
          { phone: cleanPhone },
          {
            $set: {
              currentPoints: remainingPoints,
              lifetimePointsRedeemed: (account.lifetimePointsRedeemed || 0) + voucher.pointsCost,
            },
          }
        );

        await LoyaltyTransaction.create({
          loyaltyAccountId: account.id || account._id,
          phone: cleanPhone,
          type: 'redeem',
          points: -voucher.pointsCost,
          balanceAfter: remainingPoints,
          description: `Redeemed voucher: ${voucher.title} (Promo Code: ${promoCode})`,
          metadata: { voucherId: voucher.id, promoCode },
          performedBy: 'customer',
        });
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo voucher redeem error: ${err?.message}`);
      }
    }

    account.currentPoints = remainingPoints;

    return {
      voucher,
      promoCode,
      remainingPoints,
    };
  },

  /**
   * Manual points adjustment by Staff / Superadmin
   */
  async manualPointsAdjustment(
    phone: string,
    pointsDelta: number,
    reason: string,
    staffUser?: any
  ): Promise<any> {
    const cleanPhone = String(phone || '').trim();
    const delta = Number(pointsDelta);
    if (!cleanPhone) throw new BadRequestError('Phone number is required');
    if (!delta || isNaN(delta)) throw new BadRequestError('Valid points delta is required');
    if (!reason?.trim()) throw new BadRequestError('Reason for points adjustment is required');

    const account = await this.getOrCreateAccount(cleanPhone);
    const newBalance = Math.max(0, account.currentPoints + delta);
    const newLifetime = delta > 0 ? account.lifetimePointsEarned + delta : account.lifetimePointsEarned;
    const updatedTier = this.calculateTier(newLifetime);

    if (mongoose.connection.readyState === 1) {
      try {
        await LoyaltyAccount.updateOne(
          { phone: cleanPhone },
          {
            $set: {
              currentPoints: newBalance,
              lifetimePointsEarned: newLifetime,
              tier: updatedTier,
            },
          }
        );

        await LoyaltyTransaction.create({
          loyaltyAccountId: account.id || account._id,
          phone: cleanPhone,
          type: 'adjustment',
          points: delta,
          balanceAfter: newBalance,
          description: `Staff adjustment: ${reason}`,
          performedBy: staffUser?.name || staffUser?.email || 'admin',
        });
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo adjustment failed: ${err?.message}`);
      }
    }

    account.currentPoints = newBalance;
    account.lifetimePointsEarned = newLifetime;
    account.tier = updatedTier;

    return {
      phone: cleanPhone,
      adjustedPoints: delta,
      newBalance,
      tier: updatedTier,
      reason,
    };
  },

  /**
   * Reward vouchers catalog
   */
  async getRewardsCatalog(): Promise<{ vouchers: IRewardVoucher[]; tiers: typeof LOYALTY_TIER_RULES }> {
    return {
      vouchers: REWARD_VOUCHERS,
      tiers: LOYALTY_TIER_RULES,
    };
  },

  /**
   * Analytics breakdown for marketing & CRM
   */
  async getLoyaltyStats(): Promise<{
    totalEnrolled: number;
    tierBreakdown: Record<LoyaltyTier, number>;
    totalPointsIssued: number;
    totalPointsRedeemed: number;
    topLoyalMembers: any[];
  }> {
    if (mongoose.connection.readyState === 1) {
      try {
        const [
          totalEnrolled,
          bronzeCount,
          silverCount,
          goldCount,
          platinumCount,
          totalsAggregation,
          topMembers,
        ] = await Promise.all([
          LoyaltyAccount.countDocuments(),
          LoyaltyAccount.countDocuments({ tier: 'bronze' }),
          LoyaltyAccount.countDocuments({ tier: 'silver' }),
          LoyaltyAccount.countDocuments({ tier: 'gold' }),
          LoyaltyAccount.countDocuments({ tier: 'platinum' }),
          LoyaltyAccount.aggregate([
            {
              $group: {
                _id: null,
                totalIssued: { $sum: '$lifetimePointsEarned' },
                totalRedeemed: { $sum: '$lifetimePointsRedeemed' },
              },
            },
          ]),
          LoyaltyAccount.find().sort({ lifetimePointsEarned: -1 }).limit(5).lean(),
        ]);

        return {
          totalEnrolled,
          tierBreakdown: {
            bronze: bronzeCount,
            silver: silverCount,
            gold: goldCount,
            platinum: platinumCount,
          },
          totalPointsIssued: totalsAggregation[0]?.totalIssued || 0,
          totalPointsRedeemed: totalsAggregation[0]?.totalRedeemed || 0,
          topLoyalMembers: topMembers,
        };
      } catch (err: any) {
        console.warn(`[LoyaltyService] Mongo stats error: ${err?.message}`);
      }
    }

    return {
      totalEnrolled: fallbackAccounts.length,
      tierBreakdown: {
        bronze: fallbackAccounts.filter((a) => a.tier === 'bronze').length,
        silver: fallbackAccounts.filter((a) => a.tier === 'silver').length,
        gold: fallbackAccounts.filter((a) => a.tier === 'gold').length,
        platinum: fallbackAccounts.filter((a) => a.tier === 'platinum').length,
      },
      totalPointsIssued: fallbackAccounts.reduce((sum, a) => sum + a.lifetimePointsEarned, 0),
      totalPointsRedeemed: fallbackAccounts.reduce((sum, a) => sum + a.lifetimePointsRedeemed, 0),
      topLoyalMembers: fallbackAccounts.slice(0, 5),
    };
  },

  /**
   * Health status
   */
  async getStatus() {
    return {
      module: 'loyalty',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      activeTiers: ['bronze', 'silver', 'gold', 'platinum'],
      timestamp: new Date().toISOString(),
    };
  },
};

export default loyaltyService;
