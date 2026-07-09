import { UserAccount, UserStatus } from '../../domain/user-account';
import { Email } from '../../domain/email';
import { CredentialHash } from '../../domain/credential-hash';
import type { UserRepositoryPort } from '../../application/ports/outbound';

interface UserRow {
  id: string; email: string; credentialHash: string; status: string;
  emailVerifiedAt: Date | null; verificationToken: string | null; verificationTokenExpiresAt: Date | null;
}

// UN-SCOPED on purpose: email uniqueness is GLOBAL, so this uses the RAW
// Prisma client (no tenant extension) and never writes a tenantId clause.
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly raw: { user: { findFirst: Function; findMany: Function; upsert: Function } }) {}

  async findByEmailGlobal(email: Email): Promise<UserAccount | null> {
    const row = (await this.raw.user.findFirst({ where: { email: email.normalized } })) as UserRow | null;
    return row ? toUserAggregate(row) : null;
  }

  async findById(userId: string): Promise<UserAccount | null> {
    const row = (await this.raw.user.findFirst({ where: { id: userId } })) as UserRow | null;
    return row ? toUserAggregate(row) : null;
  }

  async listByIds(userIds: string[]): Promise<UserAccount[]> {
    if (userIds.length === 0) return [];
    const rows = (await this.raw.user.findMany({ where: { id: { in: userIds } } })) as UserRow[];
    return rows.map(toUserAggregate);
  }

  async save(user: UserAccount): Promise<void> {
    const s = user.snapshot();
    await this.raw.user.upsert({
      where: { id: s.id },
      create: {
        id: s.id, email: s.email.normalized, credentialHash: s.credentialHash.stored, status: s.status,
        emailVerifiedAt: s.emailVerifiedAt, verificationToken: s.verificationToken,
        verificationTokenExpiresAt: s.verificationTokenExpiresAt,
      },
      update: {
        credentialHash: s.credentialHash.stored, status: s.status, emailVerifiedAt: s.emailVerifiedAt,
        verificationToken: s.verificationToken, verificationTokenExpiresAt: s.verificationTokenExpiresAt,
      },
    });
  }
}

function toUserAggregate(row: UserRow): UserAccount {
  return UserAccount.rehydrate({
    id: row.id, email: Email.of(row.email), credentialHash: CredentialHash.fromStored(row.credentialHash),
    status: row.status === 'deactivated' ? UserStatus.Deactivated : UserStatus.Active,
    emailVerifiedAt: row.emailVerifiedAt, verificationToken: row.verificationToken,
    verificationTokenExpiresAt: row.verificationTokenExpiresAt,
  });
}
