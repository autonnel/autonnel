import { describe, it, expect, vi } from 'vitest';
import { PrismaSuppressionRepository } from './suppression.repository';
import { SuppressionEntry } from '../../domain/suppression';

describe('PrismaSuppressionRepository', () => {
  it('queries active entries by subjectKey and now', async () => {
    const prisma = {
      recallSuppression: {
        findMany: vi.fn().mockResolvedValue([
          { scope: 'contact', subjectKey: 'h1', reason: 'optout', source: 'engagement_callback', createdAt: new Date(), expiresAt: null },
        ]),
        upsert: vi.fn(), deleteMany: vi.fn(),
      },
    };
    const repo = new PrismaSuppressionRepository(prisma as any);
    const out = await repo.findActiveBySubject(['h1'], new Date('2026-06-04T10:00:00Z'));
    expect(out[0]).toBeInstanceOf(SuppressionEntry);
    expect(out[0].subjectKey).toBe('h1');
    expect(prisma.recallSuppression.findMany).toHaveBeenCalled();
  });
});
