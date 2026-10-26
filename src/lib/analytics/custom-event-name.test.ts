import { describe, it, expect } from 'vitest';
import {
  CUSTOM_KIND_PREFIX,
  customEventNameOf,
  isCustomKind,
  isValidCustomEventName,
  toCustomKind,
} from './custom-event-name';

describe('isValidCustomEventName', () => {
  it('accepts a letter-led name with letters, digits, underscores and hyphens', () => {
    expect(isValidCustomEventName('buy_now')).toBe(true);
    expect(isValidCustomEventName('Video-Watched2')).toBe(true);
    expect(isValidCustomEventName('a')).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(isValidCustomEventName('')).toBe(false);
  });

  it('rejects a name that does not start with a letter', () => {
    expect(isValidCustomEventName('1st_click')).toBe(false);
    expect(isValidCustomEventName('_click')).toBe(false);
  });

  it('rejects characters that would break the kind namespace or a LIKE pattern', () => {
    expect(isValidCustomEventName('buy:now')).toBe(false);
    expect(isValidCustomEventName('buy now')).toBe(false);
    expect(isValidCustomEventName('buy%now')).toBe(false);
    expect(isValidCustomEventName('buy.now')).toBe(false);
  });

  it('accepts exactly 40 characters and rejects 41', () => {
    expect(isValidCustomEventName('a'.repeat(40))).toBe(true);
    expect(isValidCustomEventName('a'.repeat(41))).toBe(false);
  });
});

describe('toCustomKind / isCustomKind', () => {
  it('namespaces a name under the custom prefix', () => {
    expect(toCustomKind('buy_now')).toBe('custom:buy_now');
    expect(CUSTOM_KIND_PREFIX).toBe('custom:');
  });

  it('recognizes only prefixed kinds as custom', () => {
    expect(isCustomKind('custom:buy_now')).toBe(true);
    expect(isCustomKind('payment_success')).toBe(false);
  });
});

describe('customEventNameOf', () => {
  it('returns the bare name for a well-formed custom kind', () => {
    expect(customEventNameOf('custom:buy_now')).toBe('buy_now');
  });

  it('returns null for a built-in kind', () => {
    expect(customEventNameOf('payment_success')).toBeNull();
  });

  it('returns null for a double-prefixed kind, which ingest would never have stored', () => {
    expect(customEventNameOf('custom:custom:x')).toBeNull();
  });

  it('returns null for a prefix with no name', () => {
    expect(customEventNameOf('custom:')).toBeNull();
  });
});
