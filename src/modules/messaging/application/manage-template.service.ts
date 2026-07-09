import { MessageTemplate } from '../domain/message-template';
import { TemplateKey } from '../domain/value-objects';
import { VariableSchema } from '../domain/variable-schema';
import { makeEnvelope } from '@/modules/shared-kernel';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { MessagingEvent } from '../domain/events';
import type { TemplateDashboardPort, PublishTemplateInput } from './ports/inbound';
import type { TemplateRepositoryPort, EventPublisherPort } from './ports/outbound';
import type { PrincipalResolutionPort } from '@/modules/identity/application/ports/inbound';

const FEATURE = 'SETTINGS_EMAIL';

export class ManageTemplateService implements TemplateDashboardPort {
  constructor(
    private readonly templates: TemplateRepositoryPort,
    private readonly principals: PrincipalResolutionPort,
    private readonly events: EventPublisherPort,
  ) {}

  async listTemplates() {
    this.principals.requireFeature(FEATURE as never);
    const all = await this.templates.list();
    return all.map((t) => ({
      templateKey: t.templateKey.value,
      channels: [...new Set(t.allVersions().map((v) => v.channel))],
      locales: [...new Set(t.allVersions().map((v) => v.locale))],
    }));
  }

  async getTemplate(templateKey: string) {
    this.principals.requireFeature(FEATURE as never);
    const t = await this.templates.findByKey(templateKey);
    if (!t) return null;
    return {
      templateKey: t.templateKey.value,
      versions: t.allVersions().map((v) => ({ versionId: v.versionId, channel: v.channel, locale: v.locale, subject: v.subject, published: v.isPublished })),
    };
  }

  async upsertDraft(input: PublishTemplateInput): Promise<{ versionId: string }> {
    this.principals.requireFeature(FEATURE as never);
    const tenantId = getCurrentTenantId();
    const key = TemplateKey.of(input.templateKey);
    const template = (await this.templates.findByKey(input.templateKey)) ?? MessageTemplate.create({ tenantId, templateKey: key });
    const version = template.addDraft({
      channel: input.channel, locale: input.locale, subject: input.subject, html: input.html, text: input.text,
      schema: VariableSchema.of(input.variables),
    });
    await this.templates.save(template);
    return { versionId: version.versionId };
  }

  async publishVersion(templateKey: string, versionId: string): Promise<void> {
    this.principals.requireFeature(FEATURE as never);
    const tenantId = getCurrentTenantId();
    const template = await this.templates.findByKey(templateKey);
    if (!template) throw new Error(`template not found: ${templateKey}`);
    template.publish(versionId);
    await this.templates.save(template);
    await this.events.publish(makeEnvelope(MessagingEvent.TemplatePublished, tenantId, { templateKey, versionId }));
  }
}
