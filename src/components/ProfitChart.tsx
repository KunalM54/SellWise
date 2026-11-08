import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { OrderItem } from '../types';
import { UploadCloud } from 'lucide-react';

interface ProfitChartProps {
  orders: OrderItem[];
  onImportClick: () => void;
}

export const ProfitChart: React.FC<ProfitChartProps> = ({ orders, onImportClick }) => {
  // Compute daily trend data from real imported orders
  const dailyData = useMemo(() => {
    if (orders.length === 0) return [];

    const grouped: { [date: string]: { date: string; revenue: number; profit: number; fees: number; rtoLoss: number } } = {};

    orders.forEach((o) => {
      const d = o.orderDate || 'Today';
      if (!grouped[d]) {
        grouped[d] = { date: d, revenue: 0, profit: 0, fees: 0, rtoLoss: 0 };
      }
      grouped[d].revenue += o.salePrice;
      const netProfit = o.actualPayout - o.productCost - o.packagingCost;
      grouped[d].profit += netProfit;
      grouped[d].fees += (o.marketplaceCommission + o.shippingFee + o.taxesAndGst);
      if (o.status === 'RTO' || o.status === 'Customer Return') {
        grouped[d].rtoLoss += (o.reverseShippingFee + o.shippingFee + o.packagingCost);
      }
    });

    return Object.values(grouped).slice(0, 14);
  }, [orders]);

  // Compute channel share dynamically
  const channelShare = useMemo(() => {
    if (orders.length === 0) return [];

    const channels: { [ch: string]: { profit: number; revenue: number } } = {};

    orders.forEach((o) => {
      const ch = o.marketplace;
      if (!channels[ch]) {
        channels[ch] = { profit: 0, revenue: 0 };
      }
      channels[ch].revenue += o.salePrice;
      channels[ch].profit += (o.actualPayout - o.productCost - o.packagingCost);
    });

    return Object.entries(channels).map(([name, data]) => {
      const margin = data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0;
      return {
        name: name === 'meesho' ? 'Meesho' : name === 'flipkart' ? 'Flipkart' : 'Amazon India',
        profit: data.profit,
        margin: `${margin}%`,
      };
    });
  }, [orders]);

  if (orders.length === 0) {
    return (
      <div className="bg-surface-elevated rounded-card p-8 border border-outline shadow-soft text-center flex flex-col items-center justify-center min-h-[260px] gap-3">
        <div className="w-14 h-14 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center">
          <UploadCloud className="w-7 h-7 stroke-[2.2]" />
        </div>
        <h3 className="text-base font-bold font-display text-ink">No Order Records to Graph Yet</h3>
        <p className="text-xs text-ink-muted max-w-sm">
          Import your Meesho, Flipkart, or Amazon settlement files to see real-time P&L graphs, fee breakdowns, and daily curves.
        </p>
        <button
          onClick={onImportClick}
          className="mt-2 px-5 py-2.5 rounded-button bg-sky text-white text-xs font-bold shadow-soft hover:bg-sky-deep transition-all"
        >
          Import Your First Report
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Main Trend: Revenue vs Real Net Profit */}
      <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft lg:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-lg font-bold font-display text-ink">Gross Sales vs. Real Net Profit</h3>
            <p className="text-xs text-ink-muted">Comparing top-line sales with actual money left in hand</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-sky">
              <span className="w-3 h-3 rounded-full bg-sky" /> Gross Sales
            </span>
            <span className="flex items-center gap-1.5 text-leaf-deep">
              <span className="w-3 h-3 rounded-full bg-leaf" /> Net Profit
            </span>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px'
                }}
                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="profit" stroke="#22C55E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fee & RTO Deduction Breakdown */}
      <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold font-display text-ink">Marketplace Deductions</h3>
          <p className="text-xs text-ink-muted mb-4">Where your sales money goes before payout</p>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                  formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="fees" name="Platform Fees" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rtoLoss" name="RTO Charges" fill="#F87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Summary Pill List */}
        <div className="mt-4 pt-3 border-t border-outline flex flex-col gap-2">
          {channelShare.map((c) => (
            <div key={c.name} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-xl bg-surface-sunken">
              <span className="font-bold text-ink">{c.name}</span>
              <span className="font-mono text-ink-muted">
                Profit: <strong className="text-leaf-deep font-bold">₹{c.profit.toLocaleString('en-IN')}</strong> ({c.margin})
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
