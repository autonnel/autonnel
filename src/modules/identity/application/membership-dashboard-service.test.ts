import { describe, it, expect, vi } from 'vitest';
import { MembershipDashboardService } from './membership-dashboard-service';
import { TenantMembership, MembershipStatus } from '../domain/tenant-membership';
import { toTenantId } from '../../shared-kernel/tenant-id';

describe('MembershipDashboardService.suspend', () => {
  it('refuses to suspend the last owner', async () => {
    const owner = TenantMembership.rehydrate({ id: 'm1', userId: 'u1', roleIds: ['owner'], status: MembershipStatus.Active });
    const repo = {
      findByUserAndTenant: vi.fn().mockResolvedValue(owner),
      listByUser: vi.fn(), countActiveOwners: vi.fn().mockResolvedValue(1), save: vi.fn(),
    };
    const events = { publish: vi.fn() };
    const svc = new MembershipDashboardService(repo as any, events as any);
    await expect(
      svc.suspend({ userId: 'u1', tenantId: toTenantId('default'), targetIsOwner: true }),
    ).rejects.toThrow(/last owner/i);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
