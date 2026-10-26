import { describe, it, expect } from 'vitest';
import { sanitizeSettingsValues, withDefaults, defaultSettingsValues } from '@/lib/plugins/settings-values';
import type { PluginSettingsPanel } from '@/lib/plugins/types';

const panel: PluginSettingsPanel = {
  id: 'tracker',
  title: 'Tracker',
  configKey: 'tracker.config',
  fields: [
    { key: 'enabled', label: 'Enabled', type: 'toggle', defaultValue: true },
    { key: 'postbackUrl', label: 'Postback URL', type: 'url', required: true },
    { key: 'param', label: 'Param', type: 'text', defaultValue: 'cid' },
  ],
  validate: (v) => (v.param === 'forbidden' ? 'param is forbidden' : null),
};

describe('plugin settings values', () => {
  it('fills defaults per field type', () => {
    expect(defaultSettingsValues(panel)).toEqual({ enabled: true, postbackUrl: '', param: 'cid' });
  });

  it('merges stored values over defaults and ignores wrong types and unknown keys', () => {
    expect(withDefaults(panel, { enabled: false, postbackUrl: 5, extra: 'x' })).toEqual({
      enabled: false,
      postbackUrl: '',
      param: 'cid',
    });
    expect(withDefaults(panel, null)).toEqual(defaultSettingsValues(panel));
  });

  it('trims strings, drops unknown keys and keeps declared ones', () => {
    const r = sanitizeSettingsValues(panel, { postbackUrl: ' https://t.example.com/postback ', param: ' sub ', junk: 1 });
    expect(r).toEqual({ ok: true, values: { enabled: true, postbackUrl: 'https://t.example.com/postback', param: 'sub' } });
  });

  it('rejects missing required fields, non-https urls and wrong types', () => {
    expect(sanitizeSettingsValues(panel, { param: 'x' })).toEqual({ ok: false, error: 'Postback URL is required' });
    expect(sanitizeSettingsValues(panel, { postbackUrl: 'http://t.example.com' })).toMatchObject({ ok: false, error: /https/ });
    expect(sanitizeSettingsValues(panel, { postbackUrl: 'https://a', enabled: 'yes' })).toMatchObject({ ok: false });
    expect(sanitizeSettingsValues(panel, [])).toMatchObject({ ok: false });
    expect(sanitizeSettingsValues(panel, { postbackUrl: 'https://a', param: 'x'.repeat(3000) })).toMatchObject({ ok: false });
  });

  it('applies the plugin validator last', () => {
    expect(sanitizeSettingsValues(panel, { postbackUrl: 'https://a.example', param: 'forbidden' })).toEqual({
      ok: false,
      error: 'param is forbidden',
    });
  });
});
