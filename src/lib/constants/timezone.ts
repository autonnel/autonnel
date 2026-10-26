type TimezoneOption = {
  value: string;
  label: string;
};

const fixedUtcOffsets = [
  ['Etc/GMT+10', 'UTC-10'],
  ['Etc/GMT+8', 'UTC-8'],
  ['Etc/GMT+7', 'UTC-7'],
  ['Etc/GMT+6', 'UTC-6'],
  ['Etc/GMT+5', 'UTC-5'],
  ['Etc/GMT+4', 'UTC-4'],
  ['Etc/GMT+3', 'UTC-3'],
  ['UTC', 'UTC+0'],
  ['Etc/GMT-1', 'UTC+1'],
  ['Etc/GMT-2', 'UTC+2'],
  ['Etc/GMT-3', 'UTC+3'],
  ['Etc/GMT-5', 'UTC+5'],
  ['Etc/GMT-8', 'UTC+8'],
  ['Etc/GMT-9', 'UTC+9'],
  ['Etc/GMT-10', 'UTC+10'],
] as const;

export const TIMEZONE_OPTIONS: TimezoneOption[] = fixedUtcOffsets.map(([value, label]) => ({ value, label }));

export const DEFAULT_TIMEZONE = 'Etc/GMT-8';

export function timezoneLabel(value: string | null | undefined): string {
  if (!value) return '';
  return TIMEZONE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// Minutes east of UTC for `timeZone` at the given instant. Needed because the Etc/GMT ids carry
// an INVERTED sign by POSIX convention (Etc/GMT+8 is UTC-8), so comparing zone ids as strings both
// misreads them and calls two zones different when they are the same clock.
export function timezoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    // The formatted parts carry no milliseconds, so drop them from the reference instant too.
    return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
}

// Operator-facing name for a zone. The picker's own wording wins for the fixed-offset ids it
// offers; a real IANA zone keeps its name and gains the offset it is actually on, because
// "America/Los_Angeles" alone does not tell an operator whether it is UTC-7 or UTC-8 today.
export function timezoneDisplay(value: string, at: Date = new Date()): string {
  const known = TIMEZONE_OPTIONS.find((o) => o.value === value);
  if (known) return known.label;
  const offset = timezoneOffsetMinutes(value, at);
  return offset == null ? value : `${value} (${offsetLabel(offset)})`;
}

// Absolute "YYYY-MM-DD HH:MM:SS" rendered in the given IANA/Etc timezone. Used wherever an admin-facing
// timestamp must follow the site-wide default timezone instead of UTC.
export function formatDateTimeInTimezone(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .format(d)
      .replace(',', '');
  } catch {
    return `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  }
}
