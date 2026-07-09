import { describe, it, expect, vi } from 'vitest';
import { PrismaUserRepository } from './prisma-user-repository';
import { Email } from '../../domain/email';

describe('PrismaUserRepository (un-scoped global lookup)', () => {
  it('findByEmailGlobal queries the RAW client WITHOUT a tenantId clause (documented bypass)', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'u1', email: 'a@b.com', credentialHash: 'pbkdf2$1$s$d', status: 'active',
      emailVerifiedAt: null, verificationToken: null, verificationTokenExpiresAt: null,
    });
    const rawClient = { user: { findFirst, upsert: vi.fn() } };
    const repo = new PrismaUserRepository(rawClient as any);
    const user = await repo.findByEmailGlobal(Email.of('A@B.com'));
    expect(user?.id).toBe('u1');
    // the where clause is email-only — no tenantId leaks in
    const where = findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ email: 'a@b.com' });
    expect(where.tenantId).toBeUndefined();
  });
});
