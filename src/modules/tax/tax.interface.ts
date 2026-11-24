export interface TaxRateConfig {
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  totalTaxPercent: number;
  sacCode: string;
  gstin: string;
  legalName: string;
  tradeName: string;
  stateCode: string;
  stateName: string;
}

export interface TaxCalculationItem {
  name: string;
  price: number;
  quantity: number;
  sacCode?: string;
}

export interface TaxCalculationRequest {
  subtotal?: number;
  subtotalPaise?: number;
  items?: TaxCalculationItem[];
  packagingFee?: number;
  deliveryFee?: number;
  discountAmount?: number;
  isInterstate?: boolean;
}

export interface TaxComponentBreakdown {
  name: string;
  ratePercent: number;
  taxableAmount: number;
  taxableAmountPaise: number;
  taxAmount: number;
  taxAmountPaise: number;
}

export interface TaxCalculationResult {
  taxableAmount: number;
  taxableAmountPaise: number;
  cgst: number;
  cgstPaise: number;
  sgst: number;
  sgstPaise: number;
  igst: number;
  igstPaise: number;
  totalTax: number;
  totalTaxPaise: number;
  effectiveRatePercent: number;
  sacCode: string;
  isInterstate: boolean;
  components: TaxComponentBreakdown[];
}

export interface Gstr3bSummary {
  period: string;
  taxPeriodMonth: string;
  gstin: string;
  legalName: string;
  stateCode: string;
  outwardTaxableSupplies: number;
  outwardTaxableSuppliesPaise: number;
  cgstPayable: number;
  cgstPayablePaise: number;
  sgstPayable: number;
  sgstPayablePaise: number;
  totalTaxPayable: number;
  totalTaxPayablePaise: number;
  exemptOrDiscounts: number;
  orderCount: number;
  generatedAt: string;
}
