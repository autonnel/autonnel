export class StepSlug {
  private constructor(readonly value: string) {}
  static of(raw: string): StepSlug {
    const v = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!v) throw new Error(`Invalid stepSlug: "${raw}"`);
    return new StepSlug(v);
  }
  equals(other: StepSlug): boolean {
    return this.value === other.value;
  }
}

export interface Transition {
  fromStepSlug: string;
  toStepSlug: string;
}

export interface RoutingRule {
  stepSlug: string;
  transitions: Transition[];
}
