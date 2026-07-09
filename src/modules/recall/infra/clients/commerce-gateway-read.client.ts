import type { CommerceGatewayReadPort } from '../../application/ports';

export interface CommerceCatalogReadInbound {
  resolveIncentiveRef(incentiveRef: string): Promise<{ code: string } | null>;
}

export class CommerceGatewayReadPortClient implements CommerceGatewayReadPort {
  constructor(private readonly inbound: CommerceCatalogReadInbound) {}
  async resolveIncentive(incentiveRef: string): Promise<{ code: string } | null> {
    return this.inbound.resolveIncentiveRef(incentiveRef);
  }
}
