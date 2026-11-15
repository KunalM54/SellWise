import React, { useState, useRef, useEffect } from 'react';
import { Marketplace } from '../types';
import { ChevronDown, Check, Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  currentMarketplace: Marketplace;
  onSelectMarketplace: (m: Marketplace) => void;
  totalOrders?: number;
}

const CHANNELS: { id: Marketplace; label: string; color: string; icon?: typeof Sparkles }[] = [
  { id: 'all', label: 'All Channels', color: '#6366F1', icon: Sparkles },
  { id: 'meesho', label: 'Meesho', color: '#E0267C' },
  { id: 'flipkart', label: 'Flipkart', color: '#2874F0' },
  { id: 'amazon', label: 'Amazon India', color: '#FF9900' },
];

export const Header: React.FC<HeaderProps> = ({
  title,
  currentMarketplace,
  onSelectMarketplace,
  totalOrders = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedChannel = CHANNELS.find((c) => c.id === currentMarketplace) || CHANNELS[0];

  return (
    <header className="bg-surface-elevated border-b border-outline sticky top-0 z-30 shadow-soft">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        
        {/* Left Side: Page Title Only */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display text-ink tracking-tight">
            {title}
          </h1>
          {totalOrders > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-surface-sunken text-ink-muted text-xs font-mono font-medium border border-outline">
              {totalOrders} orders
            </span>
          )}
        </div>

        {/* Right Side: Channel Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="flex items-center gap-2.5 bg-surface hover:bg-surface-sunken border border-outline hover:border-outline-strong px-3.5 py-2 rounded-xl text-xs font-semibold text-ink transition-all shadow-xs"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedChannel.color }}
            />
            <span className="font-semibold text-ink">{selectedChannel.label}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-ink-muted ml-0.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-surface-elevated border border-outline rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Filter by Channel
              </div>
              {CHANNELS.map((ch) => {
                const isSelected = currentMarketplace === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      onSelectMarketplace(ch.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-sky-soft text-sky-deep font-bold'
                        : 'text-ink hover:bg-surface-sunken font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ch.color }}
                      />
                      <span>{ch.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-deep" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

