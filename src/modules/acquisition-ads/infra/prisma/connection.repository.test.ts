import { describe, it, expect, vi } from 'vitest';
import { PrismaConnectionRepository } from './connection.repository';

function fakeDelegate() {
  return {
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    upsert: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
}

describe('PrismaConnectionRepository.saveDiscoveredMeta', () => {
  it('writes both fields when discovery returned both', async () => {
    const conn = fakeDelegate();
    const repo = new PrismaConnectionRepository(conn as never);
    await repo.saveDiscoveredMeta({ platform: 'META' as never, externalAccountId: 'act_1', currency: 'USD', timezone: 'America/New_York' });

    expect(conn.updateMany).toHaveBeenCalledWith({
      where: { platform: 'META', externalAccountId: 'act_1' },
      data: { reportingCurrency: 'USD', reportingTimezone: 'America/New_York' },
    });
  });

  it('omits a field entirely rather than writing null, so a prior sync value is not clobbered', async () => {
    const conn = fakeDelegate();
    const repo = new PrismaConnectionRepository(conn as never);
    await repo.saveDiscoveredMeta({ platform: 'TIKTOK' as never, externalAccountId: '111', currency: null, timezone: null });

    expect(conn.updateMany).not.toHaveBeenCalled();
  });

  it('writes only the field that was discovered', async () => {
    const conn = fakeDelegate();
    const repo = new PrismaConnectionRepository(conn as never);
    await repo.saveDiscoveredMeta({ platform: 'GOOGLE' as never, externalAccountId: '123', currency: null, timezone: 'UTC' });

    expect(conn.updateMany).toHaveBeenCalledWith({
      where: { platform: 'GOOGLE', externalAccountId: '123' },
      data: { reportingTimezone: 'UTC' },
    });
  });
});
