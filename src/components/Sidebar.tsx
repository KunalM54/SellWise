import React, { useState } from 'react';
import { Logo } from './Logo';
import { LayoutDashboard, Table2, Package } from 'lucide-react';

export type TabType = 'dashboard' | 'orders' | 'sku-manager';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isCollapsed: boolean;
}

const NAV_ITEMS: Array<{ id: TabType; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Profit Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Order Ledger', icon: Table2 },
  { id: 'sku-manager', label: 'SKU Costs', icon: Package },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, isCollapsed }) => {
  const [isHovered, setIsHovered] = useState(false);

  // When collapsed: hovering opens it, cursor leaving closes it.
  // When not collapsed (manually opened via navbar): it stays permanently open.
  const isVisuallyOpen = !isCollapsed || isHovered;

  const handleMouseEnter = () => {
    if (isCollapsed) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isCollapsed) setIsHovered(false);
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`bg-[#1D4ED8] border-r border-blue-600/50 flex flex-col h-screen sticky top-0 z-40 select-none transition-[width] duration-300 ease-in-out text-white shrink-0 ${
        isVisuallyOpen ? 'w-64 shadow-lg' : 'w-16 shadow-sm'
      }`}
    >
      {/* Top Brand Header */}
      <div
        className={`h-16 border-b border-white/15 flex items-center transition-all ${
          isVisuallyOpen ? 'px-4 justify-start gap-3' : 'px-0 justify-center'
        }`}
      >
        <div className="p-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 shrink-0">
          <Logo size={28} />
        </div>
        {isVisuallyOpen && (
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-xl font-bold font-display text-white tracking-tight leading-none truncate">
              SellWise
            </h1>
            <span className="text-[10px] text-blue-200 font-medium mt-0.5 truncate">Meesho Profit Ledger</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="p-2 space-y-1 flex-1 overflow-y-auto">
        {isVisuallyOpen && (
          <div className="px-3 py-2 text-[10px] font-bold text-blue-200/80 uppercase tracking-wider">
            Main Navigation
          </div>
        )}

        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={!isVisuallyOpen ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 relative ${
                isVisuallyOpen ? 'px-3.5 py-2.5 justify-between' : 'p-3 justify-center'
              } ${
                active
                  ? 'bg-white text-blue-700 shadow-md shadow-blue-900/30 font-bold'
                  : 'text-blue-100 hover:text-white hover:bg-white/15'
              }`}
            >
              <div className={`flex items-center ${isVisuallyOpen ? 'gap-3' : 'justify-center'}`}>
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'stroke-[2.5] text-blue-700' : 'stroke-[2.2] text-blue-200'
                  }`}
                />
                {isVisuallyOpen && <span className="truncate">{item.label}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {isVisuallyOpen && (
        <div className="p-3 border-t border-white/15">
          <p className="text-[10px] text-blue-200/70 leading-relaxed">
            Meesho only for now. Flipkart and Amazon can be added as their own parsers.
          </p>
        </div>
      )}
    </aside>
  );
};
