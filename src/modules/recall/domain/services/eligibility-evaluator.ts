import type { ContactSnapshot } from '../value-objects';
import type { SuppressionEntry } from '../suppression';

export interface EligibilityInput {
  contact: ContactSnapshot;
  checkoutRef: string;
  activeSuppressions: SuppressionEntry[];
  now: Date;
}

export interface EligibilityVerdict {
  enroll: boolean;
  reason?: 'suppressed' | 'no_contact';
}

export class EligibilityEvaluator {
  evaluate(input: EligibilityInput): EligibilityVerdict {
    if (!input.contact?.hashedIdentity) return { enroll: false, reason: 'no_contact' };
    const blocked = input.activeSuppressions.some(
      (s) =>
        s.isActive(input.now) &&
        (s.matches('contact', input.contact.hashedIdentity) || s.matches('checkout', input.checkoutRef)),
    );
    if (blocked) return { enroll: false, reason: 'suppressed' };
    return { enroll: true };
  }
}
