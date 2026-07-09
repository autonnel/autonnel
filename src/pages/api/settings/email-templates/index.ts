import type { APIRoute } from 'astro';
import type { EmailTemplateType } from '@/lib/email-templates/types';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getDefaultTemplate, getTemplateTypeLabels } from '@/lib/email-templates/default-templates';
import { EMAIL_TEMPLATE_VARIABLES, TEMPLATE_TYPE_VARIABLES } from '@/lib/email-templates/variables';
import { messagingKeyForType, requiredCoreVars } from '@/lib/email-templates/template-key-map';
import { parsedVariableDecls, withRequired } from '@/lib/email-templates/parse-variables';
import { getConfig, setConfig } from '@/lib/config/get-config';
import { makeMessaging } from '@/composition/make-messaging';
import { ChannelType } from '@/modules/messaging/domain/value-objects';
import { createLogger } from '@/lib/logger';
import type { EmailTemplateUpsertResult } from '@/contracts/settings';

const logger = createLogger('EmailTemplatesAPI');

const designConfigKey = (msgKey: string, lang: string) => `email_template.design.${msgKey}.${lang}`;

interface OverrideLookup {
  isCustomized: boolean;
  subject?: string;
  html?: string;
}

// The messaging store holds a published email version for this template/locale iff the user saved
// a customization; returns its subject/html so the editor can load the saved copy.
async function findPublishedOverride(templateType: EmailTemplateType, lang: string): Promise<OverrideLookup> {
  try {
    const msgKey = messagingKeyForType(templateType);
    const { manageTemplate } = makeMessaging();
    const tpl = await manageTemplate.getTemplate(msgKey);
    const version = tpl?.versions.find(
      (v) => v.published && v.channel === ChannelType.EMAIL && v.locale === lang,
    );
    if (!version) return { isCustomized: false };
    return { isCustomized: true, subject: version.subject };
  } catch (err) {
    logger.warn('messaging template lookup failed', { error: err, templateType });
    return { isCustomized: false };
  }
}

async function hasPublishedOverride(templateType: EmailTemplateType, lang: string): Promise<boolean> {
  return (await findPublishedOverride(templateType, lang)).isCustomized;
}

const VALID_TEMPLATE_TYPES: EmailTemplateType[] = [
  'ORDER_RECEIPT',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'ORDER_REFUNDED',
  'RECALL_1',
  'RECALL_2',
  'RECALL_3',
];

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'];

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_EMAIL, async (ctx) => {
  const url = new URL(ctx.request.url);
  const templateType = url.searchParams.get('type') as EmailTemplateType | null;
  const language = url.searchParams.get('lang') || 'en';
  const includeDefaults = url.searchParams.get('includeDefaults') === 'true';
  const includeVariables = url.searchParams.get('includeVariables') === 'true';
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

  if (templateType) {
    if (!VALID_TEMPLATE_TYPES.includes(templateType)) return jsonError('Invalid template type', 400);

    const override = await findPublishedOverride(templateType, lang);
    const defaultTemplate = await getDefaultTemplate(templateType, lang);

    let savedTemplate: Record<string, unknown> | null = null;
    if (override.isCustomized) {
      const msgKey = messagingKeyForType(templateType);
      const design = await getConfig(designConfigKey(msgKey, lang));
      savedTemplate = {
        name: defaultTemplate.name,
        subject: override.subject ?? defaultTemplate.subject,
        design: design ?? defaultTemplate.design,
        content: defaultTemplate.content,
      };
    }

    const response: Record<string, unknown> = {
      template: savedTemplate,
      default: defaultTemplate,
      isCustomized: override.isCustomized,
      language: lang,
    };

    if (includeVariables && TEMPLATE_TYPE_VARIABLES[templateType]) {
      response.availableVariables = TEMPLATE_TYPE_VARIABLES[templateType].map((key) => {
        const varInfo = EMAIL_TEMPLATE_VARIABLES.find((v) => v.key === key);
        return varInfo || { key, label: key, category: 'Other', example: '' };
      });
    }
    return jsonResponse(response);
  }

  const allTemplates = await Promise.all(
    VALID_TEMPLATE_TYPES.map(async (type) => {
      const defaultTemplate = await getDefaultTemplate(type, lang);
      const isCustomized = await hasPublishedOverride(type, lang);
      return {
        type,
        name: defaultTemplate.name,
        template: null,
        default: includeDefaults ? defaultTemplate : undefined,
        isCustomized,
        isActive: true,
      };
    }),
  );

  const response: Record<string, unknown> = {
    templates: allTemplates,
    templateTypes: getTemplateTypeLabels(),
    language: lang,
  };
  if (includeVariables) response.allVariables = EMAIL_TEMPLATE_VARIABLES;
  return jsonResponse(response);
});

export const POST = defineRoute('POST /api/settings/email-templates', { feature: 'SETTINGS_EMAIL' }, async ({ input }): Promise<EmailTemplateUpsertResult> => {
  const { templateType, name, subject, content, design, isActive, language } = input ?? {};

  if (!templateType || !VALID_TEMPLATE_TYPES.includes(templateType as EmailTemplateType)) {
    throw new ApiError(400, 'Invalid or missing templateType');
  }
  if (!name || !subject || !content) throw new ApiError(400, 'name, subject, and content are required');
  const lang = language && SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  void isActive;

  const msgKey = messagingKeyForType(templateType as EmailTemplateType);
  // Declare every variable referenced in subject/content so addDraft/publish validation passes,
  // and promote the lifecycle core vars to required so a customization can't silently send blank.
  const variables = withRequired(parsedVariableDecls(subject, content), requiredCoreVars(msgKey));

  let versionId = '';
  try {
    const { manageTemplate } = makeMessaging();
    const { versionId: vid } = await manageTemplate.upsertDraft({
      templateKey: msgKey,
      channel: ChannelType.EMAIL,
      locale: lang,
      subject,
      html: content,
      text: '',
      variables,
    });
    versionId = vid;
    await manageTemplate.publishVersion(msgKey, vid);
    // Persist the easy-email design JSON so the editor can reload the visual customization.
    if (design !== undefined) await setConfig(designConfigKey(msgKey, lang), design);
  } catch (err) {
    logger.warn('messaging template persist failed', { error: err, templateType });
  }

  return { ok: true, templateType: templateType as EmailTemplateType, versionId };
});
