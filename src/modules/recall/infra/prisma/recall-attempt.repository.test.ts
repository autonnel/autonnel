import { describe, it, expect, vi } from 'vitest';
import { PrismaRecallAttemptRepository } from './recall-attempt.repository';
import { RecallAttempt } from '../../domain/recall-attempt';

const attemptRow = {
  id: 'att_1', checkoutRef: 'sess_1', campaignRef: 'camp_1', campaignVersionRef: 1,
  status: 'active', nextStepIndex: 0,
  contact: { hashedIdentity: 'h1', normalizedEmail: 'a@b.co', locale: 'en', consentedChannels: ['email'] },
  incentiveRef: null, frequencyCapMax: 3, enrolledAt: new Date('2026-06-04T08:00:00Z'),
  touches: [],
};

describe('PrismaRecallAttemptRepository', () => {
  it('finds by dedupeKey', async () => {
    const prisma = { recallAttempt: { findUnique: vi.fn().mockResolvedValue(attemptRow), findMany: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn(), $queryRaw: vi.fn() }, $queryRaw: vi.fn() };
    const repo = new PrismaRecallAttemptRepository(prisma as any);
    const out = await repo.findByDedupeKey('sess_1', 'camp_1');
    expect(out?.checkoutRef).toBe('sess_1');
    expect(out).toBeInstanceOf(RecallAttempt);
  });

  it('claimDueBatch leases rows via raw SQL FOR UPDATE SKIP LOCKED', async () => {
    const prisma = {
      $transaction: vi.fn().mockImplementation(async (fn: any) => fn({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'att_1' }]),
        recallAttempt: { findMany: vi.fn().mockResolvedValue([attemptRow]), updateMany: vi.fn() },
      })),
    };
    const repo = new PrismaRecallAttemptRepository(prisma as any);
    const out = await repo.claimDueBatch(new Date('2026-06-04T10:00:00Z'), 50);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('att_1');
  });

  it('round-trips enrolledAt onto the rehydrated attempt', async () => {
    const prisma = { recallAttempt: { findUnique: vi.fn().mockResolvedValue(attemptRow) }, $queryRaw: vi.fn() };
    const repo = new PrismaRecallAttemptRepository(prisma as any);
    const out = await repo.findByDedupeKey('sess_1', 'camp_1');
    expect((out as any).enrolledAt.toISOString()).toBe('2026-06-04T08:00:00.000Z');
  });
});
