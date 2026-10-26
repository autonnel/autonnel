import { defineRoute, ApiError } from '@/lib/api/define-route';
import { sendAdHocEmail } from '@/composition/make-messaging';
import type { NotificationTestResult } from '@/contracts/settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = defineRoute('POST /api/settings/email/test', { feature: 'SETTINGS_EMAIL' }, async ({ input }): Promise<NotificationTestResult> => {
  const to = typeof input?.to === 'string' ? input.to.trim() : '';
  if (!EMAIL_RE.test(to)) throw new ApiError(400, 'A valid recipient email is required');
  try {
    await sendAdHocEmail({
      to,
      subject: '[Autonnel] Test email',
      html: '<p>This is a test email from Autonnel. Your email provider is configured correctly.</p>',
      text: 'This is a test email from Autonnel. Your email provider is configured correctly.',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
