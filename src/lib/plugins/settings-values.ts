import type { PluginSettingsPanel, PluginSettingsValues } from './types';

const MAX_STRING_LENGTH = 2048;

export type SanitizeResult = { ok: true; values: PluginSettingsValues } | { ok: false; error: string };

export function defaultSettingsValues(panel: PluginSettingsPanel): PluginSettingsValues {
  const values: PluginSettingsValues = {};
  for (const field of panel.fields) {
    values[field.key] = field.defaultValue ?? (field.type === 'toggle' ? false : '');
  }
  return values;
}

// Stored values are merged over defaults so a field added in a later plugin version still renders.
export function withDefaults(panel: PluginSettingsPanel, stored: unknown): PluginSettingsValues {
  const values = defaultSettingsValues(panel);
  if (!stored || typeof stored !== 'object') return values;
  const record = stored as Record<string, unknown>;
  for (const field of panel.fields) {
    const v = record[field.key];
    if (field.type === 'toggle' ? typeof v === 'boolean' : typeof v === 'string') values[field.key] = v as string | boolean;
  }
  return values;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeSettingsValues(panel: PluginSettingsPanel, input: unknown): SanitizeResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'values must be an object' };
  const record = input as Record<string, unknown>;
  const values: PluginSettingsValues = {};

  for (const field of panel.fields) {
    const raw = record[field.key];
    if (field.type === 'toggle') {
      if (raw !== undefined && typeof raw !== 'boolean') return { ok: false, error: `${field.label} must be true or false` };
      values[field.key] = raw ?? field.defaultValue ?? false;
      continue;
    }
    if (raw !== undefined && typeof raw !== 'string') return { ok: false, error: `${field.label} must be text` };
    const value = (raw ?? '').trim();
    if (value.length > MAX_STRING_LENGTH) return { ok: false, error: `${field.label} is longer than ${MAX_STRING_LENGTH} characters` };
    if (field.required && !value) return { ok: false, error: `${field.label} is required` };
    if (field.type === 'url' && value && !isHttpsUrl(value)) return { ok: false, error: `${field.label} must be an https:// URL` };
    values[field.key] = value;
  }

  const custom = panel.validate?.(values) ?? null;
  if (custom) return { ok: false, error: custom };
  return { ok: true, values };
}
