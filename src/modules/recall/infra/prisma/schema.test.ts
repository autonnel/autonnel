import { describe, it, expect } from 'vitest';
import { getBasePrisma } from '@/lib/db';

describe('Recall Prisma models', () => {
  it('exposes recall delegates on the client', () => {
    const c = getBasePrisma();
    expect((c as any).recallCampaign).toBeDefined();
    expect((c as any).recallAttempt).toBeDefined();
    expect((c as any).recallTouch).toBeDefined();
    expect((c as any).recallSuppression).toBeDefined();
  });
});
