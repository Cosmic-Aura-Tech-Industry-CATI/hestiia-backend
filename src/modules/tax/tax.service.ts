import mongoose from 'mongoose';
import { db } from '../../shared/config/store.js';
import { Setting } from '../settings/setting.model.js';
import { Order } from '../orders/order.model.js';
import { AppError } from '../../shared/utils/appError.js';
import type {
  TaxRateConfig,
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxComponentBreakdown,
  Gstr3bSummary,
} from './tax.interface.js';

const DEFAULT_TAX_CONFIG: TaxRateConfig = {
  cgstPercent: 2.5,
  sgstPercent: 2.5,
  igstPercent: 5.0,
  totalTaxPercent: 5.0,
  sacCode: '996331', // Services Accounting Code: Restaurant and catering services
  gstin: '09AAACH7412K1ZV', // Uttar Pradesh (09) State GSTIN
  legalName: 'Hestiia Hospitality Private Limited',
  tradeName: 'Hestiia Restaurant & Fine Dine',
  stateCode: '09',
  stateName: 'Uttar Pradesh',
};

let currentConfig: TaxRateConfig = { ...DEFAULT_TAX_CONFIG };

export const taxService = {
  /**
   * Get active GST statutory configuration
   */
  async getConfig(): Promise<TaxRateConfig> {
    if (mongoose.connection.readyState === 1) {
      try {
        const setting = await Setting.findOne().lean();
        if (setting && setting.taxRatePercent !== undefined) {
          const totalTax = Number(setting.taxRatePercent) || 5.0;
          return {
            ...currentConfig,
            totalTaxPercent: totalTax,
            cgstPercent: Number((totalTax / 2).toFixed(2)),
            sgstPercent: Number((totalTax / 2).toFixed(2)),
            igstPercent: totalTax,
          };
        }
      } catch {}
    }

    const stateSettings = db.getState().settings;
    if (stateSettings && stateSettings.taxRatePercent !== undefined) {
      const totalTax = Number(stateSettings.taxRatePercent) || 5.0;
      return {
        ...currentConfig,
        totalTaxPercent: totalTax,
        cgstPercent: Number((totalTax / 2).toFixed(2)),
        sgstPercent: Number((totalTax / 2).toFixed(2)),
        igstPercent: totalTax,
      };
    }

    return currentConfig;
  },

  /**
   * Update tax configuration (Superadmin only)
   */
  async updateConfig(updates: Partial<TaxRateConfig>, actor = 'Superadmin'): Promise<TaxRateConfig> {
    if (updates.totalTaxPercent !== undefined) {
      const total = Number(updates.totalTaxPercent);
      if (total < 0 || total > 40) {
        throw new AppError('Tax rate percent must be between 0% and 40%', 400);
      }
      updates.cgstPercent = Number((total / 2).toFixed(2));
      updates.sgstPercent = Number((total / 2).toFixed(2));
      updates.igstPercent = total;

      // Sync with settings in DB & store
      if (mongoose.connection.readyState === 1) {
        try {
          await Setting.findOneAndUpdate({}, { $set: { taxRatePercent: total } }, { upsert: true });
        } catch {}
      }
      db.updateState((s) => {
        s.settings.taxRatePercent = total;
      });
    }

    currentConfig = {
      ...currentConfig,
      ...updates,
    };

    db.logAudit('UPDATE_TAX_CONFIG', actor, `Updated GST tax configuration. Total GST: ${currentConfig.totalTaxPercent}%`);
    return currentConfig;
  },

  /**
   * Universal GST calculation engine using integer paise arithmetic
   */
  async calculateTax(req: TaxCalculationRequest): Promise<TaxCalculationResult> {
    const config = await this.getConfig();
    const isInterstate = Boolean(req.isInterstate);

    let subtotalPaise = 0;
    if (req.subtotalPaise !== undefined) {
      subtotalPaise = Math.round(Number(req.subtotalPaise));
    } else if (req.subtotal !== undefined) {
      subtotalPaise = Math.round(Number(req.subtotal) * 100);
    } else if (req.items && req.items.length > 0) {
      subtotalPaise = req.items.reduce((sum, item) => {
        const itemPricePaise = Math.round((item.price || 0) * 100);
        return sum + itemPricePaise * (item.quantity || 1);
      }, 0);
    }

    // Packaging charge is subject to 5% GST under restaurant service composite supply
    const packagingPaise = Math.round(Number(req.packagingFee || 0) * 100);
    const discountPaise = Math.round(Number(req.discountAmount || 0) * 100);

    // Taxable base = Subtotal + Packaging - Discounts
    const taxablePaise = Math.max(0, subtotalPaise + packagingPaise - discountPaise);

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    const components: TaxComponentBreakdown[] = [];

    if (isInterstate) {
      igstPaise = Math.round((taxablePaise * config.igstPercent) / 100);
      components.push({
        name: 'Integrated GST (IGST)',
        ratePercent: config.igstPercent,
        taxableAmount: taxablePaise / 100,
        taxableAmountPaise: taxablePaise,
        taxAmount: igstPaise / 100,
        taxAmountPaise: igstPaise,
      });
    } else {
      cgstPaise = Math.round((taxablePaise * config.cgstPercent) / 100);
      sgstPaise = Math.round((taxablePaise * config.sgstPercent) / 100);

      components.push({
        name: 'Central GST (CGST)',
        ratePercent: config.cgstPercent,
        taxableAmount: taxablePaise / 100,
        taxableAmountPaise: taxablePaise,
        taxAmount: cgstPaise / 100,
        taxAmountPaise: cgstPaise,
      });

      components.push({
        name: 'State GST (SGST)',
        ratePercent: config.sgstPercent,
        taxableAmount: taxablePaise / 100,
        taxableAmountPaise: taxablePaise,
        taxAmount: sgstPaise / 100,
        taxAmountPaise: sgstPaise,
      });
    }

    const totalTaxPaise = isInterstate ? igstPaise : cgstPaise + sgstPaise;

    return {
      taxableAmount: taxablePaise / 100,
      taxableAmountPaise: taxablePaise,
      cgst: cgstPaise / 100,
      cgstPaise,
      sgst: sgstPaise / 100,
      sgstPaise,
      igst: igstPaise / 100,
      igstPaise,
      totalTax: totalTaxPaise / 100,
      totalTaxPaise,
      effectiveRatePercent: config.totalTaxPercent,
      sacCode: config.sacCode,
      isInterstate,
      components,
    };
  },

  /**
   * Fast statutory estimate for customer cart / pre-checkout
   */
  async getEstimate(amount: number): Promise<{
    taxableAmount: number;
    cgst: number;
    sgst: number;
    totalTax: number;
    effectiveRate: number;
  }> {
    const quote = await this.calculateTax({ subtotal: Number(amount) || 0 });
    return {
      taxableAmount: quote.taxableAmount,
      cgst: quote.cgst,
      sgst: quote.sgst,
      totalTax: quote.totalTax,
      effectiveRate: quote.effectiveRatePercent,
    };
  },

  /**
   * Generate official monthly GSTR-3B tax report numbers
   */
  async getGstr3bSummary(period = 'current_month'): Promise<Gstr3bSummary> {
    const config = await this.getConfig();

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let paidOrders: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        paidOrders = await Order.find({ paymentStatus: 'paid' }).lean();
      } catch {}
    }

    if (paidOrders.length === 0) {
      paidOrders = db.getState().orders.filter((o) => o.paymentStatus === 'paid');
    }

    const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.grandTotal || 0), 0);
    const totalTax = paidOrders.reduce((acc, o) => acc + (o.taxAmount || 0), 0);
    const totalDiscounts = paidOrders.reduce((acc, o) => acc + (o.discountAmount || 0), 0);
    const taxableSales = Math.max(0, totalRevenue - totalTax);

    const taxableSalesPaise = Math.round(taxableSales * 100);
    const totalTaxPaise = Math.round(totalTax * 100);
    const cgstPaise = Math.round(totalTaxPaise / 2);
    const sgstPaise = totalTaxPaise - cgstPaise;

    return {
      period,
      taxPeriodMonth: currentMonthStr,
      gstin: config.gstin,
      legalName: config.legalName,
      stateCode: config.stateCode,
      outwardTaxableSupplies: taxableSales,
      outwardTaxableSuppliesPaise: taxableSalesPaise,
      cgstPayable: cgstPaise / 100,
      cgstPayablePaise: cgstPaise,
      sgstPayable: sgstPaise / 100,
      sgstPayablePaise: sgstPaise,
      totalTaxPayable: totalTaxPaise / 100,
      totalTaxPayablePaise: totalTaxPaise,
      exemptOrDiscounts: totalDiscounts,
      orderCount: paidOrders.length,
      generatedAt: new Date().toISOString(),
    };
  },

  async getStatus() {
    const config = await this.getConfig();
    return {
      module: 'tax',
      status: 'operational',
      statutoryDetails: {
        sacCode: config.sacCode,
        gstin: config.gstin,
        state: `${config.stateName} (${config.stateCode})`,
        rateSplit: `CGST ${config.cgstPercent}% + SGST ${config.sgstPercent}% = Total ${config.totalTaxPercent}%`,
      },
      timestamp: new Date().toISOString(),
    };
  },
};

export default taxService;
