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
