import { describe, it, expect, vi, beforeEach } from 'vitest';

const { kvStore } = vi.hoisted(() => ({
  kvStore: new Map<string, unknown>(),
}));

vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => kvStore.get(key) ?? undefined),
  setConfig: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value);
  }),
  deleteConfig: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  getEmailKvConfig,
  getEmailKvConfigWithCredentials,
  upsertEmailKvConfig,
  updateEmailKvConfig,
  deleteEmailKvConfig,
} from '@/lib/config/email';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('email KV accessor', () => {
  it('returns null when nothing stored', async () => {
    expect(await getEmailKvConfig()).toBeNull();
    expect(await getEmailKvConfigWithCredentials()).toBeNull();
  });

  it('upserts a new SMTP config and stores encrypted credentials', async () => {
    const cfg = await upsertEmailKvConfig({
      provider: 'SMTP',
      name: 'SMTP Configuration',
      credentials: { host: 'smtp.example.com', port: 587, username: 'u', password: 'p' },
      fromEmail: 'noreply@example.com',
    });
    expect(cfg.id).toMatch(/.+/);
    expect(cfg.provider).toBe('SMTP');
    expect(cfg.fromEmail).toBe('noreply@example.com');
    expect(cfg.isActive).toBe(true);

    const withCreds = await getEmailKvConfigWithCredentials();
    expect(withCreds?.credentials).toEqual({
      host: 'smtp.example.com',
      port: 587,
      username: 'u',
      password: 'p',
    });
  });

  it('preserves id when upserting twice', async () => {
    const a = await upsertEmailKvConfig({
      provider: 'RESEND',
      name: 'Resend',
      credentials: { apiKey: 'k1' },
      fromEmail: 'a@x.com',
    });
    const b = await upsertEmailKvConfig({
      provider: 'RESEND',
      name: 'Resend',
      credentials: { apiKey: 'k2' },
      fromEmail: 'b@x.com',
    });
    expect(b.id).toBe(a.id);
    expect(b.fromEmail).toBe('b@x.com');
  });

  it('updateEmailKvConfig merges partial credentials with existing', async () => {
    await upsertEmailKvConfig({
      provider: 'SMTP',
      name: 'SMTP',
      credentials: { host: 'h', port: 25, username: 'u', password: 'p', secure: false },
      fromEmail: 'a@x.com',
    });
    await updateEmailKvConfig({ credentials: { password: 'pp' } });
    const withCreds = await getEmailKvConfigWithCredentials();
    expect(withCreds?.credentials).toEqual({
      host: 'h',
      port: 25,
      username: 'u',
      password: 'pp',
      secure: false,
    });
  });

  it('updateEmailKvConfig throws when no existing config', async () => {
    await expect(updateEmailKvConfig({ fromEmail: 'x@y.com' })).rejects.toThrow();
  });

  it('deleteEmailKvConfig clears the row', async () => {
    await upsertEmailKvConfig({
      provider: 'RESEND',
      name: 'R',
      credentials: { apiKey: 'k' },
      fromEmail: 'a@x.com',
    });
    await deleteEmailKvConfig();
    expect(await getEmailKvConfig()).toBeNull();
  });
});
