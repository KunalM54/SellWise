import React from 'react';
import { Marketplace } from '../types';
import { 
  Store, 
  Calendar, 
  RotateCw, 
  Sparkles,
  ChevronDown 
} from 'lucide-react';

interface HeaderProps {
  currentMarketplace: Marketplace;
  onSelectMarketplace: (m: Marketplace) => void;
  dateRange: string;
  onSelectDateRange: (range: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalOrders: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentMarketplace,
  onSelectMarketplace,
  dateRange,
  onSelectDateRange,
  onRefresh,
  isRefreshing,
  totalOrders,
}) => {
  return (
    <header className="bg-surface-elevated border-b border-outline sticky top-0 z-30 shadow-soft">
      <div className="px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Channel Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Channels', icon: Sparkles },
            { id: 'meesho', label: 'Meesho', color: '#E0267C' },
            { id: 'flipkart', label: 'Flipkart', color: '#2874F0' },
            { id: 'amazon', label: 'Amazon India', color: '#FF9900' },
          ].map((ch) => {
            const active = currentMarketplace === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectMarketplace(ch.id as Marketplace)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  active
                    ? 'bg-sky-soft text-sky-deep border-sky/30 shadow-soft'
                    : 'bg-surface text-ink-muted border-outline hover:border-outline-strong hover:text-ink'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ch.color || '#3B82F6' }}
                />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tools (Account, Date, Sync) */}
        <div className="flex flex-wrap items-center gap-3">
          
          {totalOrders > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-surface-sunken text-ink-muted text-xs font-mono font-medium border border-outline">
              {totalOrders} orders loaded
            </span>
          )}
          
          {/* Account Selector */}
          <div className="flex items-center gap-2 bg-surface border border-outline rounded-xl px-3 py-1.5 text-xs text-ink font-semibold">
            <Store className="w-3.5 h-3.5 text-sky" />
            <span>Fashion Hub (GST: 07AABCU9603)</span>
            <ChevronDown className="w-3 h-3 text-ink-muted ml-0.5" />
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-surface-sunken p-0.5 rounded-xl border border-outline">
            <div className="px-2 text-ink-muted">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            {(['7D', '30D', 'This Month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => onSelectDateRange(r)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  dateRange === r
                    ? 'bg-surface-elevated text-sky-deep shadow-soft border border-outline'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Sync Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-sky text-white px-3.5 py-1.5 rounded-button text-xs font-bold shadow-soft hover:bg-sky-deep transition-all active:scale-95 disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

      </div>
    </header>
  );
};
