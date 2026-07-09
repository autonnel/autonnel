import { describe, it, expect, vi } from 'vitest';
import { RegistrationFlowService, RegistrationRequiresInvitationError } from './registration-flow-service';
import { RegistrationService, ExistingAccountPasswordMismatchError } from './registration-service';

function registrationDeps() {
  return {
    users: { findByEmailGlobal: vi.fn().mockResolvedValue(null), save: vi.fn(), findById: vi.fn() },
    hasher: { hash: vi.fn().mockResolvedValue('hashed'), verify: vi.fn().mockResolvedValue(true) },
    events: { publish: vi.fn() },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') },
  };
}

function registrationSvc(d: ReturnType<typeof registrationDeps>) {
  return new RegistrationService(d.users as any, d.hasher as any, d.events as any, d.clock as any);
}

describe('RegistrationService.precheckCredentials', () => {
  it('returns null for an unregistered email with a strong password', async () => {
    const d = registrationDeps();
    await expect(registrationSvc(d).precheckCredentials({ email: 'new@b.com', password: 'longenough' }))
      .resolves.toBeNull();
  });

  it('rejects a weak password for an unregistered email', async () => {
    const d = registrationDeps();
    await expect(registrationSvc(d).precheckCredentials({ email: 'new@b.com', password: 'short' }))
      .rejects.toThrow('Password must be at least 8 characters');
  });

  it('returns the userId when the existing password matches', async () => {
    const d = registrationDeps();
    d.users.findByEmailGlobal.mockResolvedValue({ id: 'u1', credentialHash: 'stored' });
    await expect(registrationSvc(d).precheckCredentials({ email: 'a@b.com', password: 'longenough' }))
      .resolves.toBe('u1');
    expect(d.hasher.verify).toHaveBeenCalledWith('longenough', 'stored');
  });

  it('throws ExistingAccountPasswordMismatchError when the existing password does not match', async () => {
    const d = registrationDeps();
    d.users.findByEmailGlobal.mockResolvedValue({ id: 'u1', credentialHash: 'stored' });
    d.hasher.verify.mockResolvedValue(false);
    await expect(registrationSvc(d).precheckCredentials({ email: 'a@b.com', password: 'wrongpassword' }))
      .rejects.toBeInstanceOf(ExistingAccountPasswordMismatchError);
  });
});

function flowDeps() {
  return {
    registration: {
      precheckCredentials: vi.fn().mockResolvedValue(null),
      register: vi.fn().mockResolvedValue({ userId: 'u1', created: true }),
    },
    invitations: {
      list: vi.fn().mockResolvedValue([
        { id: 'i1', email: 'a@b.com', status: 'pending', invitedRoleIds: ['r1'] },
      ]),
      accept: vi.fn(),
    },
    memberships: {
      listByTenant: vi.fn().mockResolvedValue([{ id: 'm0' }]),
      findByUserAndTenant: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    },
    roles: { listByTenant: vi.fn().mockResolvedValue([]), save: vi.fn() },
    sessions: { create: vi.fn() },
    signer: { sign: vi.fn().mockResolvedValue('session-token') },
    catalog: { allKeys: () => new Set<string>() },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') },
  };
}

function flowSvc(d: ReturnType<typeof flowDeps>) {
  return new RegistrationFlowService(
    d.registration as any, d.invitations as any, d.memberships as any, d.roles as any,
    d.sessions as any, d.signer as any, d.catalog as any, d.clock as any,
  );
}

describe('RegistrationFlowService.register (first-user path)', () => {
  it('rejects a malformed email before persisting any state', async () => {
    const d = flowDeps();
    d.memberships.listByTenant.mockResolvedValue([]);

    await expect(flowSvc(d).register({ email: 'admin', password: 'longenough' }))
      .rejects.toThrow(/invalid email/i);

    expect(d.roles.save).not.toHaveBeenCalled();
    expect(d.registration.register).not.toHaveBeenCalled();
    expect(d.memberships.save).not.toHaveBeenCalled();
  });
});

describe('RegistrationFlowService.register (invitation path)', () => {
  it('requires an invitation token when members already exist', async () => {
    const d = flowDeps();
    await expect(flowSvc(d).register({ email: 'a@b.com', password: 'longenough' }))
      .rejects.toBeInstanceOf(RegistrationRequiresInvitationError);
  });

  it('does not consume the invitation when credential precheck fails', async () => {
    const d = flowDeps();
    d.registration.precheckCredentials.mockRejectedValue(new ExistingAccountPasswordMismatchError());

    await expect(flowSvc(d).register({ email: 'a@b.com', password: 'wrongpassword', invitationToken: 't1' }))
      .rejects.toBeInstanceOf(ExistingAccountPasswordMismatchError);

    expect(d.invitations.accept).not.toHaveBeenCalled();
    expect(d.registration.register).not.toHaveBeenCalled();
    expect(d.memberships.save).not.toHaveBeenCalled();
  });

  it('accepts the invitation and grants invited roles once credentials pass', async () => {
    const d = flowDeps();
    d.registration.precheckCredentials.mockResolvedValue('u1');
    d.registration.register.mockResolvedValue({ userId: 'u1', created: false });

    const result = await flowSvc(d).register({ email: 'a@b.com', password: 'longenough', invitationToken: 't1' });

    expect(d.registration.precheckCredentials).toHaveBeenCalledWith({ email: 'a@b.com', password: 'longenough' });
    expect(d.invitations.accept).toHaveBeenCalledWith({
      plaintextToken: 't1', acceptingUserId: '', acceptingEmail: 'a@b.com',
    });
    expect(d.memberships.save).toHaveBeenCalledTimes(1);
    expect(d.memberships.save.mock.calls[0][0].roleIds).toEqual(['r1']);
    expect(result).toEqual({ sessionToken: 'session-token' });
  });
});
