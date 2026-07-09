import { Address, ChannelType } from '../domain/value-objects';
import type { SuppressionRepositoryPort } from './ports/outbound';
import type { PrincipalResolutionPort } from '@/modules/identity/application/ports/inbound';

const FEATURE = 'SETTINGS_EMAIL';

export class ManageSuppressionService {
  constructor(
    private readonly suppressions: SuppressionRepositoryPort,
    private readonly principals: PrincipalResolutionPort,
  ) {}

  async list(channel?: ChannelType) {
    this.principals.requireFeature(FEATURE as never);
    const entries = await this.suppressions.list(channel);
    return entries.map((e) => ({ channel: e.channel, address: e.normalizedAddress, reason: e.reason, active: e.active, source: e.source }));
  }

  async unsuppress(channel: ChannelType, rawAddress: string, actor: string): Promise<void> {
    this.principals.requireFeature(FEATURE as never);
    const address = Address.of(channel, rawAddress);
    const [entry] = await this.suppressions.findForAddress(address);
    if (!entry) throw new Error('no suppression entry for address');
    entry.unsuppress(actor);
    await this.suppressions.upsert(entry);
  }
}
