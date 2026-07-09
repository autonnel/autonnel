import type { Email } from './email';
import type { CredentialHash } from './credential-hash';

export enum UserStatus {
  Active = 'active',
  Deactivated = 'deactivated',
}

interface UserAccountState {
  id: string;
  email: Email;
  credentialHash: CredentialHash;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  verificationToken: string | null;
  verificationTokenExpiresAt: Date | null;
}

// Root `User`. Email global-uniqueness is enforced at the repository (un-scoped);
// here we enforce monotonic verification, single-use tokens, and suspend-not-delete.
export class UserAccount {
  private constructor(private state: UserAccountState) {}

  static rehydrate(state: UserAccountState): UserAccount {
    return new UserAccount({ ...state });
  }

  get id() { return this.state.id; }
  get email() { return this.state.email; }
  get status() { return this.state.status; }
  get emailVerifiedAt() { return this.state.emailVerifiedAt; }
  get credentialHash() { return this.state.credentialHash; }
  get verificationToken() { return this.state.verificationToken; }
  get verificationTokenExpiresAt() { return this.state.verificationTokenExpiresAt; }

  issueVerificationToken(token: string, expiresAt: Date, _now: Date): void {
    if (this.state.emailVerifiedAt) throw new Error('Email already verified');
    this.state.verificationToken = token;
    this.state.verificationTokenExpiresAt = expiresAt;
  }

  verifyEmail(token: string, now: Date): void {
    if (!this.state.verificationToken || this.state.verificationToken !== token) {
      throw new Error('Invalid verification token');
    }
    if (this.state.verificationTokenExpiresAt && now > this.state.verificationTokenExpiresAt) {
      throw new Error('Verification token expired');
    }
    if (!this.state.emailVerifiedAt) this.state.emailVerifiedAt = now;
    // single-use: consume the token
    this.state.verificationToken = null;
    this.state.verificationTokenExpiresAt = null;
  }

  deactivate(): void {
    this.state.status = UserStatus.Deactivated;
  }

  changeCredential(hash: CredentialHash): void {
    this.state.credentialHash = hash;
  }

  snapshot(): Readonly<UserAccountState> {
    return { ...this.state };
  }
}
