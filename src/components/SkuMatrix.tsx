import React, { useState } from 'react';
import { SkuMetric } from '../types';
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface SkuMatrixProps {
  skus: SkuMetric[];
}

export const SkuMatrix: React.FC<SkuMatrixProps> = ({ skus }) => {
  const [filterType, setFilterType] = useState<'All' | 'Hero' | 'Laggard'>('All');

  const filteredSkus = skus.filter((item) => {
    if (filterType === 'All') return true;
    return item.type === filterType;
  });

  return (
    <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
      
      {/* Header & Filter */}
      <div className="p-5 border-b border-outline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold font-display text-ink">SKU Profitability Matrix</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sun-bright/20 text-sun-deep border border-sun/30">
              Hero vs. Laggard
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Identify which products generate healthy margins versus those draining money through returns
          </p>
        </div>

        <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-outline">
          {(['All', 'Hero', 'Laggard'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterType === t
                  ? 'bg-surface-elevated text-sky-deep shadow-soft border border-outline'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t} {t === 'Hero' ? '⭐' : t === 'Laggard' ? '⚠️' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of SKU Cards */}
      {filteredSkus.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-sun-bright/20 text-sun-deep flex items-center justify-center">
            <Sparkles className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h4 className="text-sm font-bold text-ink mt-1">No SKU Records Analyzed Yet</h4>
          <p className="text-xs text-ink-muted max-w-sm">
            Import your marketplace sales or settlement spreadsheet to automatically rank your Hero products vs loss-making Laggards.
          </p>
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSkus.map((sku) => {
          const isHero = sku.type === 'Hero';
          const isLaggard = sku.type === 'Laggard';

          return (
            <div
              key={sku.sku}
              className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                isHero
                  ? 'bg-surface-elevated border-sun/40 shadow-soft hover:shadow-sun-glow'
                  : isLaggard
                  ? 'bg-surface-elevated border-coral/40 shadow-soft hover:border-coral'
                  : 'bg-surface-elevated border-outline shadow-soft hover:border-outline-strong'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-ink-muted tracking-tight">
                    {sku.sku}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${
                      isHero
                        ? 'bg-sun-bright/20 text-sun-deep border-sun/30'
                        : isLaggard
                        ? 'bg-coral-soft text-coral border-coral/30'
                        : 'bg-leaf-soft text-leaf-deep border-leaf/30'
                    }`}
                  >
                    {isHero ? <Sparkles className="w-3 h-3" /> : isLaggard ? <AlertTriangle className="w-3 h-3" /> : null}
                    {sku.type}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-ink mt-2 line-clamp-2" title={sku.title}>
                  {sku.title}
                </h4>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-outline text-xs">
                  <div>
                    <span className="text-ink-muted block text-[11px]">Net Profit</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        sku.netProfit < 0 ? 'text-coral' : 'text-leaf-deep'
                      }`}
                    >
                      {sku.netProfit < 0 ? `-₹${Math.abs(sku.netProfit).toLocaleString('en-IN')}` : `₹${sku.netProfit.toLocaleString('en-IN')}`}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">Profit Margin</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        sku.profitMarginPercent < 0 ? 'text-coral' : 'text-leaf-deep'
                      }`}
                    >
                      {sku.profitMarginPercent}%
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">Orders Volume</span>
                    <span className="font-mono font-bold text-ink text-sm">
                      {sku.totalOrders}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">RTO / Return Rate</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        sku.returnRatePercent > 30 ? 'text-coral' : 'text-ink'
                      }`}
                    >
                      {sku.returnRatePercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action / Recommendation Pill */}
              <div className="mt-4 pt-3 border-t border-outline flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-ink-muted">
                  {isHero
                    ? 'Scale ad spend on this item'
                    : isLaggard
                    ? 'Check package weight & return reasons'
                    : 'Stable performer'}
                </span>
                <span className="text-sky font-bold flex items-center gap-0.5">
                  View <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
