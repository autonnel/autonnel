export enum SessionStatus {
  Active = 'active',
  Revoked = 'revoked',
}

interface SessionState {
  id: string;
  userId: string;
  activeTenantId: string;
  status: SessionStatus;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
}

// Revocation is server-authoritative: a revoked token fails even before expiry (token carries sessionId checked against this store).
export class AuthSession {
  private constructor(private state: SessionState) {}

  static rehydrate(state: SessionState): AuthSession {
    return new AuthSession({ ...state });
  }

  get id() { return this.state.id; }
  get userId() { return this.state.userId; }
  get activeTenantId() { return this.state.activeTenantId; }
  get status() { return this.state.status; }

  isValid(now: Date): boolean {
    if (this.state.status !== SessionStatus.Active) return false;
    if (now > this.state.absoluteExpiresAt) return false;
    if (now > this.state.idleExpiresAt) return false;
    return true;
  }

  switchActiveTenant(tenantId: string): void {
    this.state.activeTenantId = tenantId;
  }

  revoke(): void {
    this.state.status = SessionStatus.Revoked;
  }

  snapshot(): Readonly<SessionState> {
    return { ...this.state };
  }
}
