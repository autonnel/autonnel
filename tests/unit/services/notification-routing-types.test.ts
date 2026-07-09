import { describe, it, expect } from 'vitest';
import {
  validatePairing,
  type NotificationPairing,
} from '@/lib/services/notification-routing-types';

describe('validatePairing', () => {
  it('accepts a valid email pairing', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'Email ops',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'email', recipients: ['a@b.com'] },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(true);
  });

  it('rejects unknown event ids', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: true,
      events: ['nope.unknown'],
      channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' },
    };
    const r = validatePairing(p, ['order.paid']);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/event/i);
  });

  it('rejects email pairing with no recipients when enabled', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'email', recipients: [] },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(false);
  });

  it('allows email pairing with no recipients when disabled', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: false,
      events: ['order.paid'],
      channel: { type: 'email', recipients: [] },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(true);
  });

  it('rejects invalid email address in recipients', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'email', recipients: ['not-an-email'] },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(false);
  });

  it('rejects slack pairing with non-http URL', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'slack', webhookUrl: 'ftp://x.com' },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(false);
  });

  it('allows webhook pairing without secret', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: 'x',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'webhook', url: 'https://example.com/hook' },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(true);
  });

  it('rejects empty name', () => {
    const p: NotificationPairing = {
      id: 'p1',
      name: '',
      enabled: true,
      events: ['order.paid'],
      channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' },
    };
    expect(validatePairing(p, ['order.paid']).ok).toBe(false);
  });
});
