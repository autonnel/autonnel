// Credentials are masked on read — never returned in plaintext.
import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import {
  getEmailConfigRepository,
  type CreateEmailConfigInput,
  type UpdateEmailConfigInput,
} from '@/lib/repositories/email.repository';
import type { EmailConfigWire } from '@/contracts/settings';

const repo = getEmailConfigRepository();

function toWire(config: { id: string; provider: string; name: string; fromEmail: string; fromName: string | null; replyTo: string | null; isActive: boolean; createdAt?: Date; updatedAt?: Date }, maskedCredentials?: Record<string, unknown>): EmailConfigWire {
  return {
    id: config.id,
    provider: config.provider as EmailConfigWire['provider'],
    name: config.name,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    replyTo: config.replyTo,
    isActive: config.isActive,
    maskedCredentials,
    createdAt: config.createdAt ? config.createdAt.toISOString() : undefined,
    updatedAt: config.updatedAt ? config.updatedAt.toISOString() : undefined,
  };
}

export const GET = defineRoute('GET /api/settings/email', { feature: 'SETTINGS_EMAIL' }, async (): Promise<EmailConfigWire | null> => {
  const config = await repo.find();
  if (!config) return null;

  const fullConfig = await repo.findWithCredentials();
  let maskedCredentials: Record<string, unknown> | undefined;
  if (fullConfig) {
    const creds = fullConfig.credentials;
    if (config.provider === 'SMTP' && 'host' in creds) {
      maskedCredentials = {
        host: creds.host,
        port: creds.port,
        username: creds.username,
        secure: creds.secure,
        password: '••••••••',
      };
    } else if (config.provider === 'RESEND' && 'apiKey' in creds) {
      maskedCredentials = { apiKey: (creds.apiKey as string).slice(0, 4) + '••••••••' };
    }
  }
  return toWire(config, maskedCredentials);
});

export const PUT = defineRoute('PUT /api/settings/email', { feature: 'SETTINGS_EMAIL', status: 200 }, async ({ input }): Promise<EmailConfigWire> => {
  const { provider, credentials, fromEmail, fromName, replyTo, isActive } = input ?? {};
  const existing = await repo.find();

  if (existing) {
    const updateData: UpdateEmailConfigInput = {};
    if (provider !== undefined) {
      updateData.provider = provider;
      updateData.name = provider === 'SMTP' ? 'SMTP Configuration' : 'Resend Configuration';
    }
    if (credentials !== undefined) updateData.credentials = credentials as UpdateEmailConfigInput['credentials'];
    if (fromEmail !== undefined) updateData.fromEmail = fromEmail;
    if (fromName !== undefined) updateData.fromName = fromName;
    if (replyTo !== undefined) updateData.replyTo = replyTo;
    if (isActive !== undefined) updateData.isActive = isActive;
    const updated = await repo.update(updateData);
    return toWire(updated);
  }

  if (!provider || !['SMTP', 'RESEND'].includes(provider)) throw new ApiError(400, 'Invalid provider. Must be SMTP or RESEND');
  if (!fromEmail) throw new ApiError(400, 'fromEmail is required');
  if (!credentials) throw new ApiError(400, 'credentials are required');
  const c = credentials as Record<string, unknown>;
  if (provider === 'SMTP') {
    if (!c.host || !c.port || !c.username || !c.password) throw new ApiError(400, 'SMTP requires host, port, username, and password');
  } else if (provider === 'RESEND') {
    if (!c.apiKey) throw new ApiError(400, 'Resend requires apiKey');
  }

  const createInput: CreateEmailConfigInput = {
    provider,
    name: provider === 'SMTP' ? 'SMTP Configuration' : 'Resend Configuration',
    credentials: credentials as unknown as CreateEmailConfigInput['credentials'],
    fromEmail,
    fromName,
    replyTo,
  };
  const created = await repo.upsert(createInput);
  return toWire(created);
});

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_EMAIL, async () => {
  await repo.delete();
  return jsonResponse({ success: true });
});
