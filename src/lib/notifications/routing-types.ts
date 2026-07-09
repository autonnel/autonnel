export type NotificationChannelType = 'email' | 'slack' | 'webhook';

export interface EmailChannelConfig {
  type: 'email';
  recipients: string[];
}

export interface SlackChannelConfig {
  type: 'slack';
  webhookUrl: string;
}

export interface WebhookChannelConfig {
  type: 'webhook';
  url: string;
  secret?: string;
}

export type NotificationChannelConfig =
  | EmailChannelConfig
  | SlackChannelConfig
  | WebhookChannelConfig;

export interface NotificationPairing {
  id: string;
  name: string;
  enabled: boolean;
  events: string[];
  channel: NotificationChannelConfig;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePairing(
  p: NotificationPairing,
  knownEventIds: string[],
): ValidationResult {
  if (typeof p.id !== 'string' || p.id.length === 0) {
    return { ok: false, error: 'id required' };
  }
  if (typeof p.name !== 'string' || p.name.trim().length === 0 || p.name.length > 100) {
    return { ok: false, error: 'name must be 1-100 chars' };
  }
  if (typeof p.enabled !== 'boolean') {
    return { ok: false, error: 'enabled must be boolean' };
  }
  if (!Array.isArray(p.events)) {
    return { ok: false, error: 'events must be an array' };
  }
  const known = new Set(knownEventIds);
  for (const id of p.events) {
    if (typeof id !== 'string' || !known.has(id)) {
      return { ok: false, error: `unknown event id: ${id}` };
    }
  }

  const ch = p.channel;
  if (!ch || typeof ch !== 'object') {
    return { ok: false, error: 'channel required' };
  }

  switch (ch.type) {
    case 'email': {
      if (!Array.isArray(ch.recipients)) {
        return { ok: false, error: 'email recipients must be array' };
      }
      if (p.enabled && ch.recipients.length === 0) {
        return { ok: false, error: 'enabled email pairing must have at least one recipient' };
      }
      for (const r of ch.recipients) {
        if (typeof r !== 'string' || !EMAIL_REGEX.test(r)) {
          return { ok: false, error: `invalid email recipient: ${r}` };
        }
      }
      return { ok: true };
    }
    case 'slack': {
      if (typeof ch.webhookUrl !== 'string') {
        return { ok: false, error: 'slack webhookUrl must be string' };
      }
      if (p.enabled && !isHttpUrl(ch.webhookUrl)) {
        return { ok: false, error: 'slack webhookUrl must be http(s)' };
      }
      return { ok: true };
    }
    case 'webhook': {
      if (typeof ch.url !== 'string') {
        return { ok: false, error: 'webhook url must be string' };
      }
      if (p.enabled && !isHttpUrl(ch.url)) {
        return { ok: false, error: 'webhook url must be http(s)' };
      }
      if (ch.secret !== undefined && typeof ch.secret !== 'string') {
        return { ok: false, error: 'webhook secret must be string when provided' };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: `unknown channel type: ${(ch as { type: string }).type}` };
  }
}
