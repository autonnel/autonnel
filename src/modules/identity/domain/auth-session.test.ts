import { describe, it, expect } from 'vitest';
import { AuthSession, SessionStatus } from './auth-session';
import { toTenantId } from '../../shared-kernel/tenant-id';

const at = new Date('2026-06-04T00:00:00Z');

function active() {
  return AuthSession.rehydrate({
    id: 's1', userId: 'u1', activeTenantId: toTenantId('default'),
    status: SessionStatus.Active,
    absoluteExpiresAt: new Date(at.getTime() + 86_400_000),
    idleExpiresAt: new Date(at.getTime() + 3600_000),
  });
}

describe('AuthSession', () => {
  it('isValid true while active and within both lifetimes', () => {
    expect(active().isValid(new Date(at.getTime() + 60_000))).toBe(true);
  });

  it('revoked session fails even before expiry (server-authoritative)', () => {
    const s = active();
    s.revoke();
    expect(s.isValid(new Date(at.getTime() + 60_000))).toBe(false);
  });

  it('idle/absolute expiry invalidates', () => {
    const s = active();
    expect(s.isValid(new Date(at.getTime() + 7200_000))).toBe(false); // past idle
    expect(s.isValid(new Date(at.getTime() + 90_000_000))).toBe(false); // past absolute
  });

  it('switchActiveTenant changes the active tenant for re-resolution', () => {
    const s = active();
    s.switchActiveTenant(toTenantId('tenant_b'));
    expect(s.activeTenantId).toBe('tenant_b');
  });
});
