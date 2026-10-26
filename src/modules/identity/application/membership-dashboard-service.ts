import { LastOwnerGuard } from '../domain/services/last-owner-guard';
import type { MembershipRepositoryPort, DomainEventPublisherPort } from './ports/outbound';

export class MembershipDashboardService {
  private readonly guard = new LastOwnerGuard();

  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly events: DomainEventPublisherPort,
  ) {}

  async suspend(input: { userId: string; tenantId: string; targetIsOwner: boolean }): Promise<void> {
    const membership = await this.memberships.findByUserAndTenant(input.userId, input.tenantId);
    if (!membership) throw new Error('Membership not found');
    const ownerCount = await this.memberships.countActiveOwners(input.tenantId);
    this.guard.assertCanRemove({ ownerMembershipCount: ownerCount, targetIsOwner: input.targetIsOwner });
    membership.suspend();
    await this.memberships.save(membership);
    await this.events.publish({ type: 'MembershipSuspended', payload: { userId: input.userId } });
  }
}
