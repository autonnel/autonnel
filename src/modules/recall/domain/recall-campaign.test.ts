import { describe, it, expect } from 'vitest';
import { RecallCampaign } from './recall-campaign';

const baseStep = (offsetMinutes: number, channel: 'email' | 'sms' = 'email') => ({
  stepIndex: 0,
  channel,
  delayOffsetMinutes: offsetMinutes,
  templateKey: 'recall.abandoned_checkout',
  incentiveRef: undefined as string | undefined,
});

describe('RecallCampaign', () => {
  it('requires at least one step', () => {
    expect(() =>
      RecallCampaign.create({
        name: 'win-back',
        enabledChannels: ['email'],
        recallWindowHours: 168,
        steps: [],
        frequencyCap: { maxTouches: 3, perWindowHours: 168 },
        eligibility: { requireContactHandle: true },
        stopConditions: { stopOnOptout: true, stopOnBounce: true },
      }),
    ).toThrow(/at least one step/i);
  });

  it('rejects two same-channel steps at the same offset', () => {
    expect(() =>
      RecallCampaign.create({
        name: 'dup',
        enabledChannels: ['email'],
        recallWindowHours: 168,
        steps: [
          { ...baseStep(60), stepIndex: 0 },
          { ...baseStep(60), stepIndex: 1 },
        ],
        frequencyCap: { maxTouches: 3, perWindowHours: 168 },
        eligibility: { requireContactHandle: true },
        stopConditions: { stopOnOptout: true, stopOnBounce: true },
      }),
    ).toThrow(/same-channel.*same offset/i);
  });

  it('rejects a step whose channel is not enabled', () => {
    expect(() =>
      RecallCampaign.create({
        name: 'bad-channel',
        enabledChannels: ['email'],
        recallWindowHours: 168,
        steps: [{ ...baseStep(60, 'sms') }],
        frequencyCap: { maxTouches: 3, perWindowHours: 168 },
        eligibility: { requireContactHandle: true },
        stopConditions: { stopOnOptout: true, stopOnBounce: true },
      }),
    ).toThrow(/not in enabledChannels/i);
  });

  it('rejects a step offset beyond the recall window', () => {
    expect(() =>
      RecallCampaign.create({
        name: 'too-late',
        enabledChannels: ['email'],
        recallWindowHours: 1,
        steps: [{ ...baseStep(120) }], // 120 min > 1h window
        frequencyCap: { maxTouches: 3, perWindowHours: 168 },
        eligibility: { requireContactHandle: true },
        stopConditions: { stopOnOptout: true, stopOnBounce: true },
      }),
    ).toThrow(/within.*recallWindow/i);
  });

  it('creates at version 1 and bumps version on a structural edit', () => {
    const c = RecallCampaign.create({
      name: 'v',
      enabledChannels: ['email'],
      recallWindowHours: 168,
      steps: [baseStep(60), { ...baseStep(1440), stepIndex: 1 }],
      frequencyCap: { maxTouches: 3, perWindowHours: 168 },
      eligibility: { requireContactHandle: true },
      stopConditions: { stopOnOptout: true, stopOnBounce: true },
    });
    expect(c.campaignVersion).toBe(1);
    c.replaceSteps([baseStep(30)]);
    expect(c.campaignVersion).toBe(2);
  });
});
