import { Email } from './email';

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}

interface InvitationState {
  id: string;
  email: string;
  invitedRoleIds: string[];
  status: InvitationStatus;
  expiresAt: Date;
}

export class Invitation {
  private constructor(private state: InvitationState) {}

  static rehydrate(state: InvitationState): Invitation {
    return new Invitation({ ...state, invitedRoleIds: [...state.invitedRoleIds] });
  }

  get id() { return this.state.id; }
  get status() { return this.state.status; }
  get invitedRoleIds(): readonly string[] { return this.state.invitedRoleIds; }
  get email() { return this.state.email; }
  get expiresAt() { return this.state.expiresAt; }

  accept(acceptingEmailRaw: string, now: Date): void {
    if (this.state.status !== InvitationStatus.Pending) throw new Error('Invitation not pending');
    if (now > this.state.expiresAt) throw new Error('Invitation expired');
    const expected = Email.of(this.state.email).normalized;
    const actual = Email.of(acceptingEmailRaw).normalized;
    if (expected !== actual) throw new Error('Invitation email mismatch');
    this.state.status = InvitationStatus.Accepted;
  }

  revoke(): void {
    if (this.state.status !== InvitationStatus.Pending) throw new Error('Invitation not pending');
    this.state.status = InvitationStatus.Revoked;
  }
}
