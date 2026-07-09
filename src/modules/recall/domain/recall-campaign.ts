import type { ChannelValue } from './value-objects';
import { FrequencyCapPolicy, StopConditionSet, type EligibilityRule } from './policies';

export interface RecallStepInput {
  stepIndex: number;
  channel: ChannelValue;
  delayOffsetMinutes: number;
  templateKey: string;
  incentiveRef?: string;
}

export interface RecallStep {
  readonly stepIndex: number;
  readonly channel: ChannelValue;
  readonly delayOffsetMinutes: number;
  readonly templateKey: string;
  readonly incentiveRef?: string;
}

export type CampaignStatus = 'draft' | 'active' | 'paused';

export interface RecallCampaignCreateInput {
  name: string;
  enabledChannels: ChannelValue[];
  recallWindowHours: number;
  steps: RecallStepInput[];
  frequencyCap: { maxTouches: number; perWindowHours: number };
  eligibility: EligibilityRule;
  stopConditions: { stopOnOptout: boolean; stopOnBounce: boolean };
}

export class RecallCampaign {
  private constructor(
    public id: string | null,
    public name: string,
    public status: CampaignStatus,
    public campaignVersion: number,
    public readonly enabledChannels: ChannelValue[],
    public readonly recallWindowHours: number,
    private _steps: RecallStep[],
    public readonly frequencyCap: FrequencyCapPolicy,
    public readonly eligibility: EligibilityRule,
    public readonly stopConditions: StopConditionSet,
  ) {}

  get steps(): readonly RecallStep[] {
    return this._steps;
  }

  static create(input: RecallCampaignCreateInput): RecallCampaign {
    const steps = RecallCampaign.validateSteps(input.steps, input.enabledChannels, input.recallWindowHours);
    return new RecallCampaign(
      null,
      input.name,
      'draft',
      1,
      [...input.enabledChannels],
      input.recallWindowHours,
      steps,
      FrequencyCapPolicy.of(input.frequencyCap),
      input.eligibility,
      StopConditionSet.of(input.stopConditions),
    );
  }

  // Structural edit forces a new campaignVersion; running attempts keep their bound version.
  replaceSteps(steps: RecallStepInput[]): void {
    this._steps = RecallCampaign.validateSteps(steps, this.enabledChannels, this.recallWindowHours);
    this.campaignVersion += 1;
  }

  activate(): void {
    if (this._steps.length === 0) throw new Error('cannot activate a campaign with no steps');
    this.status = 'active';
  }

  private static validateSteps(
    raw: RecallStepInput[],
    enabledChannels: ChannelValue[],
    recallWindowHours: number,
  ): RecallStep[] {
    if (raw.length === 0) throw new Error('RecallCampaign requires at least one step');
    const sorted = [...raw].sort((a, b) => a.delayOffsetMinutes - b.delayOffsetMinutes);
    const windowMinutes = recallWindowHours * 60;
    const seen = new Set<string>();
    for (const s of sorted) {
      if (s.delayOffsetMinutes < 0) throw new Error('step delayOffset must be non-negative');
      if (s.delayOffsetMinutes > windowMinutes) {
        throw new Error('step offset must be within the recallWindow');
      }
      if (!enabledChannels.includes(s.channel)) {
        throw new Error(`step channel ${s.channel} is not in enabledChannels`);
      }
      const key = `${s.channel}@${s.delayOffsetMinutes}`;
      if (seen.has(key)) throw new Error('no two same-channel steps at the same offset');
      seen.add(key);
    }
    return sorted.map((s, i) => ({
      stepIndex: i,
      channel: s.channel,
      delayOffsetMinutes: s.delayOffsetMinutes,
      templateKey: s.templateKey,
      incentiveRef: s.incentiveRef,
    }));
  }
}
