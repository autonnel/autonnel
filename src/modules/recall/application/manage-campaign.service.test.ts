import { describe, it, expect, vi } from 'vitest';
import { ManageCampaignService } from './manage-campaign.service';

const validInput = {
  name: 'win-back',
  enabledChannels: ['email'] as const,
  recallWindowHours: 168,
  steps: [{ stepIndex: 0, channel: 'email' as const, delayOffsetMinutes: 1440, templateKey: 'recall.abandoned_checkout' }],
  frequencyCap: { maxTouches: 3, perWindowHours: 168 },
  eligibility: { requireContactHandle: true },
  stopConditions: { stopOnOptout: true, stopOnBounce: true },
};

describe('ManageCampaignService', () => {
  it('creates and persists a new campaign when none exists', async () => {
    const repo = { findActive: vi.fn().mockResolvedValue(null), save: vi.fn().mockImplementation(async (c: any) => c) };
    const svc = new ManageCampaignService(repo as any);
    const out = await svc.put(validInput as any);
    expect(out.campaignVersion).toBe(1);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('bumps campaignVersion when editing an existing campaign structure', async () => {
    const repo = { findActive: vi.fn(), save: vi.fn().mockImplementation(async (c: any) => c) };
    const { RecallCampaign } = await import('../domain/recall-campaign');
    const existing = RecallCampaign.create(validInput as any);
    existing.id = 'camp_1';
    repo.findActive = vi.fn().mockResolvedValue(existing);
    const svc = new ManageCampaignService(repo as any);
    const out = await svc.put({ ...validInput, steps: [{ stepIndex: 0, channel: 'email' as const, delayOffsetMinutes: 60, templateKey: 'recall.abandoned_checkout' }] } as any);
    expect(out.campaignVersion).toBe(2);
  });

  it('rejects an invalid campaign (no steps)', async () => {
    const repo = { findActive: vi.fn().mockResolvedValue(null), save: vi.fn() };
    const svc = new ManageCampaignService(repo as any);
    await expect(svc.put({ ...validInput, steps: [] } as any)).rejects.toThrow(/at least one step/i);
  });
});
