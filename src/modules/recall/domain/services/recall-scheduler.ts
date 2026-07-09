import { QuietHoursPolicy } from '../policies';
import type { ClockPort } from '../ports';
import type { ChannelValue } from '../value-objects';

export interface SchedulerCampaignView {
  recallWindowHours: number;
  steps: { stepIndex: number; channel: ChannelValue; delayOffsetMinutes: number; templateKey: string }[];
}

export interface NextDueInput {
  enrolledAt: Date;
  nextStepIndex: number;
  campaign: SchedulerCampaignView;
  quietHours: { startHourUtc: number; endHourUtc: number } | null;
  firedCount: number;
  frequencyCapMaxTouches: number;
}

export type ScheduleDecision = 'fire' | 'wait' | 'defer' | 'cold';

export interface NextDueResult {
  decision: ScheduleDecision;
  stepIndex?: number;
  scheduledFor?: Date;
}

export class RecallScheduler {
  constructor(private readonly clock: ClockPort) {}

  nextDueTouch(input: NextDueInput): NextDueResult {
    if (input.firedCount >= input.frequencyCapMaxTouches) return { decision: 'cold' };
    const step = input.campaign.steps.find((s) => s.stepIndex === input.nextStepIndex);
    if (!step) return { decision: 'cold' };

    const due = new Date(input.enrolledAt.getTime() + step.delayOffsetMinutes * 60_000);
    const windowEnd = new Date(input.enrolledAt.getTime() + input.campaign.recallWindowHours * 3_600_000);
    if (due.getTime() > windowEnd.getTime()) return { decision: 'cold' };

    const now = this.clock.now();
    const quiet = input.quietHours ? QuietHoursPolicy.of(input.quietHours) : QuietHoursPolicy.none();

    let scheduledFor = due;
    let decision: ScheduleDecision = now.getTime() >= due.getTime() ? 'fire' : 'wait';

    if (quiet.isQuiet(scheduledFor)) {
      scheduledFor = this.nextNonQuiet(scheduledFor, quiet);
      if (scheduledFor.getTime() > windowEnd.getTime()) return { decision: 'cold' };
      decision = now.getTime() >= scheduledFor.getTime() ? 'fire' : 'defer';
    }

    return { decision, stepIndex: step.stepIndex, scheduledFor };
  }

  private nextNonQuiet(from: Date, quiet: QuietHoursPolicy): Date {
    const out = new Date(from.getTime());
    for (let i = 0; i < 24 && quiet.isQuiet(out); i++) {
      out.setUTCHours(out.getUTCHours() + 1, 0, 0, 0);
    }
    return out;
  }
}
