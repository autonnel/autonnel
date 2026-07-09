import type { ClickIdentifier } from '../value-objects/click-identifier';
import type { HashedIdentity } from '../value-objects/hashed-identity';
import type { ConsentDecision } from './consent-gate';

export interface NeutralPayload {
  clickIds: { field: string; value: string }[];
  hashedEmail?: string;
  hashedPhone?: string;
}

export class PayloadAssembler {
  assemble(input: {
    decision: ConsentDecision;
    identifiers: ClickIdentifier[];
    hashedIdentity: HashedIdentity;
  }): NeutralPayload {
    const clickIds = input.identifiers.map((c) => ({ field: c.field, value: c.value }));
    if (input.decision === 'SEND_FULL') {
      return {
        clickIds,
        hashedEmail: input.hashedIdentity.email,
        hashedPhone: input.hashedIdentity.phone,
      };
    }
    return { clickIds };
  }
}
