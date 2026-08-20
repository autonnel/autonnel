import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  s3Config: null as unknown,
}));

vi.mock('@/lib/config/storage', () => ({
  getStorageContext: async () => ({
    s3Config: state.s3Config,
    staticDomain: 'cdn.example.com',
    primaryDomain: 'shop.example.com',
  }),
}));
vi.mock('@/lib/db', () => ({ getBasePrisma: () => ({}) }));
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({ getTenantPrisma: () => ({}) }));
vi.mock('@/modules/platform/infra/outbox-event-publisher', () => ({
  OutboxEventPublisher: class {
    async publish() {}
  },
}));

import { makeAiMediaUpload } from './make-ai-media-deps';
import { StorageNotConfiguredError } from '@/lib/s3';

beforeEach(() => {
  state.s3Config = null;
});

describe('makeAiMediaUpload', () => {
  it('fails with a named error when storage was never configured', async () => {
    await expect(makeAiMediaUpload({ locals: {} })).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('builds the uploader once storage is configured', async () => {
    state.s3Config = {
      endpoint: 'https://r2.example.com',
      region: 'auto',
      bucket: 'media',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
    };
    const upload = await makeAiMediaUpload({ locals: {} });
    expect(typeof upload.store).toBe('function');
  });
});
