import type { CommerceHandoffPort } from '../../application/ports/outbound';
import type { HandoffPayload } from '../../domain/services/handoff-payload-assembler';

export interface CommerceHandoffInboundPort {
  submit(payload: HandoffPayload): Promise<{ backendRef: string }>;
}

export class CommerceHandoffClient implements CommerceHandoffPort {
  constructor(private readonly gateway: CommerceHandoffInboundPort) {}
  submit(payload: HandoffPayload): Promise<{ backendRef: string }> {
    return this.gateway.submit(payload);
  }
}
