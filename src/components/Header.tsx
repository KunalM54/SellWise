import React from 'react';
import { PanelLeftOpen, PanelLeftClose, Store } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  totalOrders?: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  totalOrders = 0,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  return (
    <header className="bg-surface-elevated border-b border-outline sticky top-0 z-30 shadow-soft h-16">
      <div className="px-6 h-full flex items-center justify-between gap-4">
        {/* Left Side: Sidebar Toggle & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-sunken border border-transparent hover:border-outline transition-all"
              title={isSidebarCollapsed ? 'Open sidebar (Expand)' : 'Close sidebar (Collapse)'}
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-sky-deep" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display text-ink tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-[11px] text-ink-muted truncate">{subtitle}</p>}
          </div>

          {totalOrders > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-surface-sunken text-ink-muted text-xs font-mono font-medium border border-outline whitespace-nowrap">
              {totalOrders} orders
            </span>
          )}
        </div>

        {/* Right Side: Channel Badge */}
        <div className="flex items-center gap-1.5 bg-sky-soft text-sky-deep border border-sky/30 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
          <Store className="w-3.5 h-3.5" />
          <span>Meesho</span>
        </div>
      </div>
    </header>
  );
};
