import type { AdCreativeRepositoryPort } from './ports/outbound';

export class AssignAdFunnelService {
  constructor(
    private readonly deps: {
      creativeRepo: AdCreativeRepositoryPort;
      funnelExists(funnelId: string): Promise<boolean>;
    },
  ) {}

  // funnelId null clears the manual assignment and hands the creative back to path attribution.
  async assign(input: { creativeId: string; funnelId: string | null }): Promise<void> {
    const creative = await this.deps.creativeRepo.findById(input.creativeId);
    if (!creative) throw new Error('creative not found');
    if (input.funnelId && !(await this.deps.funnelExists(input.funnelId))) {
      throw new Error('funnel not found');
    }
    await this.deps.creativeRepo.setManualFunnel(input.creativeId, input.funnelId);
  }
}
