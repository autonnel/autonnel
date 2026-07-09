import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}));

vi.mock('@/lib/runtime/env', () => ({
  readEnv: (key: string) => env[key],
}));

import {
  decryptCredentials,
  encryptCredentials,
} from '@/lib/services/credentials-crypto';

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
});

describe('credentials crypto', () => {
  it('encrypts new credentials with AES-GCM when CREDENTIALS_ENCRYPTION_KEY is configured', () => {
    env.CREDENTIALS_ENCRYPTION_KEY = 'unit-test-key-with-enough-entropy';

    const encrypted = encryptCredentials({ secret: 'sk_live_x' });

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('sk_live_x');
    expect(decryptCredentials(encrypted)).toEqual({ secret: 'sk_live_x' });
  });

  it('still decrypts legacy base64 JSON credential blobs', () => {
    const legacy = Buffer.from(JSON.stringify({ secret: 'legacy' })).toString('base64');

    expect(decryptCredentials(legacy)).toEqual({ secret: 'legacy' });
  });

  it('fails closed in production when no encryption key is configured', () => {
    env.NODE_ENV = 'production';

    expect(() => encryptCredentials({ secret: 'sk_live_x' })).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });
});
