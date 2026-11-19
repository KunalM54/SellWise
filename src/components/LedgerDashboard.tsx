import React, { useMemo } from 'react';
import {
  ShoppingBag,
  IndianRupee,
  Receipt,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  PackageSearch,
  RotateCcw,
  Megaphone,
  CircleDollarSign,
} from 'lucide-react';
import { FeeCode, LedgerFileMeta, LedgerItem, LedgerResult } from '../types/ledger';
import { MetricCard } from './MetricCard';
import { formatINR, formatNumber, formatPercent } from '../utils/format';
import { FEE_LABELS } from '../utils/feeLabels';

interface LedgerDashboardProps {
  ledger: LedgerResult;
  files: LedgerFileMeta[];
  onOpenSkuManager: () => void;
  onOpenOrders: () => void;
}

type StatusGroup = 'Delivered' | 'In transit' | 'Pending dispatch' | 'RTO' | 'Cancelled' | 'Other';

const STATUS_ORDER: StatusGroup[] = ['Delivered', 'In transit', 'Pending dispatch', 'RTO', 'Cancelled', 'Other'];

const STATUS_STYLE: Record<StatusGroup, string> = {
  Delivered: 'bg-leaf',
  'In transit': 'bg-sky',
  'Pending dispatch': 'bg-sun',
  RTO: 'bg-coral',
  Cancelled: 'bg-ink-muted/60',
  Other: 'bg-outline-strong',
};

function statusGroup(status: string): StatusGroup {
  const value = (status || '').toUpperCase();
  if (value.includes('DELIVERED')) return 'Delivered';
  if (value.includes('RTO')) return 'RTO';
  if (value.includes('CANCEL')) return 'Cancelled';
  if (value.includes('SHIPPED') || value.includes('TRANSIT') || value.includes('OFD')) return 'In transit';
  if (value.includes('READY') || value.includes('PENDING') || value.includes('HOLD')) return 'Pending dispatch';
  return 'Other';
}

