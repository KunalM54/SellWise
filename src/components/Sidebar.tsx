import React from 'react';
import { Logo } from './Logo';
import {
  BarChart3,
  UploadCloud,
  FileCheck2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export type TabType = 'overview' | 'import' | 'reconciliation' | 'skus' | 'claims';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  ordersCount: number;
  discrepanciesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  ordersCount,
  discrepanciesCount,
}) => {
  const navItems = [
    {
      id: 'overview' as TabType,
      label: 'Overview & P&L',
      icon: BarChart3,
    },
    {
      id: 'import' as TabType,
      label: 'Import Reports',
      icon: UploadCloud,
    },
    {
      id: 'reconciliation' as TabType,
      label: 'Reconciliation Ledger',
      icon: FileCheck2,
      badge: discrepanciesCount > 0 ? `${discrepanciesCount} alerts` : undefined,
      badgeType: 'coral',
    },
    {
      id: 'skus' as TabType,
      label: 'SKU Profit Matrix',
      icon: Sparkles,
    },
    {
      id: 'claims' as TabType,
      label: 'Dispute & Claims',
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="w-64 bg-surface-elevated border-r border-outline flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40 select-none">
      
      {/* Top Brand Section */}
      <div>
        <div className="p-5 border-b border-outline flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold font-display text-ink tracking-tight">SellWise</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-sky-soft text-sky-deep border border-sky/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">Reconciliation Engine</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Main Navigation
          </div>

          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                  active
                    ? 'bg-sky text-white shadow-soft shadow-sky-glow/40'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-sunken'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-white text-coral'
                        : 'bg-coral-soft text-coral border border-coral/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Privacy & System Status Widget */}
      <div className="p-4 border-t border-outline">
        <div className="p-3.5 rounded-2xl bg-surface-sunken border border-outline flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-leaf animate-pulse shrink-0" />
            <span className="text-xs font-bold text-ink">Offline Mode Active</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Data is stored and processed locally on your PC. No third-party cloud uploads.
          </p>
          <div className="pt-2 border-t border-outline/60 flex items-center justify-between text-[10px] text-ink-muted font-mono">
            <span>Orders: {ordersCount}</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>

    </aside>
  );
};
