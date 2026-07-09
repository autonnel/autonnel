import type { MembershipRepositoryPort, UserRepositoryPort, RoleRepositoryPort } from './ports/outbound';

export interface MemberView {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  roles: Array<{ id: string; name: string }>;
}

export class MemberDirectoryService {
  constructor(
    private readonly memberships: MembershipRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
  ) {}

  async listMembers(): Promise<MemberView[]> {
    const memberships = await this.memberships.listByTenant();
    const userIds = memberships.map((m) => m.userId);
    const [users, roles] = await Promise.all([this.users.listByIds(userIds), this.roles.listByTenant()]);
    const emailById = new Map(users.map((u) => [u.id, u.email.normalized] as const));
    const roleNameById = new Map(roles.map((r) => [r.id, r.name] as const));

    return memberships.map((m) => ({
      id: m.userId,
      email: emailById.get(m.userId) ?? null,
      name: null,
      avatar: null,
      roles: m.roleIds
        .filter((id) => roleNameById.has(id))
        .map((id) => ({ id, name: roleNameById.get(id)! })),
    }));
  }
}
