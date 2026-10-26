import { describe, it, expect } from 'vitest';
import { timezoneOffsetMinutes, timezoneDisplay } from './timezone';

// Mid-January and mid-July: northern-hemisphere zones are on opposite sides of their DST switch.
const WINTER = new Date('2026-01-15T12:00:00Z');
const SUMMER = new Date('2026-07-15T12:00:00Z');

describe('timezoneOffsetMinutes', () => {
  it('reads the Etc/GMT ids with their inverted POSIX sign, not the sign in the name', () => {
    expect(timezoneOffsetMinutes('Etc/GMT+8', WINTER)).toBe(-480);
    expect(timezoneOffsetMinutes('Etc/GMT-8', WINTER)).toBe(480);
  });

  it('tracks daylight saving rather than returning one fixed offset per zone', () => {
    expect(timezoneOffsetMinutes('America/Los_Angeles', WINTER)).toBe(-480);
    expect(timezoneOffsetMinutes('America/Los_Angeles', SUMMER)).toBe(-420);
  });

  it('matches a fixed-offset id against the real zone on the same clock', () => {
    expect(timezoneOffsetMinutes('Etc/GMT+8', WINTER)).toBe(timezoneOffsetMinutes('America/Los_Angeles', WINTER));
    expect(timezoneOffsetMinutes('Etc/GMT+8', SUMMER)).not.toBe(timezoneOffsetMinutes('America/Los_Angeles', SUMMER));
  });

  it('returns null for an unusable zone instead of throwing', () => {
    expect(timezoneOffsetMinutes('Not/AZone', WINTER)).toBeNull();
  });
});

describe('timezoneDisplay', () => {
  it("uses the picker's own wording for the fixed-offset ids it offers", () => {
    expect(timezoneDisplay('Etc/GMT+8', WINTER)).toBe('UTC-8');
    expect(timezoneDisplay('Etc/GMT-8', WINTER)).toBe('UTC+8');
  });

  it('appends the offset a real zone is actually on', () => {
    expect(timezoneDisplay('America/Los_Angeles', WINTER)).toBe('America/Los_Angeles (UTC-8)');
    expect(timezoneDisplay('America/Los_Angeles', SUMMER)).toBe('America/Los_Angeles (UTC-7)');
  });

  it('falls back to the raw value when the zone cannot be resolved', () => {
    expect(timezoneDisplay('Not/AZone', WINTER)).toBe('Not/AZone');
  });
});
