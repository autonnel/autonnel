import { AuthSession, SessionStatus } from '../../domain/auth-session';
import type { SessionStorePort } from '../../application/ports/outbound';

interface SessionRow {
  id: string; userId: string; activeTenantId: string; status: string;
  absoluteExpiresAt: Date; idleExpiresAt: Date;
}

// The tenant-extended client injects the scoping tenantId on where/create.
// `activeTenantId` is a separate column carrying the session's chosen tenant.
export class PrismaSessionStore implements SessionStorePort {
  constructor(private readonly db: { session: { create: Function; findFirst: Function; update: Function; updateMany: Function } }) {}

  async create(session: AuthSession): Promise<void> {
    const s = session.snapshot();
    await this.db.session.create({
      data: {
        id: s.id, userId: s.userId, tenantId: s.activeTenantId, activeTenantId: s.activeTenantId, status: s.status,
        absoluteExpiresAt: s.absoluteExpiresAt, idleExpiresAt: s.idleExpiresAt,
      },
    });
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const row = (await this.db.session.findFirst({ where: { id: sessionId } })) as SessionRow | null;
    return row ? toSessionAggregate(row) : null;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.session.update({ where: { id: sessionId }, data: { status: SessionStatus.Revoked } });
  }

  async revokeOthersForUser(userId: string, exceptSessionId: string): Promise<number> {
    const result = (await this.db.session.updateMany({
      where: { userId, status: SessionStatus.Active, id: { not: exceptSessionId } },
      data: { status: SessionStatus.Revoked },
    })) as { count: number };
    return result?.count ?? 0;
  }
}

function toSessionAggregate(row: SessionRow): AuthSession {
  return AuthSession.rehydrate({
    id: row.id, userId: row.userId, activeTenantId: row.activeTenantId,
    status: row.status === 'revoked' ? SessionStatus.Revoked : SessionStatus.Active,
    absoluteExpiresAt: row.absoluteExpiresAt, idleExpiresAt: row.idleExpiresAt,
  });
}
