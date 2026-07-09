import { describe, it, expect } from 'vitest';
import {
  TIMEZONE_OPTIONS,
  DEFAULT_TIMEZONE,
  timezoneLabel,
  formatDateTimeInTimezone,
} from '@/lib/constants/timezone';

describe('timezoneLabel', () => {
  it('maps known option values to their display label', () => {
    expect(timezoneLabel('UTC')).toBe('UTC+0');
    expect(timezoneLabel('Etc/GMT-8')).toBe('UTC+8');
  });
  it('returns the raw value for unknown zones', () => {
    expect(timezoneLabel('Mars/Phobos')).toBe('Mars/Phobos');
  });
  it('returns empty string for nullish input', () => {
    expect(timezoneLabel(null)).toBe('');
    expect(timezoneLabel(undefined)).toBe('');
  });
  it('every option value resolves back to its own label', () => {
    for (const o of TIMEZONE_OPTIONS) {
      expect(timezoneLabel(o.value)).toBe(o.label);
    }
  });
});

describe('formatDateTimeInTimezone', () => {
  const instant = new Date('2026-06-30T12:00:00Z');

  it('renders the wall-clock time in the requested zone', () => {
    expect(formatDateTimeInTimezone(instant, 'UTC')).toBe('2026-06-30 12:00:00');
    // Etc/GMT-8 is UTC+8 → +8h
    expect(formatDateTimeInTimezone(instant, 'Etc/GMT-8')).toBe('2026-06-30 20:00:00');
    // Etc/GMT+5 is UTC-5 → -5h
    expect(formatDateTimeInTimezone(instant, 'Etc/GMT+5')).toBe('2026-06-30 07:00:00');
  });

  it('crosses the date boundary correctly', () => {
    // 23:00Z + 8h = 07:00 next day
    expect(formatDateTimeInTimezone(new Date('2026-06-30T23:00:00Z'), 'Etc/GMT-8')).toBe('2026-07-01 07:00:00');
  });

  it('accepts ISO strings', () => {
    expect(formatDateTimeInTimezone('2026-06-30T12:00:00Z', 'UTC')).toBe('2026-06-30 12:00:00');
  });

  it('defaults to DEFAULT_TIMEZONE when no zone given', () => {
    expect(formatDateTimeInTimezone(instant)).toBe(formatDateTimeInTimezone(instant, DEFAULT_TIMEZONE));
  });

  it('returns an em-dash for missing or invalid dates', () => {
    expect(formatDateTimeInTimezone(null)).toBe('—');
    expect(formatDateTimeInTimezone(undefined)).toBe('—');
    expect(formatDateTimeInTimezone('not-a-date')).toBe('—');
  });

  it('falls back to a UTC string for an invalid timezone', () => {
    expect(formatDateTimeInTimezone(instant, 'Not/AZone')).toBe('2026-06-30 12:00:00 UTC');
  });
});
