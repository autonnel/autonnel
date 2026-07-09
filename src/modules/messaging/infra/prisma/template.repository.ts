import { MessageTemplate, TemplateVersion } from '../../domain/message-template';
import { ChannelType, TemplateKey } from '../../domain/value-objects';
import { VariableSchema, type VariableDecl } from '../../domain/variable-schema';
import type { TemplateRepositoryPort } from '../../application/ports/outbound';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

function rehydrate(row: any): MessageTemplate {
  const versions = (row.versions ?? []).map((v: any) =>
    new TemplateVersion(v.versionId, v.channel as ChannelType, v.locale, v.subject, v.html, v.text, VariableSchema.of(v.variables as VariableDecl[]), v.published),
  );
  return MessageTemplate.rehydrate(row.tenantId, TemplateKey.of(row.templateKey), versions, row.id);
}

// tenantId is auto-injected by the Prisma extension on every write/where.
export class PrismaTemplateRepository implements TemplateRepositoryPort {
  constructor(private readonly db: Client | any) {}

  async findByKey(templateKey: string): Promise<MessageTemplate | null> {
    const row = await this.db.messageTemplate.findFirst({ where: { templateKey }, include: { versions: { orderBy: { createdAt: 'asc' } } } });
    return row ? rehydrate(row) : null;
  }

  async list(): Promise<MessageTemplate[]> {
    const rows = await this.db.messageTemplate.findMany({ include: { versions: true } });
    return rows.map(rehydrate);
  }

  async save(template: MessageTemplate): Promise<MessageTemplate> {
    const tpl = await this.db.messageTemplate.upsert({
      where: template.id ? { id: template.id } : { tenantId_templateKey: { tenantId: template.tenantId, templateKey: template.templateKey.value } },
      create: { templateKey: template.templateKey.value },
      update: {},
    });
    for (const v of template.allVersions()) {
      await this.db.messageTemplateVersion.upsert({
        where: { tenantId_templateId_versionId: { tenantId: template.tenantId, templateId: tpl.id, versionId: v.versionId } },
        create: { templateId: tpl.id, versionId: v.versionId, channel: v.channel, locale: v.locale, subject: v.subject, html: v.html, text: v.text, variables: v.schema.toJSON(), published: v.isPublished },
        update: { subject: v.subject, html: v.html, text: v.text, published: v.isPublished },
      });
    }
    template.id = tpl.id;
    return template;
  }
}
