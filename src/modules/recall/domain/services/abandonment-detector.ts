import type { ContactSnapshot } from '../value-objects';
import type { EligibilityRule } from '../policies';

export interface AbandonmentCandidate {
  checkoutRef: string;
  contact?: ContactSnapshot;
  cartValueMinor: number;
}

export class AbandonmentDetector {
  isEnrollable(candidate: AbandonmentCandidate, rule: EligibilityRule): boolean {
    if (rule.requireContactHandle && !candidate.contact?.hashedIdentity) return false;
    if (rule.minCartValueMinor !== undefined && candidate.cartValueMinor < rule.minCartValueMinor) return false;
    return true;
  }
}
