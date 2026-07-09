export interface EligibilityRule {
  readonly minCartValueMinor?: number;
  readonly requireContactHandle: boolean;
  readonly excludeFunnelIds?: string[];
}

export class FrequencyCapPolicy {
  private constructor(readonly maxTouches: number, readonly perWindowHours: number) {}
  static of(p: { maxTouches: number; perWindowHours: number }): FrequencyCapPolicy {
    if (p.maxTouches < 1) throw new Error('maxTouches must be >= 1');
    if (p.perWindowHours < 1) throw new Error('perWindowHours must be >= 1');
    return new FrequencyCapPolicy(p.maxTouches, p.perWindowHours);
  }
  allows(firedCount: number): boolean {
    return firedCount < this.maxTouches;
  }
}

export class QuietHoursPolicy {
  private constructor(
    readonly startHourUtc: number | null,
    readonly endHourUtc: number | null,
  ) {}
  static none(): QuietHoursPolicy {
    return new QuietHoursPolicy(null, null);
  }
  static of(p: { startHourUtc: number; endHourUtc: number }): QuietHoursPolicy {
    for (const h of [p.startHourUtc, p.endHourUtc]) {
      if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error('quiet hour must be 0..23');
    }
    return new QuietHoursPolicy(p.startHourUtc, p.endHourUtc);
  }
  isQuiet(at: Date): boolean {
    if (this.startHourUtc === null || this.endHourUtc === null) return false;
    const h = at.getUTCHours();
    // Window may wrap past midnight (e.g. 22 -> 8).
    if (this.startHourUtc <= this.endHourUtc) {
      return h >= this.startHourUtc && h < this.endHourUtc;
    }
    return h >= this.startHourUtc || h < this.endHourUtc;
  }
}

export class StopConditionSet {
  readonly stopOnPaid = true;
  private constructor(readonly stopOnOptout: boolean, readonly stopOnBounce: boolean) {}
  static of(p: { stopOnOptout: boolean; stopOnBounce: boolean }): StopConditionSet {
    return new StopConditionSet(p.stopOnOptout, p.stopOnBounce);
  }
}
