import { Invitation, InvitationStatus } from '../../domain/invitation';
import type { InvitationListItem, InvitationRepositoryPort } from '../../application/ports/outbound';

interface InvitationRow {
  id: string; tenantId: string; email: string; invitedRoleIds: string[]; status: string;
  expiresAt: Date; createdAt: Date; updatedAt: Date;
}

const STATUS_BY_VALUE: Record<string, InvitationStatus> = {
  pending: InvitationStatus.Pending,
  accepted: InvitationStatus.Accepted,
  revoked: InvitationStatus.Revoked,
  expired: InvitationStatus.Expired,
};

export class PrismaInvitationRepository implements InvitationRepositoryPort {
  constructor(
    private readonly db: {
      invitation: { findFirst: Function; findMany: Function; upsert: Function; update: Function };
    },
  ) {}

  async findByToken(tokenHash: string): Promise<{ invitation: Invitation; tenantId: string } | null> {
    const row = (await this.db.invitation.findFirst({ where: { tokenHash } })) as InvitationRow | null;
    if (!row) return null;
    return { invitation: toInvitationAggregate(row), tenantId: row.tenantId };
  }

  async listByTenant(): Promise<InvitationListItem[]> {
    const rows = (await this.db.invitation.findMany({
      where: { status: { not: InvitationStatus.Revoked } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as InvitationRow[];
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      invitedRoleIds: row.invitedRoleIds,
      status: row.status,
      expiresAt: row.expiresAt,
      acceptedAt: row.status === InvitationStatus.Accepted ? row.updatedAt : null,
      createdAt: row.createdAt,
    }));
  }

  async revokeById(id: string): Promise<boolean> {
    const row = (await this.db.invitation.findFirst({ where: { id } })) as InvitationRow | null;
    if (!row || row.status !== InvitationStatus.Pending) return false;
    await this.db.invitation.update({ where: { id }, data: { status: InvitationStatus.Revoked } as never });
    return true;
  }

  async save(invitation: Invitation, tokenHash: string): Promise<void> {
    await this.db.invitation.upsert({
      where: { tokenHash },
      create: {
        id: invitation.id, email: invitation.email, invitedRoleIds: [...invitation.invitedRoleIds],
        status: invitation.status, tokenHash, expiresAt: invitation.expiresAt,
      },
      update: { status: invitation.status, invitedRoleIds: [...invitation.invitedRoleIds] },
    });
  }
}

function toInvitationAggregate(row: InvitationRow): Invitation {
  return Invitation.rehydrate({
    id: row.id, email: row.email, invitedRoleIds: row.invitedRoleIds,
    status: STATUS_BY_VALUE[row.status] ?? InvitationStatus.Pending, expiresAt: row.expiresAt,
  });
}
