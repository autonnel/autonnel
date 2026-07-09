import { describe, it, expect } from 'vitest';
import { UserAccount, UserStatus } from './user-account';
import { Email } from './email';
import { CredentialHash } from './credential-hash';

const baseAt = new Date('2026-06-04T00:00:00Z');

function makeUser() {
  return UserAccount.rehydrate({
    id: 'u1',
    email: Email.of('a@b.com'),
    credentialHash: CredentialHash.fromStored('pbkdf2$1$s$d'),
    status: UserStatus.Active,
    emailVerifiedAt: null,
    verificationToken: null,
    verificationTokenExpiresAt: null,
  });
}

describe('UserAccount', () => {
  it('verifyEmail consumes a valid single-use token and sets emailVerifiedAt monotonically', () => {
    const u = makeUser();
    u.issueVerificationToken('tok-1', new Date(baseAt.getTime() + 60_000), baseAt);
    u.verifyEmail('tok-1', new Date(baseAt.getTime() + 1_000));
    expect(u.emailVerifiedAt).not.toBeNull();
    expect(() => u.verifyEmail('tok-1', new Date(baseAt.getTime() + 2_000))).toThrow(/token/i);
  });

  it('rejects an expired verification token', () => {
    const u = makeUser();
    u.issueVerificationToken('tok-1', new Date(baseAt.getTime() + 1_000), baseAt);
    expect(() => u.verifyEmail('tok-1', new Date(baseAt.getTime() + 5_000))).toThrow(/expired/i);
  });

  it('deactivate suspends instead of deleting', () => {
    const u = makeUser();
    u.deactivate();
    expect(u.status).toBe(UserStatus.Deactivated);
  });

  it('emailVerifiedAt is monotonic (cannot move backwards / re-issue after verified)', () => {
    const u = makeUser();
    u.issueVerificationToken('t', new Date(baseAt.getTime() + 60_000), baseAt);
    u.verifyEmail('t', new Date(baseAt.getTime() + 1_000));
    expect(() => u.issueVerificationToken('t2', new Date(baseAt.getTime() + 120_000), baseAt)).toThrow(/verified/i);
  });
});
