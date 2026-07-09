export function countText(value: number): string {
  return value.toLocaleString();
}

export function moneyText(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function percentText(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

export function signedPercentText(value: number | null): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export type DeltaTone = 'ok' | 'bad' | 'muted';

export function deltaDirection(value: number | null): 'up' | 'down' {
  return value != null && value < 0 ? 'down' : 'up';
}

// Higher is better for visitors/orders/revenue/cvr — positive change is good.
export function deltaTone(value: number | null): DeltaTone {
  if (value == null || value === 0) return 'muted';
  return value > 0 ? 'ok' : 'bad';
}
