import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Inbox,
} from 'lucide-react';
import { FeeCode, LedgerItem } from '../types/ledger';
import { formatDate, formatINR, formatNumber } from '../utils/format';
import { FEE_LABELS } from '../utils/feeLabels';

interface LedgerOrdersTableProps {
  items: LedgerItem[];
}

type StatusFilter = 'ALL' | 'Delivered' | 'In transit' | 'Pending dispatch' | 'RTO' | 'Cancelled' | 'Other';

const FILTERS: StatusFilter[] = ['ALL', 'Delivered', 'In transit', 'Pending dispatch', 'RTO', 'Cancelled', 'Other'];

type SortKey = 'date' | 'gross' | 'payout' | 'profit';

function statusGroup(status: string): StatusFilter {
  const value = (status || '').toUpperCase();
  if (value.includes('DELIVERED')) return 'Delivered';
  if (value.includes('RTO')) return 'RTO';
  if (value.includes('CANCEL')) return 'Cancelled';
  if (value.includes('SHIPPED') || value.includes('TRANSIT') || value.includes('OFD')) return 'In transit';
  if (value.includes('READY') || value.includes('PENDING') || value.includes('HOLD')) return 'Pending dispatch';
  return 'Other';
}

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: 'Delivered',
  SHIPPED: 'Shipped',
  READY_TO_SHIP: 'Ready to ship',
  PENDING: 'Pending',
  HOLD: 'On hold',
  CANCELLED: 'Cancelled',
  RTO_INITIATED: 'RTO initiated',
  RTO_LOCKED: 'RTO locked',
  RTO_OFD: 'RTO out for delivery',
  RTO_COMPLETE: 'RTO complete',
};

