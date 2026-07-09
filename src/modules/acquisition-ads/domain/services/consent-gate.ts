import type { ConsentState } from '../value-objects/consent-state';

export type ConsentDecision = 'SEND_FULL' | 'SEND_NON_PII' | 'SUPPRESS';

export class ConsentGate {
  decide(consent: ConsentState): ConsentDecision {
    if (consent.isDenied()) return 'SUPPRESS';
    if (consent.allowsAdStorage()) return 'SEND_FULL';
    return 'SEND_NON_PII';
  }
}
