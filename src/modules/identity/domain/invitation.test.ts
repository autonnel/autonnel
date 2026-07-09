import { describe, it, expect } from 'vitest';
import { Invitation, InvitationStatus } from './invitation';

const at = new Date('2026-06-04T00:00:00Z');

function pending() {
  return Invitation.rehydrate({
    id: 'i1', email: 'a@b.com', invitedRoleIds: ['r1'],
    status: InvitationStatus.Pending, expiresAt: new Date(at.getTime() + 3600_000),
  });
}

describe('Invitation', () => {
  it('accepts only while pending and unexpired, matching normalized email', () => {
    const inv = pending();
    inv.accept('A@B.com', new Date(at.getTime() + 1000));
    expect(inv.status).toBe(InvitationStatus.Accepted);
  });

  it('is single-use (accepting twice fails)', () => {
    const inv = pending();
    inv.accept('a@b.com', new Date(at.getTime() + 1000));
    expect(() => inv.accept('a@b.com', new Date(at.getTime() + 2000))).toThrow(/pending/i);
  });

  it('rejects expired invitations', () => {
    const inv = pending();
    expect(() => inv.accept('a@b.com', new Date(at.getTime() + 7200_000))).toThrow(/expired/i);
  });

  it('rejects an email mismatch', () => {
    const inv = pending();
    expect(() => inv.accept('other@b.com', new Date(at.getTime() + 1000))).toThrow(/email/i);
  });
});
