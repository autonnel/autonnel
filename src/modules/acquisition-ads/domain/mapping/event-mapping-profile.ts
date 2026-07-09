import { MappingActivationError } from '../errors';

export const INTERNAL_TRIGGERS = ['PageView', 'CheckoutView', 'InitiatePayment', 'Purchase'] as const;
export type InternalTrigger = (typeof INTERNAL_TRIGGERS)[number];

export interface MappingRule {
  trigger: InternalTrigger;
  platformEventName: string;
  destinationId: string;
  enabled: boolean;
}

interface ProfileProps {
  id: string;
  rules: MappingRule[];
  version?: number;
  active?: boolean;
}

export class EventMappingProfile {
  private constructor(
    readonly id: string,
    private readonly _rules: MappingRule[],
    readonly version: number,
    readonly isActive: boolean,
  ) {}

  static draft(p: ProfileProps): EventMappingProfile {
    return new EventMappingProfile(p.id, p.rules, p.version ?? 0, false);
  }

  static reconstitute(p: ProfileProps): EventMappingProfile {
    return new EventMappingProfile(p.id, p.rules, p.version ?? 0, p.active ?? false);
  }

  get rules(): readonly MappingRule[] { return this._rules; }

  private static assertValid(rules: MappingRule[]): void {
    const seen = new Set<string>();
    for (const r of rules) {
      if (!INTERNAL_TRIGGERS.includes(r.trigger)) {
        throw new MappingActivationError(`Unknown trigger ${r.trigger}`);
      }
      if (!r.destinationId) throw new MappingActivationError('Rule missing destination');
      if (!r.enabled) continue;
      const key = `${r.trigger}::${r.destinationId}`;
      if (seen.has(key)) throw new MappingActivationError(`Duplicate (trigger,destination): ${key}`);
      seen.add(key);
    }
  }

  activate(): EventMappingProfile {
    EventMappingProfile.assertValid(this._rules);
    return new EventMappingProfile(this.id, this._rules, this.version + 1, true);
  }

  withRules(rules: MappingRule[]): EventMappingProfile {
    EventMappingProfile.assertValid(rules);
    return new EventMappingProfile(this.id, rules, this.version + 1, this.isActive);
  }

  rulesForTrigger(trigger: InternalTrigger): MappingRule[] {
    return this._rules.filter((r) => r.enabled && r.trigger === trigger);
  }
}
