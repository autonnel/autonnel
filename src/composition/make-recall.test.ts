import { describe, it, expect, vi } from 'vitest';
import { makeRecall } from './make-recall';

describe('makeRecall composition root', () => {
  it('wires services from the provided ambient dependencies (no DI container)', () => {
    const deps = {
      prisma: {
        recallCampaign: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        recallAttempt: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        recallSuppression: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
        recallTouch: { upsert: vi.fn() },
        $transaction: vi.fn(),
      },
      sendNotification: { send: vi.fn() },
      checkoutPaymentStatus: { readPaidStatus: vi.fn() },
      checkoutResume: { buildResumeLink: vi.fn() },
      commerceRead: { resolveIncentiveRef: vi.fn() },
      jobQueue: { enqueue: vi.fn() },
      events: { publish: vi.fn() },
      configQuery: { getConfig: vi.fn().mockResolvedValue({ enabled: true, quietHours: null, attributionWindowHours: 48 }) },
    };
    const recall = makeRecall(deps as any);
    expect(recall.detectAndEnroll).toBeDefined();
    expect(recall.processDueTouch).toBeDefined();
    expect(recall.handleCheckoutPaid).toBeDefined();
    expect(recall.handleEngagementCallback).toBeDefined();
    expect(recall.manageCampaign).toBeDefined();
    expect(recall.manageSuppression).toBeDefined();
    expect(recall.cancelRecall).toBeDefined();
  });
});