function feeTotals(items: LedgerItem[]): Array<{ code: FeeCode; amount: number }> {
  const totals = new Map<FeeCode, number>();
  for (const item of items) {
    for (const [code, amount] of Object.entries(item.fees) as Array<[FeeCode, number]>) {
      totals.set(code, (totals.get(code) ?? 0) + amount);
    }
  }
  return [...totals.entries()]
    .map(([code, amount]) => ({ code, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export const LedgerDashboard: React.FC<LedgerDashboardProps> = ({
  ledger,
  files,
  onOpenSkuManager,
  onOpenOrders,
}) => {
  const { items, totals, unmatchedPayments } = ledger;

  const derived = useMemo(() => {
    const units = items.reduce((sum, item) => sum + item.qty, 0);
    const settledItems = items.filter((item) => item.settled);
    const settledPayout = settledItems.reduce((sum, item) => sum + item.actualPayout, 0);
    const realisedProfit = settledItems
      .filter((item) => item.costKnown)
      .reduce((sum, item) => sum + item.netProfit, 0);

    const estimatedProfit = items.reduce((sum, item) => {
      if (item.settled || !item.costKnown) return sum;
      const group = statusGroup(item.status);
      if (group !== 'Delivered' && group !== 'In transit') return sum;
      return sum + item.grossSale - item.totalFees - item.cogs - item.packaging;
    }, 0);

    const groups = new Map<StatusGroup, { orders: number; units: number; value: number }>();
    for (const item of items) {
      const group = statusGroup(item.status);
      const bucket = groups.get(group) ?? { orders: 0, units: 0, value: 0 };
      bucket.orders += 1;
      bucket.units += item.qty;
      bucket.value += item.grossSale;
      groups.set(group, bucket);
    }

    const statusBreakdown = STATUS_ORDER.map((group) => ({
      group,
      ...(groups.get(group) ?? { orders: 0, units: 0, value: 0 }),
    })).filter((entry) => entry.orders > 0);

    const returnItems = items.filter((item) => item.events.some((event) => event.eventType === 'return'));
    const rtoItems = items.filter((item) => statusGroup(item.status) === 'RTO');
    const pendingItems = items.filter((item) => !item.settled);
    const adsSpend = unmatchedPayments
      .filter((entry) => entry.event.feeCode === 'ads')
      .reduce((sum, entry) => sum + Math.abs(entry.event.amount), 0);
    const unmatchedValue = unmatchedPayments.reduce((sum, entry) => sum + Math.abs(entry.event.amount), 0);

    return {
      units,
      settledItems,
      settledPayout,
      realisedProfit,
      estimatedProfit,
      statusBreakdown,
      returnItems,
      rtoItems,
      pendingItems,
      adsSpend,
      unmatchedValue,
      fees: feeTotals(items),
    };
  }, [items, unmatchedPayments]);

  if (items.length === 0) {
    return (
      <div className="bg-surface-elevated rounded-card border border-outline shadow-soft p-8 text-center">
        <PackageSearch className="w-9 h-9 mx-auto text-ink-muted/60 mb-3" />
        <h2 className="text-sm font-bold font-display text-ink">No Meesho data yet</h2>
        <p className="text-xs text-ink-muted mt-1 max-w-lg mx-auto">
          Upload the orders CSV to start. Add the returns CSV to track RTO and customer returns, then the payment
          Excel file to reconcile fees and payouts. Add your cost prices under SKU Costs to unlock real profit.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          {[
            ['1', 'Upload orders CSV', 'What you sold and its current status'],
            ['2', 'Add returns + payments', 'Returns CSV and payment XLSX'],
            ['3', 'Set SKU costs', 'Cost price and packaging per SKU'],
          ].map(([step, title, hint]) => (
            <div key={step} className="rounded-xl border border-outline bg-surface-sunken/50 p-3">
              <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-sky text-white text-[10px] font-bold">
                {step}
              </span>
              <p className="text-xs font-bold text-ink mt-2">{title}</p>
              <p className="text-[10px] text-ink-muted">{hint}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const profitValue =
    derived.realisedProfit !== 0
      ? formatINR(derived.realisedProfit)
      : derived.estimatedProfit !== 0
      ? `~${formatINR(derived.estimatedProfit)}`
      : '—';

  const profitHint =
    derived.realisedProfit !== 0
      ? 'From settled orders with known cost'
      : derived.estimatedProfit !== 0
      ? 'Estimate — awaiting payment file'
      : 'Add SKU cost prices to see profit';

  const maxStatusValue = Math.max(...derived.statusBreakdown.map((entry) => entry.value), 1);
  const maxFee = Math.max(...derived.fees.map((entry) => entry.amount), 1);

  const skuRows = (() => {
    const map = new Map<
      string,
      {
        sku: string;
        orders: number;
        gross: number;
        payout: number;
        profit: number;
        estimate: number;
        settled: number;
        costKnown: boolean;
      }
    >();
    for (const item of items) {
      const key = item.sku || 'UNKNOWN';
      const bucket = map.get(key) ?? {
        sku: key,
        orders: 0,
        gross: 0,
        payout: 0,
        profit: 0,
        estimate: 0,
        settled: 0,
        costKnown: false,
      };
      bucket.orders += 1;
      bucket.gross += item.grossSale;
      if (item.settled) {
        bucket.settled += 1;
        bucket.payout += item.actualPayout;
        if (item.costKnown) bucket.profit += item.netProfit;
      } else if (item.costKnown) {
        const group = statusGroup(item.status);
        if (group === 'Delivered' || group === 'In transit') {
          bucket.estimate += item.grossSale - item.totalFees - item.cogs - item.packaging;
        }
      }
      bucket.costKnown = bucket.costKnown || item.costKnown;
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => b.gross - a.gross).slice(0, 8);
  })();

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Order items"
          value={formatNumber(items.length)}
          subValue={`${formatNumber(derived.units)} units`}
          icon={ShoppingBag}
          theme="sky"
        />
        <MetricCard
          title="Gross order value"
          value={formatINR(totals.grossSale)}
          subValue="Supplier price incl. GST"
          icon={IndianRupee}
          theme="leaf"
        />
        <MetricCard
          title="Marketplace fees"
          value={formatINR(totals.totalFees)}
          subValue={derived.fees.length > 0 ? 'From payment file' : 'No payment file yet'}
          icon={Receipt}
          theme="sun"
        />
        <MetricCard
          title="Net profit"
          value={profitValue}
          subValue={profitHint}
          icon={TrendingUp}
          theme="coral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status mix */}
        <div className="lg:col-span-2 bg-surface-elevated rounded-card border border-outline shadow-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold font-display text-ink">Order status mix</h3>
              <p className="text-[11px] text-ink-muted">
                {formatNumber(derived.pendingItems.length)} of {formatNumber(items.length)} items still awaiting
                settlement
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenOrders}
              className="flex items-center gap-1 text-[11px] font-bold text-sky hover:text-sky-deep"
            >
              View orders <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {derived.statusBreakdown.map((entry) => (
              <div key={entry.group}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-ink">{entry.group}</span>
                  <span className="text-ink-muted font-mono">
                    {formatNumber(entry.orders)} {entry.orders === 1 ? 'order' : 'orders'} · {formatINR(entry.value)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STATUS_STYLE[entry.group]}`}
                    style={{ width: `${Math.max(2, (entry.value / maxStatusValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attention list */}
        <div className="bg-surface-elevated rounded-card border border-outline shadow-soft p-5">
          <h3 className="text-sm font-bold font-display text-ink mb-3">Needs attention</h3>
          <ul className="space-y-2.5">
            <AttentionRow
              icon={PackageSearch}
              tone="sky"
              label="Missing cost price"
              hint={
                totals.incompleteCostItems > 0
                  ? `${formatNumber(totals.incompleteCostItems)} SKUs without COGS`
                  : 'All visible SKUs costed'
              }
              action={totals.incompleteCostItems > 0 ? 'Configure' : undefined}
              onAction={onOpenSkuManager}
            />
            <AttentionRow
              icon={RotateCcw}
              tone="coral"
              label="RTO / cancelled"
              hint={`${formatNumber(derived.rtoItems.length)} RTO · ${formatNumber(
                derived.statusBreakdown.find((entry) => entry.group === 'Cancelled')?.orders ?? 0,
              )} cancelled`}
            />
            <AttentionRow
              icon={CircleDollarSign}
              tone="sun"
              label="Returns logged"
              hint={`${formatNumber(derived.returnItems.length)} sub-orders in returns files`}
            />
            <AttentionRow
              icon={Megaphone}
              tone="sun"
              label="Ads spend"
              hint={derived.adsSpend > 0 ? formatINR(derived.adsSpend) : 'No ads sheet rows'}
            />
            <AttentionRow
              icon={AlertTriangle}
              tone={unmatchedPayments.length > 0 ? 'coral' : 'leaf'}
              label="Unmatched payment lines"
              hint={
                unmatchedPayments.length > 0
                  ? `${formatNumber(unmatchedPayments.length)} lines · ${formatINR(derived.unmatchedValue)}`
                  : 'Everything matched to an order'
              }
            />
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fee breakdown */}
        <div className="bg-surface-elevated rounded-card border border-outline shadow-soft p-5">
          <h3 className="text-sm font-bold font-display text-ink mb-1">Fee breakdown</h3>
          <p className="text-[11px] text-ink-muted mb-4">
            {derived.fees.length > 0 ? 'Across settled sub-orders' : 'Upload the payment file to populate this'}
          </p>

          {derived.fees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-strong bg-surface-sunken/40 p-4 text-center">
              <Receipt className="w-6 h-6 mx-auto text-ink-muted/60 mb-1.5" />
              <p className="text-[11px] text-ink-muted">
                No fees yet. Meesho's payment file splits commission, shipping, TCS and TDS per sub-order.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {derived.fees.map((entry) => (
                <div key={entry.code}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-ink">{FEE_LABELS[entry.code]}</span>
                    <span className="font-mono font-bold text-ink">{formatINR(entry.amount, true)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                    <div
                      className="h-full rounded-full bg-coral"
                      style={{ width: `${Math.max(2, (entry.amount / maxFee) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top SKUs */}
        <div className="lg:col-span-2 bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
          <div className="p-4 border-b border-outline flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-display text-ink">Top SKUs</h3>
              <p className="text-[11px] text-ink-muted">{files.length} file(s) loaded</p>
            </div>
            <button
              type="button"
              onClick={onOpenSkuManager}
              className="text-[11px] font-bold text-sky hover:text-sky-deep"
            >
              SKU costs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline bg-surface-sunken/60 text-ink-muted font-bold">
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4 text-right">Orders</th>
                  <th className="py-2.5 px-4 text-right">Gross</th>
                  <th className="py-2.5 px-4 text-right">Payout</th>
                  <th className="py-2.5 px-4 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {skuRows.map((row) => {
                  const margin = row.gross > 0 ? (row.profit / row.gross) * 100 : 0;
                  return (
                    <tr key={row.sku} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-ink">{row.sku}</td>
                      <td className="py-2.5 px-4 text-right text-ink-muted">{formatNumber(row.orders)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-ink">{formatINR(row.gross)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-ink-muted">
                        {row.settled > 0 ? formatINR(row.payout) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {row.settled > 0 && row.costKnown ? (
                          <span className={`font-mono font-bold ${row.profit >= 0 ? 'text-leaf-deep' : 'text-coral'}`}>
                            {formatINR(row.profit)}
                            <span className="text-[10px] text-ink-muted font-normal ml-1">{formatPercent(margin)}</span>
                          </span>
                        ) : row.estimate !== 0 ? (
                          <span className="font-mono font-bold text-ink-muted" title="Estimated until payments arrive">
                            ~{formatINR(row.estimate)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-muted">{row.costKnown ? 'unsettled' : 'set cost'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AttentionRowProps {
  icon: React.ElementType;
  tone: 'sky' | 'leaf' | 'sun' | 'coral';
  label: string;
  hint: string;
  action?: string;
  onAction?: () => void;
}

const TONE_STYLE: Record<AttentionRowProps['tone'], string> = {
  sky: 'bg-sky-soft text-sky-deep',
  leaf: 'bg-leaf-soft text-leaf-deep',
  sun: 'bg-sun-soft text-sun-deep',
  coral: 'bg-coral-soft text-coral',
};

const AttentionRow: React.FC<AttentionRowProps> = ({ icon: Icon, tone, label, hint, action, onAction }) => (
  <li className="flex items-center gap-2.5">
    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TONE_STYLE[tone]}`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-bold text-ink leading-tight">{label}</p>
      <p className="text-[10px] text-ink-muted truncate">{hint}</p>
    </div>
    {action && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="text-[10px] font-bold text-sky hover:text-sky-deep shrink-0"
      >
        {action}
      </button>
    )}
  </li>
);