function displayStatus(status: string): string {
  if (!status) return '—';
  const known = STATUS_LABELS[status.toUpperCase()];
  if (known) return known;
  return status
    .toLowerCase()
    .split('_')
    .map((word) => (word === 'rto' ? 'RTO' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

const STATUS_PILL: Record<string, string> = {
  Delivered: 'bg-leaf-soft text-leaf-deep border-leaf/30',
  'In transit': 'bg-sky-soft text-sky-deep border-sky/30',
  'Pending dispatch': 'bg-sun-soft text-sun-deep border-sun/30',
  RTO: 'bg-coral-soft text-coral border-coral/30',
  Cancelled: 'bg-surface-sunken text-ink-muted border-outline',
  Other: 'bg-surface-sunken text-ink-muted border-outline',
};

const PAGE_SIZE = 25;

function productName(item: LedgerItem): string {
  for (const event of item.events) {
    const name = event.rawRow['Product Name'];
    if (name) return name;
  }
  return '';
}

export const LedgerOrdersTable: React.FC<LedgerOrdersTableProps> = ({ items }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [returnsOnly, setReturnsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = items.filter((item) => {
      if (status !== 'ALL' && statusGroup(item.status) !== status) return false;
      if (returnsOnly && !item.events.some((event) => event.eventType === 'return')) return false;
      if (!query) return true;
      return (
        item.sku.toLowerCase().includes(query) ||
        item.subOrderId.toLowerCase().includes(query) ||
        item.orderId.toLowerCase().includes(query) ||
        productName(item).toLowerCase().includes(query)
      );
    });

    const direction = sortDesc ? -1 : 1;
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'gross':
          return (a.grossSale - b.grossSale) * direction;
        case 'payout':
          return (a.actualPayout - b.actualPayout) * direction;
        case 'profit':
          return (a.netProfit - b.netProfit) * direction;
        case 'date':
        default:
          return a.saleDate.localeCompare(b.saleDate) * direction;
      }
    });

    return rows;
  }, [items, search, status, returnsOnly, sortKey, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((value) => !value);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const handleExport = () => {
    const header = [
      'Sub Order No',
      'Order Date',
      'SKU',
      'Status',
      'Qty',
      'Gross Sale',
      'Fees',
      'Payout',
      'Profit',
      'Settled',
    ];
    const rows = filtered.map((item) => [
      item.subOrderId,
      item.saleDate,
      item.sku,
      item.status,
      String(item.qty),
      item.grossSale.toFixed(2),
      item.totalFees.toFixed(2),
      item.settled ? item.actualPayout.toFixed(2) : '',
      item.settled && item.costKnown ? item.netProfit.toFixed(2) : '',
      item.settled ? 'yes' : 'no',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sellwise-meesho-orders.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader: React.FC<{ label: string; sort?: SortKey; align?: 'left' | 'right' }> = ({
    label,
    sort,
    align = 'left',
  }) => (
    <th className={`py-2.5 px-3 ${align === 'right' ? 'text-right' : 'text-left'} font-bold whitespace-nowrap`}>
      {sort ? (
        <button
          type="button"
          onClick={() => toggleSort(sort)}
          className={`inline-flex items-center gap-1 hover:text-ink ${
            sortKey === sort ? 'text-ink' : ''
          } ${align === 'right' ? 'justify-end' : ''}`}
        >
          {label}
          {sortKey === sort ? (
            sortDesc ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )
          ) : null}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
      <div className="p-4 border-b border-outline space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold font-display text-ink">Order ledger</h2>
            <p className="text-[11px] text-ink-muted">
              {formatNumber(filtered.length)} of {formatNumber(items.length)} sub-orders
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 text-[11px] font-bold text-ink bg-surface border border-outline hover:border-outline-strong px-3 py-1.5 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search sub-order, SKU or product…"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
          >
            {FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === 'ALL' ? 'All statuses' : filter}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setReturnsOnly((value) => !value);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              returnsOnly
                ? 'bg-coral-soft text-coral border-coral/40'
                : 'bg-surface-sunken text-ink-muted border-outline hover:border-outline-strong'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Returns only
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-outline bg-surface-sunken/60 text-ink-muted">
              <SortHeader label="Order date" sort="date" />
              <SortHeader label="Sub-order" />
              <SortHeader label="SKU" />
              <SortHeader label="Status" />
              <SortHeader label="Qty" align="right" />
              <SortHeader label="Gross" sort="gross" align="right" />
              <SortHeader label="Fees" align="right" />
              <SortHeader label="Payout" sort="payout" align="right" />
              <SortHeader label="Profit" sort="profit" align="right" />
              <th className="py-2.5 px-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-14 text-center text-ink-muted">
                  <Inbox className="w-8 h-8 mx-auto text-ink-muted/50 mb-2" />
                  <p className="font-bold">No orders match these filters</p>
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const group = statusGroup(item.status);
                const hasReturn = item.events.some((event) => event.eventType === 'return');
                const isExpanded = expanded === item.key;
                return (
                  <React.Fragment key={item.key}>
                    <tr
                      className="hover:bg-surface-sunken/40 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : item.key)}
                    >
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">{formatDate(item.saleDate)}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-ink whitespace-nowrap">
                        {item.subOrderId}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-ink whitespace-nowrap">{item.sku || '—'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                              STATUS_PILL[group]
                            }`}
                          >
                            {displayStatus(item.status) || group}
                          </span>
                          {hasReturn && (
                            <span title="Return / RTO row found in returns file" className="text-coral">
                              <RotateCcw className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-ink">{formatINR(item.grossSale)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-ink-muted">
                        {item.totalFees > 0 ? formatINR(item.totalFees) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-ink">
                        {item.settled ? formatINR(item.actualPayout) : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {item.settled && item.costKnown ? (
                          <span className={item.netProfit >= 0 ? 'text-leaf-deep font-bold' : 'text-coral font-bold'}>
                            {formatINR(item.netProfit)}
                          </span>
                        ) : (
                          <span className="text-ink-muted text-[10px]">
                            {item.costKnown ? 'unsettled' : 'no cost'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-surface-sunken/40">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">
                                Product
                              </p>
                              <p className="text-[11px] text-ink leading-snug">{productName(item) || '—'}</p>
                              <p className="text-[10px] text-ink-muted mt-1 font-mono">
                                Order {item.orderId || '—'} · qty {item.qty}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">
                                Fees
                              </p>
                              {Object.keys(item.fees).length === 0 ? (
                                <p className="text-[11px] text-ink-muted">No settlement lines yet</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {(Object.entries(item.fees) as Array<[FeeCode, number]>).map(([code, amount]) => (
                                    <span
                                      key={code}
                                      className="px-2 py-0.5 rounded-md bg-surface-elevated border border-outline text-[10px] text-ink"
                                    >
                                      {FEE_LABELS[code]} <span className="font-mono font-bold">{formatINR(amount)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">
                                  Settlement
                                </p>
                                <p className="text-[11px] text-ink">
                                  {item.settled
                                    ? `${formatINR(item.actualPayout)} paid · ${item.settlementIds.length} txn id(s)`
                                    : 'Not in any payment file yet'}
                                </p>
                              </div>
                              {item.events
                                .filter((event) => event.eventType === 'return')
                                .slice(0, 2)
                                .map((event) => (
                                  <div key={event.id}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-0.5">
                                      Return
                                    </p>
                                    <p className="text-[11px] text-ink">
                                      {event.rawRow['Type of Return'] || event.rawRow['Status'] || 'Return'}
                                      {event.rawRow['Sub Type'] ? ` · ${event.rawRow['Sub Type']}` : ''}
                                    </p>
                                    {event.rawRow['Detailed Return Reason'] && (
                                      <p className="text-[10px] text-ink-muted">
                                        {event.rawRow['Detailed Return Reason']}
                                      </p>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-outline text-[11px] text-ink-muted">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-outline disabled:opacity-40 hover:bg-surface-sunken"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-outline disabled:opacity-40 hover:bg-surface-sunken"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
