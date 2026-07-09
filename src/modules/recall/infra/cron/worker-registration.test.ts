import { describe, it, expect, vi } from 'vitest';
import { registerRecallCron } from './process-due-touches.cron';

describe('registerRecallCron', () => {
  it('returns a cron descriptor the platform scheduler can fan out per tenant', () => {
    const desc = registerRecallCron();
    expect(desc.kind).toBe('recall.due_touch');
    expect(typeof desc.run).toBe('function');
  });

  it('the descriptor run() drives the sweep for a given recall instance', async () => {
    const recall = { processDueTouch: { processDueBatch: vi.fn().mockResolvedValue({ processed: 0 }) } };
    const desc = registerRecallCron();
    await desc.run(recall as any);
    expect(recall.processDueTouch.processDueBatch).toHaveBeenCalled();
  });
});
