import { describe, it, expect } from 'vitest';
import { deriveCampaignFromConfig } from './config-recall-campaign.repository';
import type { RecallConfigPublic } from '@/lib/config/recall';

function cfg(isEnabled: boolean, intervals: Array<{ hours: number; emailTemplateType: string; couponId?: string | null }>): RecallConfigPublic {
  return { id: 'rc_1', isEnabled, intervals, createdAt: new Date(0), updatedAt: new Date(0) };
}

describe('deriveCampaignFromConfig', () => {
  it('returns null when no config exists', () => {
    expect(deriveCampaignFromConfig(null)).toBeNull();
  });

  it('returns null when disabled', () => {
    expect(deriveCampaignFromConfig(cfg(false, [{ hours: 24, emailTemplateType: 'RECALL_1' }]))).toBeNull();
  });

  it('returns null when there are no valid intervals', () => {
    expect(deriveCampaignFromConfig(cfg(true, []))).toBeNull();
  });

  it('derives an active campaign with one email step per interval, sorted by hours', () => {
    const c = deriveCampaignFromConfig(
      cfg(true, [
        { hours: 168, emailTemplateType: 'RECALL_3' },
        { hours: 24, emailTemplateType: 'RECALL_1', couponId: 'cp_1' },
        { hours: 72, emailTemplateType: 'RECALL_2' },
      ]),
    );
    expect(c).not.toBeNull();
    expect(c!.status).toBe('active');
    expect(c!.recallWindowHours).toBe(168);
    expect(c!.frequencyCap.maxTouches).toBe(3);
    expect(c!.steps.map((s) => s.templateKey)).toEqual(['recall.touch.1', 'recall.touch.2', 'recall.touch.3']);
    expect(c!.steps.map((s) => s.delayOffsetMinutes)).toEqual([24 * 60, 72 * 60, 168 * 60]);
    expect(c!.steps[0].incentiveRef).toBe('cp_1');
    expect(c!.enabledChannels).toEqual(['email']);
  });

  it('dedupes intervals sharing the same hour', () => {
    const c = deriveCampaignFromConfig(
      cfg(true, [
        { hours: 24, emailTemplateType: 'RECALL_1' },
        { hours: 24, emailTemplateType: 'RECALL_2' },
      ]),
    );
    expect(c!.steps).toHaveLength(1);
    expect(c!.steps[0].templateKey).toBe('recall.touch.1');
  });

  it('falls back to the legacy key for an unknown template type', () => {
    const c = deriveCampaignFromConfig(cfg(true, [{ hours: 24, emailTemplateType: 'NOPE' }]));
    expect(c!.steps[0].templateKey).toBe('recall.abandoned_checkout');
  });
});
