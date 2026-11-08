import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  badge?: string;
  badgeType?: 'leaf' | 'coral' | 'sun' | 'sky';
  icon: LucideIcon;
  theme?: 'default' | 'leaf' | 'coral' | 'sun' | 'sky';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  badge,
  badgeType = 'sky',
  icon: Icon,
  theme = 'default',
}) => {
  const getThemeStyles = () => {
    switch (theme) {
      case 'leaf':
        return {
          cardBg: 'bg-surface-elevated',
          border: 'border-leaf/30 hover:border-leaf',
          iconBg: 'bg-leaf-soft text-leaf-deep',
          accent: 'text-leaf-deep',
        };
      case 'coral':
        return {
          cardBg: 'bg-surface-elevated',
          border: 'border-coral/30 hover:border-coral',
          iconBg: 'bg-coral-soft text-coral',
          accent: 'text-coral',
        };
      case 'sun':
        return {
          cardBg: 'bg-surface-elevated',
          border: 'border-sun/30 hover:border-sun',
          iconBg: 'bg-sun-bright/20 text-sun-deep',
          accent: 'text-sun-deep',
        };
      case 'sky':
        return {
          cardBg: 'bg-surface-elevated',
          border: 'border-sky/30 hover:border-sky',
          iconBg: 'bg-sky-soft text-sky-deep',
          accent: 'text-sky-deep',
        };
      default:
        return {
          cardBg: 'bg-surface-elevated',
          border: 'border-outline hover:border-outline-strong',
          iconBg: 'bg-surface-sunken text-ink-muted',
          accent: 'text-ink',
        };
    }
  };

  const styles = getThemeStyles();

  const getBadgeStyles = () => {
    switch (badgeType) {
      case 'leaf':
        return 'bg-leaf-soft text-leaf-deep border-leaf/20';
      case 'coral':
        return 'bg-coral-soft text-coral border-coral/20';
      case 'sun':
        return 'bg-sun-bright/20 text-sun-deep border-sun/30';
      case 'sky':
      default:
        return 'bg-sky-soft text-sky-deep border-sky/20';
    }
  };

  return (
    <div
      className={`rounded-card p-5 border ${styles.border} ${styles.cardBg} shadow-soft hover:shadow-sky-glow transition-all duration-200 flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">
            {title}
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-ink tracking-tight">
            {value}
          </div>
        </div>
        <div className={`w-12 h-12 rounded-2xl ${styles.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6 stroke-[2.2]" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-outline flex items-center justify-between text-xs">
        {subValue && <span className="text-ink-muted font-medium">{subValue}</span>}
        {badge && (
          <span className={`px-2 py-0.5 rounded-full font-bold border ${getBadgeStyles()}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};
