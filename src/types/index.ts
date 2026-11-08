export type Marketplace = 'meesho' | 'flipkart' | 'amazon' | 'all';

export type OrderStatus = 'Delivered' | 'Shipped' | 'In-Transit' | 'RTO' | 'Customer Return' | 'Cancelled';

export type ReconciliationStatus = 'Settled' | 'Discrepancy' | 'Pending' | 'Claim Filed' | 'Claim Approved';

export interface OrderItem {
  id: string;
  orderId: string;
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
}
