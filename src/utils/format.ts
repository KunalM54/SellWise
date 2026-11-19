/** Shared display formatting so every screen shows money the same way. */

export function formatINR(value: number, withDecimals = false): string {
  if (!Number.isFinite(value)) return '₹0';
  const rounded = withDecimals ? Math.round(value * 100) / 100 : Math.round(value);
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  })}`;
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-IN') : '0';
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
