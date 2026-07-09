import { createHmac } from 'node:crypto';
import { createLogger } from '@/lib/logger';
import type { NotificationPairing } from '@/lib/services/notification-routing-types';
import { safeFetch } from '@/lib/utils/safe-url';

const logger = createLogger('NotificationDispatcher');

const HTTP_TIMEOUT_MS = 10_000;
const MAX_LOG_CONTENT_LENGTH = 8000;

export type NotificationChannel = 'email' | 'slack' | 'webhook';

export interface DispatchResult {
  channel: NotificationChannel;
  status: 'sent' | 'failed';
  error?: string;
}

function truncate(s: string, max = MAX_LOG_CONTENT_LENGTH): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

async function recordLog(args: {
  tenantId: string;
  channel: NotificationChannel;
  purpose: string;
  recipient: string;
  subject?: string;
  content: string;
  status: 'sent' | 'failed';
  error?: string;
}): Promise<void> {
  logger.info('notification dispatch', {
    tenantId: args.tenantId,
    channel: args.channel,
    purpose: args.purpose,
    recipient: args.recipient,
    subject: args.subject,
    status: args.status,
    error: args.error ? truncate(args.error, 2000) : undefined,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return safeFetch(url, {
    timeoutMs: HTTP_TIMEOUT_MS,
    maxBytes: MAX_LOG_CONTENT_LENGTH,
    method: init.method,
    headers: init.headers,
    body: init.body as BodyInit | undefined,
  });
}

function computeSignature(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type EmailSender = (input: { to: string; subject: string; html: string; text: string }) => Promise<void>;

export async function dispatchEmail(args: {
  tenantId: string;
  purpose: string;
  subject: string;
  body: string;
  htmlBody?: string;
  recipients: string[];
  send: EmailSender;
}): Promise<DispatchResult> {
  if (args.recipients.length === 0) {
    return { channel: 'email', status: 'failed', error: 'No recipients configured' };
  }

  let lastError: string | undefined;
  let queued = 0;
  for (const recipient of args.recipients) {
    try {
      const html =
        args.htmlBody ??
        `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap;">${escapeHtml(args.body)}</pre>`;
      await args.send({ to: recipient, subject: args.subject, html, text: args.body });

      await recordLog({
        tenantId: args.tenantId,
        channel: 'email',
        purpose: args.purpose,
        recipient,
        subject: args.subject,
        content: args.body,
        status: 'sent',
      });
      queued++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await recordLog({
        tenantId: args.tenantId,
        channel: 'email',
        purpose: args.purpose,
        recipient,
        subject: args.subject,
        content: args.body,
        status: 'failed',
        error,
      });
      lastError = error;
    }
  }

  if (queued === 0) {
    return { channel: 'email', status: 'failed', error: lastError ?? 'All recipients failed' };
  }
  return { channel: 'email', status: 'sent' };
}

export async function dispatchSlack(args: {
  tenantId: string;
  purpose: string;
  subject: string;
  body: string;
  webhookUrl: string;
}): Promise<DispatchResult> {
  const text = `${args.subject}\n\n${args.body}`;
  try {
    const res = await fetchWithTimeout(args.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const error = `HTTP ${res.status} ${res.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}`;
      await recordLog({
        tenantId: args.tenantId,
        channel: 'slack',
        purpose: args.purpose,
        recipient: args.webhookUrl,
        subject: args.subject,
        content: text,
        status: 'failed',
        error,
      });
      return { channel: 'slack', status: 'failed', error };
    }
    await recordLog({
      tenantId: args.tenantId,
      channel: 'slack',
      purpose: args.purpose,
      recipient: args.webhookUrl,
      subject: args.subject,
      content: text,
      status: 'sent',
    });
    return { channel: 'slack', status: 'sent' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordLog({
      tenantId: args.tenantId,
      channel: 'slack',
      purpose: args.purpose,
      recipient: args.webhookUrl,
      subject: args.subject,
      content: text,
      status: 'failed',
      error,
    });
    return { channel: 'slack', status: 'failed', error };
  }
}

export async function dispatchWebhook(args: {
  tenantId: string;
  purpose: string;
  subject: string;
  body: string;
  url: string;
  secret?: string;
}): Promise<DispatchResult> {
  const payload = {
    purpose: args.purpose,
    subject: args.subject,
    body: args.body,
    timestamp: new Date().toISOString(),
  };
  const bodyStr = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args.secret) {
    headers['X-Webhook-Signature'] = computeSignature(args.secret, bodyStr);
  }

  try {
    const res = await fetchWithTimeout(args.url, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const error = `HTTP ${res.status} ${res.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}`;
      await recordLog({
        tenantId: args.tenantId,
        channel: 'webhook',
        purpose: args.purpose,
        recipient: args.url,
        subject: args.subject,
        content: bodyStr,
        status: 'failed',
        error,
      });
      return { channel: 'webhook', status: 'failed', error };
    }
    await recordLog({
      tenantId: args.tenantId,
      channel: 'webhook',
      purpose: args.purpose,
      recipient: args.url,
      subject: args.subject,
      content: bodyStr,
      status: 'sent',
    });
    return { channel: 'webhook', status: 'sent' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordLog({
      tenantId: args.tenantId,
      channel: 'webhook',
      purpose: args.purpose,
      recipient: args.url,
      subject: args.subject,
      content: bodyStr,
      status: 'failed',
      error,
    });
    return { channel: 'webhook', status: 'failed', error };
  }
}

export async function sendTestNotification(args: {
  tenantId: string;
  pairing: NotificationPairing;
  send: EmailSender;
}): Promise<DispatchResult> {
  const subject = '[Autonnel] Test notification';
  const body = `This is a test notification from Autonnel. If you received this, your ${args.pairing.channel.type} integration is working.`;
  const purpose = 'test';

  switch (args.pairing.channel.type) {
    case 'email':
      return dispatchEmail({
        tenantId: args.tenantId,
        purpose,
        subject,
        body,
        recipients: args.pairing.channel.recipients,
        send: args.send,
      });
    case 'slack':
      if (!args.pairing.channel.webhookUrl) {
        return { channel: 'slack', status: 'failed', error: 'Missing slack webhook URL' };
      }
      return dispatchSlack({
        tenantId: args.tenantId,
        purpose,
        subject,
        body,
        webhookUrl: args.pairing.channel.webhookUrl,
      });
    case 'webhook':
      if (!args.pairing.channel.url) {
        return { channel: 'webhook', status: 'failed', error: 'Missing webhook URL' };
      }
      return dispatchWebhook({
        tenantId: args.tenantId,
        purpose,
        subject,
        body,
        url: args.pairing.channel.url,
        secret: args.pairing.channel.secret,
      });
  }
}

export const _internal = {
  truncate,
  computeSignature,
  MAX_LOG_CONTENT_LENGTH,
};
