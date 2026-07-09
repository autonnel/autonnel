import { Invitation, InvitationStatus } from '../domain/invitation';
import type {
  InvitationRepositoryPort, InvitationListItem, MembershipRepositoryPort, SecretGeneratorPort,
  DomainEventPublisherPort, NotificationPort, ClockPort,
} from './ports/outbound';

export class InvitationService {
  constructor(
    private readonly invitations: InvitationRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
    private readonly secrets: SecretGeneratorPort,
    private readonly events: DomainEventPublisherPort,
    private readonly notify: NotificationPort,
    private readonly clock: ClockPort,
  ) {}

  async create(input: { email: string; invitedRoleIds: string[] }): Promise<{ id: string; plaintextToken: string }> {
    const plaintextToken = this.secrets.generatePlaintext();
    const tokenHash = await this.secrets.hashSecret(plaintextToken);
    const now = this.clock.now();
    const invitation = Invitation.rehydrate({
      id: crypto.randomUUID(), email: input.email, invitedRoleIds: input.invitedRoleIds,
      status: InvitationStatus.Pending, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.invitations.save(invitation, tokenHash);
    await this.notify.sendAccountEmail({ to: input.email, templateKey: 'account.invitation', vars: { token: plaintextToken } });
    await this.events.publish({ type: 'InvitationCreated', payload: { invitationId: invitation.id } });
    return { id: invitation.id, plaintextToken };
  }

  async list(): Promise<InvitationListItem[]> {
    return this.invitations.listByTenant();
  }

  async revoke(id: string): Promise<void> {
    const ok = await this.invitations.revokeById(id);
    if (!ok) throw new Error('Invitation not found or not pending');
    await this.events.publish({ type: 'InvitationRevoked', payload: { invitationId: id } });
  }

  async accept(input: { plaintextToken: string; acceptingUserId: string; acceptingEmail: string }): Promise<void> {
    const tokenHash = await this.secrets.hashSecret(input.plaintextToken);
    const found = await this.invitations.findByToken(tokenHash);
    if (!found) throw new Error('Invitation not found');
    found.invitation.accept(input.acceptingEmail, this.clock.now());
    await this.invitations.save(found.invitation, tokenHash);
    await this.events.publish({ type: 'InvitationAccepted', payload: { invitationId: found.invitation.id, userId: input.acceptingUserId } });
  }
}
