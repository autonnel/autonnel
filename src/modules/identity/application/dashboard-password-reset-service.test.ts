import { describe, it, expect, vi } from 'vitest';
import { DashboardPasswordResetService, UserNotFoundError } from './dashboard-password-reset-service';
import { generatePassword } from '@/cli/password-reset';

function deps(user: any) {
  return {
    users: {
      findByEmailGlobal: vi.fn().mockResolvedValue(user),
      save: vi.fn(), findById: vi.fn(), listByIds: vi.fn(),
    },
    hasher: { hash: vi.fn().mockResolvedValue('HASH'), verify: vi.fn() },
    sessions: {
      revokeOthersForUser: vi.fn().mockResolvedValue(3),
      create: vi.fn(), findById: vi.fn(), revoke: vi.fn(),
    },
  };
}

describe('DashboardPasswordResetService', () => {
  it('rotates the credential and revokes all sessions for a known user', async () => {
    const user = { id: 'u1', changeCredential: vi.fn() };
    const d = deps(user);
    const svc = new DashboardPasswordResetService(d.users as any, d.hasher as any, d.sessions as any);

    const result = await svc.reset({ email: 'a@b.com', newPassword: 'secret123' });

    expect(d.hasher.hash).toHaveBeenCalledWith('secret123');
    expect(user.changeCredential).toHaveBeenCalledWith('HASH');
    expect(d.users.save).toHaveBeenCalledWith(user);
    expect(d.sessions.revokeOthersForUser).toHaveBeenCalledWith('u1', '');
    expect(result).toEqual({ userId: 'u1', sessionsRevoked: 3 });
  });

  it('throws UserNotFoundError for an unknown email', async () => {
    const d = deps(null);
    const svc = new DashboardPasswordResetService(d.users as any, d.hasher as any, d.sessions as any);
    await expect(svc.reset({ email: 'missing@b.com', newPassword: 'secret123' })).rejects.toThrow(UserNotFoundError);
    expect(d.users.save).not.toHaveBeenCalled();
  });

  it('rejects a weak new password', async () => {
    const user = { id: 'u1', changeCredential: vi.fn() };
    const d = deps(user);
    const svc = new DashboardPasswordResetService(d.users as any, d.hasher as any, d.sessions as any);
    await expect(svc.reset({ email: 'a@b.com', newPassword: 'short' })).rejects.toThrow(/at least 8/);
    expect(d.users.save).not.toHaveBeenCalled();
  });
});

describe('generatePassword', () => {
  it('produces an alphanumeric password of the requested length that satisfies the policy', () => {
    const pw = generatePassword(16);
    expect(pw).toHaveLength(16);
    expect(/^[A-Za-z0-9]+$/.test(pw)).toBe(true);
    expect(pw.length).toBeGreaterThanOrEqual(8);
  });
});
