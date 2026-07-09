import { describe, it, expect } from 'vitest';
import {
  resolveSettingsTab,
  SETTINGS_TABS,
  statusBadgeClasses,
  httpStatusTone,
  describeRuntime,
  describeDbProvider,
  maskDbUrl,
  maskApiKey,
  apiKeyExpiryTone,
  formatDuration,
  formatNumber,
} from '@/lib/dashboard/settings-helpers';

const NOW = new Date('2026-04-24T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('resolveSettingsTab', () => {
  it('falls back to branding for unknown values', () => {
    expect(resolveSettingsTab(null)).toBe('branding');
    expect(resolveSettingsTab(undefined)).toBe('branding');
    expect(resolveSettingsTab('')).toBe('branding');
    expect(resolveSettingsTab('mystery')).toBe('branding');
  });
  it('maps known values', () => {
    expect(resolveSettingsTab('branding')).toBe('branding');
    expect(resolveSettingsTab('recall')).toBe('recall');
    expect(resolveSettingsTab('coupons')).toBe('coupons');
    expect(resolveSettingsTab('api-keys')).toBe('api-keys');
    expect(resolveSettingsTab('logs')).toBe('logs');
  });
  it('normalizes synonyms', () => {
    expect(resolveSettingsTab('apikeys')).toBe('api-keys');
    expect(resolveSettingsTab('keys')).toBe('api-keys');
    expect(resolveSettingsTab('LOGS')).toBe('logs');
  });
});

describe('SETTINGS_TABS', () => {
  it('exposes the expected tabs in expected order', () => {
    expect(SETTINGS_TABS.map((t) => t.id)).toEqual([
      'branding',
      'localization',
      'domains',
      'custom-code',
      'storage',
      'llm',
      'integrations',
      'email',
      'email-templates',
      'recall',
      'maintenance',
      'payment',
      'ecommerce',
      'coupons',
      'users',
      'permissions',
      'api-keys',
      'logs',
    ]);
  });
  it('every tab has a label and description', () => {
    for (const tab of SETTINGS_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.description.length).toBeGreaterThan(0);
    }
  });
});

describe('statusBadgeClasses', () => {
  it('returns the right palette per tone', () => {
    expect(statusBadgeClasses('ok')).toContain('ds-okBg');
    expect(statusBadgeClasses('warn')).toContain('ds-warnBg');
    expect(statusBadgeClasses('bad')).toContain('ds-badBg');
    expect(statusBadgeClasses('muted')).toContain('ds-muted');
    expect(statusBadgeClasses('default')).toContain('ds-slate');
  });
});

describe('httpStatusTone', () => {
  it('null/undefined returns muted', () => {
    expect(httpStatusTone(null)).toBe('muted');
    expect(httpStatusTone(undefined)).toBe('muted');
  });
  it('5xx → bad, 4xx → warn, 2xx → ok', () => {
    expect(httpStatusTone(500)).toBe('bad');
    expect(httpStatusTone(503)).toBe('bad');
    expect(httpStatusTone(404)).toBe('warn');
    expect(httpStatusTone(401)).toBe('warn');
    expect(httpStatusTone(200)).toBe('ok');
    expect(httpStatusTone(204)).toBe('ok');
    expect(httpStatusTone(301)).toBe('default');
  });
});

describe('describeRuntime', () => {
  it('returns cloudflare label when isCloudflare=true', () => {
    const r = describeRuntime(true);
    expect(r.runtime).toBe('cloudflare');
    expect(r.runtimeLabel).toContain('Cloudflare');
  });
  it('returns Node label otherwise', () => {
    const r = describeRuntime(false);
    expect(['node', 'unknown']).toContain(r.runtime);
    expect(typeof r.runtimeLabel).toBe('string');
  });
});

describe('describeDbProvider', () => {
  it('classifies common DB urls', () => {
    expect(describeDbProvider('postgresql://user:pass@host/db')).toBe('PostgreSQL');
    expect(describeDbProvider('postgres://x')).toBe('PostgreSQL');
    expect(describeDbProvider('mysql://x')).toBe('MySQL');
    expect(describeDbProvider('sqlite:./dev.db')).toBe('SQLite');
    expect(describeDbProvider('file:./dev.db')).toBe('SQLite');
    expect(describeDbProvider(null)).toBe('unknown');
    expect(describeDbProvider('weird://')).toBe('unknown');
  });
});

describe('maskDbUrl', () => {
  it('returns "not configured" when missing', () => {
    expect(maskDbUrl(null)).toBe('not configured');
    expect(maskDbUrl(undefined)).toBe('not configured');
    expect(maskDbUrl('')).toBe('not configured');
  });
  it('strips credentials but keeps host/db', () => {
    const out = maskDbUrl('postgresql://user:secret@db.example.com:5432/autonnel');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('user');
    expect(out).toContain('db.example.com');
    expect(out).toContain(':5432');
    expect(out).toContain('/autonnel');
  });
  it('returns "configured" if URL parse fails', () => {
    expect(maskDbUrl('not-a-url')).toBe('configured');
  });
});

describe('maskApiKey', () => {
  it('returns empty for empty', () => {
    expect(maskApiKey('')).toBe('');
  });
  it('returns the same value if too short', () => {
    expect(maskApiKey('abc')).toBe('abc');
  });
  it('shows first 6 + last 4 chars', () => {
    const out = maskApiKey('abcdef1234567890wxyz');
    expect(out.startsWith('abcdef')).toBe(true);
    expect(out.endsWith('wxyz')).toBe(true);
    expect(out).toContain('…');
  });
});

describe('apiKeyExpiryTone', () => {
  it('returns muted when no expiry set', () => {
    expect(apiKeyExpiryTone(null, NOW)).toBe('muted');
    expect(apiKeyExpiryTone(undefined, NOW)).toBe('muted');
  });
  it('returns bad when already expired', () => {
    expect(apiKeyExpiryTone(new Date(NOW.getTime() - DAY), NOW)).toBe('bad');
  });
  it('returns warn when within 7 days', () => {
    expect(apiKeyExpiryTone(new Date(NOW.getTime() + 3 * DAY), NOW)).toBe('warn');
  });
  it('returns ok when far in future', () => {
    expect(apiKeyExpiryTone(new Date(NOW.getTime() + 30 * DAY), NOW)).toBe('ok');
  });
  it('handles invalid dates gracefully', () => {
    expect(apiKeyExpiryTone('not-a-date', NOW)).toBe('muted');
  });
});

describe('formatDuration', () => {
  it('renders ms < 1000 as integer ms', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(45)).toBe('45 ms');
    expect(formatDuration(999)).toBe('999 ms');
  });
  it('renders ms ≥ 1000 as seconds with 2 decimals', () => {
    expect(formatDuration(1000)).toBe('1.00 s');
    expect(formatDuration(2345)).toBe('2.35 s');
  });
  it('returns em-dash for missing values', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });
  it('handles non-finite', () => {
    expect(formatNumber(Infinity)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
  });
});
