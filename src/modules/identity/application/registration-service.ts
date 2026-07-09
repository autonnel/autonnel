import { UserAccount, UserStatus } from '../domain/user-account';
import { Email } from '../domain/email';
import { CredentialPolicy } from '../domain/services/credential-policy';
import type {
  UserRepositoryPort, PasswordHasherPort, DomainEventPublisherPort, ClockPort,
} from './ports/outbound';

export class ExistingAccountPasswordMismatchError extends Error {
  constructor() {
    super('An account with this email already exists. Enter your existing password to accept the invitation.');
    this.name = 'ExistingAccountPasswordMismatchError';
  }
}

export class RegistrationService {
  private readonly policy = new CredentialPolicy();

  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly events: DomainEventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  // Pre-flight for flows that must validate credentials BEFORE any state change
  // (e.g. consuming an invitation token): an existing account must prove its
  // current password — register() alone would silently ignore the submitted
  // one — and a new account must pass the credential policy. Returns the
  // existing userId, or null when the email is unregistered.
  async precheckCredentials(input: { email: string; password: string }): Promise<string | null> {
    const existing = await this.users.findByEmailGlobal(Email.of(input.email));
    if (existing) {
      const ok = await this.hasher.verify(input.password, existing.credentialHash);
      if (!ok) throw new ExistingAccountPasswordMismatchError();
      return existing.id;
    }
    this.policy.assertStrong(input.password);
    return null;
  }

  // Idempotent: registering an existing email is a no-op-return (never duplicates).
  async register(input: { email: string; password: string }): Promise<{ userId: string; created: boolean }> {
    const email = Email.of(input.email);
    const existing = await this.users.findByEmailGlobal(email);
    if (existing) return { userId: existing.id, created: false };

    this.policy.assertStrong(input.password);
    const hash = await this.hasher.hash(input.password);
    const user = UserAccount.rehydrate({
      id: crypto.randomUUID(), email, credentialHash: hash,
      status: UserStatus.Active, emailVerifiedAt: null,
      verificationToken: null, verificationTokenExpiresAt: null,
    });
    await this.users.save(user);
    await this.events.publish({ type: 'UserRegistered', payload: { userId: user.id } });
    return { userId: user.id, created: true };
  }
}
