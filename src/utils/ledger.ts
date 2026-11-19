import {
  FeeCode,
  LedgerEvent,
  LedgerItem,
  LedgerResult,
  LedgerTotals,
  UnmatchedEvent,
} from '../types/ledger';

/** Lowercase, strip everything that is not alphanumeric, so "Sub-Order No" ids compare safely. */
export function normalizeKey(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps a marketplace reason/description string onto the canonical fee taxonomy.
 * Checked in order: the most specific phrases first (reverse shipping before shipping).
 */
const FEE_PATTERNS: Array<{ code: FeeCode; needles: string[] }> = [
  { code: 'reverse_shipping', needles: ['reverse shipping', 'return shipping', 'rto charge', 'return freight', 'reverse freight'] },
  { code: 'weight_surcharge', needles: ['weight difference', 'weight discrepancy', 'weight slab', 'weight surcharge', 'overweight', 'weight charge'] },
  { code: 'collection_fee', needles: ['collection fee', 'payment gateway', 'pg fee', 'cod collection', 'collection charge'] },
  { code: 'fixed_fee', needles: ['fixed fee', 'fixed charge', 'closing fee'] },
  { code: 'commission', needles: ['commission', 'referral fee', 'referral'] },
  { code: 'shipping', needles: ['shipping', 'delivery charge', 'freight', 'logistics', 'forward shipping'] },
  { code: 'penalty', needles: ['penalty', 'cancellation charge', 'late dispatch', 'non compliance', 'penalty charge'] },
  { code: 'tcs', needles: ['tcs', 'tax collected at source'] },
  { code: 'tds', needles: ['tds', 'tax deducted at source'] },
  { code: 'ads', needles: ['ads', 'advertisement', 'sponsored', 'ad spend'] },
  { code: 'refund', needles: ['refund', 'return', 'customer return'] },
  { code: 'principal', needles: ['principal', 'item price', 'product price', 'sale amount', 'selling price', 'item total'] },
];

export function feeCodeFromReason(raw: string): FeeCode {
  const text = (raw || '').toLowerCase();
  for (const pattern of FEE_PATTERNS) {
    if (pattern.needles.some((needle) => text.includes(needle))) return pattern.code;
  }
  return 'other';
}

export function makeEventId(event: Omit<LedgerEvent, 'id'>): string {
  return [
    event.channel,
    normalizeKey(event.subOrderId),
    event.eventType,
    event.feeCode ?? 'na',
    // Two fee columns can share a code, date and amount (e.g. two fixed fees).
    event.rawRow?.feeLabel ?? '',
    event.eventDate,
    event.settlementId ?? 'na',
    Math.round(event.amount * 100),
  ].join('|');
}

/**
 * Files are snapshots and may be re-uploaded. Two rows describing the same fact
 * (same channel, order, type, fee, date, settlement id and amount) are one event.
 */
export function dedupeEvents(events: LedgerEvent[]): { events: LedgerEvent[]; dropped: number } {
  const seen = new Set<string>();
  const unique: LedgerEvent[] = [];
  for (const event of events) {
    const signature = makeEventId(event);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(event);
  }
  return { events: unique, dropped: events.length - unique.length };
}

export interface SkuCost {
  sku: string;
  costPrice: number;
  packagingCost?: number;
}

interface SaleMeta {
  qty: number;
  saleDate: string;
  status: string;
  amount: number;
}

function itemKey(event: LedgerEvent): string {
  const bySubOrder = normalizeKey(event.subOrderId);
  if (bySubOrder) return bySubOrder;
  // Fallback composite key when a report only carries the parent order id.
  return `${normalizeKey(event.orderId)}::${normalizeKey(event.sku)}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Attaches settlement/return events to their sale rows and computes per-item P&L.
 *
 * Matching rules, in order:
 *   1. exact sub-order id (normalized)
 *   2. composite order id + sku
 *   3. unmatched bucket with a reason (never silently dropped)
 */
export function buildLedger(
  saleEvents: LedgerEvent[],
  otherEvents: LedgerEvent[],
  skuCosts: SkuCost[] = [],
): LedgerResult {
  const dedupedSales = dedupeEvents(saleEvents);
  const dedupedOthers = dedupeEvents(otherEvents);

  const costBySku = new Map<string, SkuCost>();
  for (const cost of skuCosts) costBySku.set(normalizeKey(cost.sku), cost);

  const saleGroups = new Map<string, LedgerEvent[]>();
  for (const event of dedupedSales.events) {
    const key = itemKey(event);
    const group = saleGroups.get(key);
    if (group) group.push(event);
    else saleGroups.set(key, [event]);
  }

  const matchedByKey = new Map<string, LedgerEvent[]>();
  const unmatchedPayments: UnmatchedEvent[] = [];

  for (const event of dedupedOthers.events) {
    const key = itemKey(event);
    const hasSubOrder = normalizeKey(event.subOrderId).length > 0;
    if (!hasSubOrder && !key.replace('::', '')) {
      unmatchedPayments.push({ event, reason: 'missing_key' });
      continue;
    }
    if (!saleGroups.has(key)) {
      unmatchedPayments.push({ event, reason: 'no_sale_row' });
      continue;
    }
    const bucket = matchedByKey.get(key);
    if (bucket) bucket.push(event);
    else matchedByKey.set(key, [event]);
  }

  const items: LedgerItem[] = [];
  const unmatchedSales: UnmatchedEvent[] = [];

  for (const [key, sales] of saleGroups) {
    const first = sales[0];
    const meta: SaleMeta = {
      qty: 0,
      saleDate: first.eventDate,
      status: first.rawRow['status'] || first.rawRow['Status'] || '',
      amount: 0,
    };
    for (const sale of sales) {
      const qty = Number(sale.rawRow['qty'] || sale.rawRow['quantity'] || 1) || 1;
      meta.qty += qty;
      meta.amount += sale.amount;
    }

    const attached = matchedByKey.get(key) ?? [];
    const allEvents = [...sales, ...attached];

    const fees: Partial<Record<FeeCode, number>> = {};
    let totalFees = 0;
    let actualPayout = 0;
    let grossFromPrincipal = 0;
    const settlementIds = new Set<string>();

    for (const event of allEvents) {
      if (event.eventType === 'sale') continue;
      if (event.eventType === 'settlement') {
        actualPayout += event.amount;
        if (event.settlementId) settlementIds.add(event.settlementId);
      }
      if (event.feeCode === 'principal') {
        grossFromPrincipal += event.amount;
        continue;
      }
      if (event.amount < 0) {
        const code = event.feeCode ?? 'other';
        const abs = Math.abs(event.amount);
        fees[code] = round2((fees[code] ?? 0) + abs);
        totalFees = round2(totalFees + abs);
      }
    }

    const grossSale = round2(grossFromPrincipal > 0 ? grossFromPrincipal : meta.amount);
    const settled = attached.some((event) => event.eventType === 'settlement');
    // Settled orders report the real payout; unsettled ones can only report the sale value.
    const netPayout = settled ? round2(actualPayout) : grossSale;

    const cost = costBySku.get(normalizeKey(first.sku));
    const unitCost = cost?.costPrice ?? 0;
    const costKnown = unitCost > 0;
    const cogs = costKnown ? round2(unitCost * meta.qty) : 0;
    const packaging = costKnown ? round2((cost?.packagingCost ?? 0) * meta.qty) : 0;
    const netProfit = settled && costKnown ? round2(actualPayout - cogs - packaging) : 0;

    // What the marketplace says the item was worth = payout + every fee it took.
    const principalCredited = round2(actualPayout + totalFees);
    const discrepancy = settled && grossSale > 0 ? round2(grossSale - principalCredited) : 0;

    items.push({
      key,
      channel: first.channel,
      subOrderId: first.subOrderId,
      orderId: first.orderId,
      sku: first.sku,
      qty: meta.qty,
      saleDate: meta.saleDate,
      status: meta.status,
      grossSale,
      fees,
      totalFees,
      actualPayout: round2(actualPayout),
      netPayout: round2(netPayout),
      settlementIds: [...settlementIds],
      settled,
      matchStatus: settled ? 'matched' : 'sale_only',
      costKnown,
      cogs,
      packaging,
      netProfit,
      discrepancy,
      events: allEvents,
    });

    if (!settled) unmatchedSales.push({ event: first, reason: 'no_sale_row' });
  }

  const totals = summarize(items, unmatchedPayments.length);

  return {
    items,
    unmatchedSales,
    unmatchedPayments,
    duplicatesDropped: dedupedSales.dropped + dedupedOthers.dropped,
    totals,
  };
}

function summarize(items: LedgerItem[], unmatchedPayments: number): LedgerTotals {
  const totals: LedgerTotals = {
    orderItems: items.length,
    matched: 0,
    saleOnly: 0,
    paymentOnly: unmatchedPayments,
    grossSale: 0,
    totalFees: 0,
    netPayout: 0,
    cogs: 0,
    packaging: 0,
    netProfit: 0,
    unsettledValue: 0,
    underpaidValue: 0,
    incompleteCostItems: 0,
  };

  for (const item of items) {
    totals.grossSale += item.grossSale;
    totals.totalFees += item.totalFees;
    totals.netPayout += item.netPayout;
    totals.cogs += item.cogs;
    totals.packaging += item.packaging;
    totals.netProfit += item.netProfit;

    if (item.matchStatus === 'matched') totals.matched += 1;
    else totals.saleOnly += 1;

    if (!item.settled) totals.unsettledValue += item.grossSale;
    if (item.discrepancy > 20) totals.underpaidValue += item.discrepancy;
    if (!item.costKnown) totals.incompleteCostItems += 1;
  }

  totals.grossSale = round2(totals.grossSale);
  totals.totalFees = round2(totals.totalFees);
  totals.netPayout = round2(totals.netPayout);
  totals.cogs = round2(totals.cogs);
  totals.packaging = round2(totals.packaging);
  totals.netProfit = round2(totals.netProfit);
  totals.unsettledValue = round2(totals.unsettledValue);
  totals.underpaidValue = round2(totals.underpaidValue);

  return totals;
}
