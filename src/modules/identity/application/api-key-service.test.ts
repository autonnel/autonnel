import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService } from './api-key-service';
import { PermissionSet } from '../domain/permission-set';
import { toFeatureKey } from '../domain/feature-key';

describe('ApiKeyService.issue', () => {
  it('returns plaintext once and persists only the hash', async () => {
    const repo = { findByHashGlobal: vi.fn(), listByTenant: vi.fn(), save: vi.fn() };
    const secrets = {
      generatePlaintext: vi.fn().mockReturnValue('ak_live.SECRET'),
      hashSecret: vi.fn().mockResolvedValue('HASHED'),
      constantTimeEquals: vi.fn(),
    };
    const events = { publish: vi.fn() };
    const clock = { now: () => new Date('2020-01-01T00:00:00Z') };
    const svc = new ApiKeyService(repo as any, secrets as any, events as any, clock as any);
    const result = await svc.issue({ scope: PermissionSet.of([toFeatureKey('ORDERS')]), writeAccess: false });
    expect(result.plaintext).toBe('ak_live.SECRET');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][1]).toBe('HASHED'); // hash, not plaintext
  });
});
