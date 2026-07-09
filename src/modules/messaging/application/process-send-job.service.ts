import { TemplateRenderer } from '../domain/services/template-renderer';
import { SuppressionPolicy } from '../domain/services/suppression-policy';
import { RetryPolicy } from '../domain/services/retry-policy';
import { ProviderRouter } from '../domain/services/provider-router';
import { ChannelType, DispatchStatus } from '../domain/value-objects';
import { buildDefaultVersion } from '../infra/templates/default-version.factory';
import { makeEnvelope } from '@/modules/shared-kernel';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { MessagingEvent } from '../domain/events';
import type {
  DispatchRepositoryPort, TemplateRepositoryPort, SuppressionRepositoryPort,
  TenantConfigPort, MessageDeliveryProviderPort, EventPublisherPort, ClockPort,
} from './ports/outbound';

const logger = createLogger('Messaging:ProcessSendJob');

export interface ProcessSendInput {
  locale: string;
  variables: Record<string, unknown>;
  unsubscribeUrl?: string;
}

export class ProcessSendJobService {
  private readonly renderer = new TemplateRenderer();
  private readonly suppressionPolicy = new SuppressionPolicy();
  private readonly retryPolicy = new RetryPolicy();
  private readonly router = new ProviderRouter();

  constructor(
    private readonly dispatches: DispatchRepositoryPort,
    private readonly templates: TemplateRepositoryPort,
    private readonly suppressions: SuppressionRepositoryPort,
    private readonly config: TenantConfigPort,
    private readonly providers: Map<string, MessageDeliveryProviderPort>,
    private readonly events: EventPublisherPort,
    private readonly clock: ClockPort,
  ) {}

  async processSend(dispatchId: string, input: ProcessSendInput): Promise<{ status: DispatchStatus }> {
    const tenantId = getCurrentTenantId();
    const dispatch = await this.dispatches.findById(dispatchId);
    if (!dispatch) throw new Error(`dispatch not found: ${dispatchId}`);
    if (dispatch.status === DispatchStatus.SENT || dispatch.status === DispatchStatus.DELIVERED) {
      return { status: dispatch.status }; // idempotent: already sent
    }

    // Re-check suppression immediately before sending.
    const entries = await this.suppressions.findForAddress(dispatch.recipient);
    if (this.suppressionPolicy.isSuppressed(dispatch.recipient, entries)) {
      dispatch.suppress();
      await this.dispatches.save(dispatch);
      await this.events.publish(makeEnvelope(MessagingEvent.NotificationSuppressed, tenantId, { dispatchId }));
      return { status: DispatchStatus.SUPPRESSED };
    }

    // Reuse persisted rendered snapshot on retry.
    let rendered = dispatch.rendered;
    const { senderIdentityId, sender } = await this.config.defaultSender(dispatch.channel);
    if (!rendered) {
      const template = await this.templates.findByKey(dispatch.templateKey.value);
      let version = template?.currentPublished(dispatch.channel, input.locale)
        ?? template?.currentPublished(dispatch.channel, 'en');
      if (!version && dispatch.channel === ChannelType.EMAIL) {
        version = (await buildDefaultVersion(dispatch.templateKey.value, input.locale))
          ?? (await buildDefaultVersion(dispatch.templateKey.value, 'en'))
          ?? undefined;
      }
      if (!version) throw new Error(`no template version: ${dispatch.templateKey.value}/${dispatch.channel}`);
      const base = await this.config.unsubscribeBaseUrl();
      rendered = this.renderer.render(version, input.variables, {
        unsubscribeUrl: input.unsubscribeUrl ?? `${base}/${encodeURIComponent(dispatch.recipient.normalized)}`,
      });
      dispatch.attachRendered(rendered, sender);
      (dispatch as any).senderIdentityId = senderIdentityId;
      await this.dispatches.save(dispatch);
    }

    const providerConfig = await this.config.channelProviders(dispatch.channel);
    const order = this.router.route(dispatch.channel, providerConfig);

    let lastError: Error | undefined;
    let lastTransient = false;
    for (const slug of order) {
      const provider = this.providers.get(slug);
      if (!provider) { lastError = new Error(`provider not wired: ${slug}`); continue; }
      try {
        dispatch.markAttempt();
        const result = await provider.send({
          from: sender.fromAddress, fromName: sender.fromName, replyTo: sender.replyTo,
          to: dispatch.recipient.normalized, subject: rendered.subject, html: rendered.html,
          text: rendered.text, headers: { ...rendered.headers },
        });
        dispatch.markSent({ providerSlug: slug, providerMessageId: result.providerMessageId });
        await this.dispatches.save(dispatch);
        await this.events.publish(makeEnvelope(MessagingEvent.NotificationSent, tenantId, {
          dispatchId, providerSlug: slug, providerMessageId: result.providerMessageId,
        }, { causationId: dispatch.correlation.sourceEventId }));
        return { status: DispatchStatus.SENT };
      } catch (err) {
        lastError = err as Error;
        lastTransient = this.retryPolicy.isTransient({ httpStatus: (err as any).httpStatus, network: (err as any).network });
        logger.warn('provider send failed', { dispatchId, slug, transient: lastTransient, error: err });
        if (!lastTransient) break; // permanent: do not try fallback
      }
    }

    dispatch.markFailed(lastError?.message ?? 'send failed', lastTransient);
    await this.dispatches.save(dispatch);
    if (!lastTransient) {
      await this.events.publish(makeEnvelope(MessagingEvent.NotificationFailed, tenantId, { dispatchId, error: lastError?.message }));
    }
    return { status: DispatchStatus.FAILED };
  }
}
