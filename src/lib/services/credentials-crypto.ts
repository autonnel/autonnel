import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { readEnv } from '@/lib/runtime/env';

const ENCRYPTED_PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getEncryptionKey(): Buffer | null {
  const configuredKey = readEnv('CREDENTIALS_ENCRYPTION_KEY');

  if (!configuredKey) {
    return null;
  }

  const decodedKey = Buffer.from(configuredKey, 'base64');
  if (decodedKey.length === 32) {
    return decodedKey;
  }

  return createHash('sha256').update(configuredKey).digest();
}

function decryptVersionedCredentials<T>(encrypted: string): T {
  const key = getEncryptionKey();

  if (!key) {
    return {} as T;
  }

  const packed = Buffer.from(
    encrypted.slice(ENCRYPTED_PREFIX.length),
    'base64url'
  );

  if (packed.length <= IV_BYTES + AUTH_TAG_BYTES) {
    return {} as T;
  }

  const iv = packed.subarray(0, IV_BYTES);
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8')) as T;
}


export function encryptCredentials(credentials: unknown): string {
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const key = getEncryptionKey();

  if (!key) {
    // Plaintext storage is only tolerable in an explicit development/test run.
    // Any other NODE_ENV — including unset — must fail fast so a self-hosted server
    // started without NODE_ENV=production never silently persists provider secrets
    // in plaintext.
    const nodeEnv = readEnv('NODE_ENV');
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new Error(
        'CREDENTIALS_ENCRYPTION_KEY is required to encrypt credentials'
      );
    }

    return plaintext.toString('base64');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([
    iv,
    authTag,
    ciphertext,
  ]).toString('base64url')}`;
}

export function decryptCredentials<T = Record<string, unknown>>(
  encrypted: unknown
): T {
  if (typeof encrypted === 'string') {
    try {
      if (encrypted.startsWith(ENCRYPTED_PREFIX)) {
        return decryptVersionedCredentials<T>(encrypted);
      }

      return JSON.parse(Buffer.from(encrypted, 'base64').toString()) as T;
    } catch {
      return {} as T;
    }
  }

  return (encrypted ?? {}) as T;
}
