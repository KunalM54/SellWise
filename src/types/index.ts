/**
 * Seller-entered cost data. This is the only "manual" input in SellWise:
 * everything else is derived from Meesho's own files.
 */
export interface SkuMasterItem {
  sku: string;
  title: string;
  costPrice: number;
  packagingCost: number;
  weightGrams: number;
  category?: string;
}
