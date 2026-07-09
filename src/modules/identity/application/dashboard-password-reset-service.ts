import { Email } from '../domain/email';
import { CredentialPolicy } from '../domain/services/credential-policy';
import type { UserRepositoryPort, PasswordHasherPort, SessionStorePort } from './ports/outbound';

export class UserNotFoundError extends Error {
  constructor(email: string) { super(`User not found: ${email}`); this.name = 'UserNotFoundError'; }
}

export class DashboardPasswordResetService {
  private readonly policy = new CredentialPolicy();

  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly sessions: SessionStorePort,
  ) {}

  async reset(input: { email: string; newPassword: string }): Promise<{ userId: string; sessionsRevoked: number }> {
    const user = await this.users.findByEmailGlobal(Email.of(input.email));
    if (!user) throw new UserNotFoundError(input.email);
    this.policy.assertStrong(input.newPassword);
    const hash = await this.hasher.hash(input.newPassword);
    user.changeCredential(hash);
    await this.users.save(user);
    // Empty exceptSessionId matches no row, so every active session is revoked.
    const sessionsRevoked = await this.sessions.revokeOthersForUser(user.id, '');
    return { userId: user.id, sessionsRevoked };
  }
}
