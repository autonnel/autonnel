import { CredentialPolicy } from '../domain/services/credential-policy';
import type {
  UserRepositoryPort, PasswordHasherPort, SessionStorePort, TokenSignerPort,
  DomainEventPublisherPort,
} from './ports/outbound';

export class InvalidCurrentPasswordError extends Error {
  constructor() { super('Current password is incorrect'); this.name = 'InvalidCurrentPasswordError'; }
}

export class ChangePasswordService {
  private readonly policy = new CredentialPolicy();

  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly sessions: SessionStorePort,
    private readonly signer: TokenSignerPort,
    private readonly events: DomainEventPublisherPort,
  ) {}

  // Verifies the current password, enforces strength, rotates the credential, and
  // revokes the user's other sessions (the calling session stays alive).
  async change(input: { currentSessionToken: string; currentPassword: string; newPassword: string }): Promise<{ sessionsRevoked: number }> {
    const claims = await this.signer.verify(input.currentSessionToken);
    if (!claims) throw new Error('Not authenticated');
    const session = await this.sessions.findById(claims.sessionId);
    if (!session) throw new Error('Not authenticated');

    const user = await this.users.findById(session.userId);
    if (!user) throw new Error('Not authenticated');

    const ok = await this.hasher.verify(input.currentPassword, user.credentialHash);
    if (!ok) throw new InvalidCurrentPasswordError();

    this.policy.assertStrong(input.newPassword);
    const hash = await this.hasher.hash(input.newPassword);
    user.changeCredential(hash);
    await this.users.save(user);

    const sessionsRevoked = await this.sessions.revokeOthersForUser(user.id, session.id);
    await this.events.publish({ type: 'UserPasswordChanged', payload: { userId: user.id } });
    return { sessionsRevoked };
  }
}
