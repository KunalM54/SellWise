/**
 * SellWise ledger model.
 *
 * Every marketplace file is a *view* of the same order at a different stage:
 *   orders file   -> `sale` event      (what should happen)
 *   payment file  -> `settlement` events (what actually happened, one per fee line)
 *   returns file  -> `return` event     (what was undone)
 *
 * The join key is the sub-order / order-item id. Everything else is attached to it.
 */

export type Channel = 'meesho' | 'flipkart' | 'amazon';

/** The three Meesho exports, plus the fallback for unrecognised files. */
export type LedgerFileKind = 'orders' | 'returns' | 'payment' | 'unknown';

/** What was uploaded, kept so the user can see and remove each source file. */
export interface LedgerFileMeta {
  id: string;
  fileName: string;
  kind: LedgerFileKind;
  rowCount: number;
  eventCount: number;
  uploadedAt: string;
}

export type LedgerEventType = 'sale' | 'settlement' | 'return' | 'gst';

/**
 * Canonical fee taxonomy. Marketplace reason strings are mapped onto these once,
 * so reports never depend on a channel's wording again.
 */
export type FeeCode =
  | 'principal' // product value credited to the seller
  | 'commission'
  | 'fixed_fee'
  | 'collection_fee'
  | 'shipping'
  | 'reverse_shipping'
  | 'weight_surcharge'
  | 'penalty'
  | 'tcs'
  | 'tds'
  | 'ads'
  | 'refund'
  | 'other';

export interface LedgerEvent {
  /** Deterministic id: channel|subOrderId|type|feeCode|date|settlementId */
  id: string;
  channel: Channel;
  subOrderId: string;
  orderId: string;
  sku: string;
  eventType: LedgerEventType;
  feeCode?: FeeCode;
  /** Signed effect on the seller's payout: + credit, - debit. */
  amount: number;
  eventDate: string;
  settlementId?: string;
  sourceFile: string;
  sourceRow: number;
  rawRow: Record<string, string>;
}

export type LedgerMatchStatus = 'matched' | 'sale_only' | 'payment_only';

export type UnmatchedReason = 'missing_key' | 'no_sale_row' | 'ambiguous_key';

export interface UnmatchedEvent {
  event: LedgerEvent;
  reason: UnmatchedReason;
}

export interface LedgerItem {
  key: string;
  channel: Channel;
  subOrderId: string;
  orderId: string;
  sku: string;
  qty: number;
  saleDate: string;
  status: string;
  /** Sum of `principal` events (gross sale value as credited). */
  grossSale: number;
  /** Absolute value of every fee, grouped by canonical code. */
  fees: Partial<Record<FeeCode, number>>;
  totalFees: number;
  /** Signed sum of settlement events = what the marketplace actually paid. */
  actualPayout: number;
  /** Sum of sale + return + settlement events. */
  netPayout: number;
  settlementIds: string[];
  settled: boolean;
  matchStatus: LedgerMatchStatus;
  /** true when the SKU had a cost price in the master, so profit is real. */
  costKnown: boolean;
  cogs: number;
  packaging: number;
  netProfit: number;
  /** Expected payout minus actual payout; > 0 means we were underpaid. */
  discrepancy: number;
  events: LedgerEvent[];
}

export interface LedgerTotals {
  orderItems: number;
  matched: number;
  saleOnly: number;
  paymentOnly: number;
  grossSale: number;
  totalFees: number;
  netPayout: number;
  cogs: number;
  packaging: number;
  netProfit: number;
  unsettledValue: number;
  underpaidValue: number;
  incompleteCostItems: number;
}

export interface LedgerResult {
  items: LedgerItem[];
  unmatchedSales: UnmatchedEvent[];
  unmatchedPayments: UnmatchedEvent[];
  duplicatesDropped: number;
  totals: LedgerTotals;
}
