import { TemplateVersion } from '../../domain/message-template';
import { ChannelType } from '../../domain/value-objects';
import { VariableSchema } from '../../domain/variable-schema';
import { getDefaultTemplate } from '@/lib/email-templates/default-templates';
import { typeForMessagingKey, requiredCoreVars } from '@/lib/email-templates/template-key-map';
import { parsedVariableDecls, withRequired } from '@/lib/email-templates/parse-variables';

// Reserved key for the system-driven event-notification fan-out (Settings -> Notifications). It is
// not a customer lifecycle template, so it stays out of the email-template editor catalog and
// renders the caller-supplied subject/body verbatim from variables.
export const GENERIC_NOTIFICATION_KEY = 'notification.event';

function genericNotificationVersion(locale: string): TemplateVersion {
  const subject = '{{subject}}';
  const html = '<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;">{{body}}</pre>';
  const text = '{{body}}';
  const decls = [
    { name: 'subject', required: true },
    { name: 'body', required: true },
  ];
  return new TemplateVersion('default', ChannelType.EMAIL, locale, subject, html, text, VariableSchema.of(decls), true);
}

// Builds an in-memory published email version from the styled lib/email-templates default for a
// messaging key + locale. Returns null when the key has no styled default (unknown key). Used as
// the send-path fallback when the DB holds no customization, so defaults are never seeded.
export async function buildDefaultVersion(
  messagingKey: string,
  locale: string,
): Promise<TemplateVersion | null> {
  if (messagingKey === GENERIC_NOTIFICATION_KEY) return genericNotificationVersion(locale);

  const type = typeForMessagingKey(messagingKey);
  if (!type) return null;

  const def = await getDefaultTemplate(type, locale);
  const decls = withRequired(parsedVariableDecls(def.subject, def.content), requiredCoreVars(messagingKey));

  return new TemplateVersion(
    'default',
    ChannelType.EMAIL,
    locale,
    def.subject,
    def.content,
    '',
    VariableSchema.of(decls),
    true,
  );
}
