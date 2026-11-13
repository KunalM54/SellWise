export type Marketplace = 'meesho' | 'flipkart' | 'amazon' | 'all';

export type OrderStatus = 
  | 'Delivered' 
  | 'Shipped' 
  | 'In-Transit' 
  | 'RTO' 
  | 'Customer Return' 
  | 'Cancelled'
  | 'Ready To Ship'
  | 'Out For Delivery'
  | 'Return Received'
  | 'Return Not Received'
  | 'Return In Transit'
  | 'Return Mismatch'
  | 'Unsettled Pickup'
  | 'Cancel Pickup';

export type ReconciliationStatus = 'Settled' | 'Discrepancy' | 'Pending' | 'Claim Filed' | 'Claim Approved';

export interface SkuMasterItem {
  sku: string;
  title: string;
  costPrice: number;
  packagingCost: number;
  weightGrams: number;
  category?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  orderNumber?: string;
  marketplace: 'meesho' | 'flipkart' | 'amazon';
  orderDate: string;
  sku: string;
  title: string;
  quantity: number;
  customerCity: string;
  customerState: string;
  salePrice: number;
  productCost: number; // Seller's base cost
  packagingCost: number;
  marketplaceCommission: number;
  shippingFee: number;
  reverseShippingFee: number; // for RTO/Returns
  taxesAndGst: number;
  expectedPayout: number;
  actualPayout: number;
  status: OrderStatus;
  reconciliationStatus: ReconciliationStatus;
  discrepancyAmount: number; // expected - actual
  discrepancyReason?: string;
  claimEligible: boolean;
  claimStatus?: 'Not Eligible' | 'Eligible' | 'Filed' | 'Approved' | 'Rejected';
  // Courier & Order Mantra metadata
  awbNumber?: string;
  courier?: string;
  returnType?: 'RTO' | 'CUSTOMER RETURN' | 'DELIVERED' | 'CANCELLED';
  scanDate?: string;
  daysInTransit?: number;
  // Weight & Bank reconciliation metadata
  billedWeightGrams?: number;
  actualWeightGrams?: number;
  weightDiscrepancy?: boolean;
  bankUtr?: string;
  bankDepositDate?: string;
}

export interface SkuMetric {
  sku: string;
  title: string;
  totalOrders: number;
  deliveredOrders: number;
  rtoOrders: number;
  customerReturns: number;
  totalRevenue: number;
  totalCost: number;
  totalMarketplaceFees: number;
  netProfit: number;
  profitMarginPercent: number;
  returnRatePercent: number;
  type: 'Hero' | 'Profitable' | 'Breakeven' | 'Laggard';
  weightGrams?: number;
}

export interface ClaimItem {
  id: string;
  orderId: string;
  marketplace: 'meesho' | 'flipkart' | 'amazon';
  sku: string;
  claimType: 'Wrong Return' | 'Damaged in Transit' | 'Weight Mismatch Overcharge' | 'Payment Not Credited';
  amountClaimed: number;
  amountApproved: number;
  filingDate: string;
  status: 'Draft' | 'Filed' | 'Approved' | 'Rejected';
  ticketId?: string;
  deadlineDate: string;
  evidenceNotes?: string;
  barcode?: string;
}
