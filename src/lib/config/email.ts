// provider is a local union persisted in the AppConfig KV (`email.config`)
export type EmailProvider = 'SMTP' | 'RESEND';
import { getConfig, setConfig, deleteConfig } from './get-config';
import {
  encryptCredentials,
  decryptCredentials,
} from '@/lib/services/credentials-crypto';

export const EMAIL_KV_KEY = 'email.config';

export interface SmtpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  secure?: boolean;
}

export interface ResendCredentials {
  apiKey: string;
}

export type EmailCredentials = SmtpCredentials | ResendCredentials;

export interface EmailKvEntry {
  id: string;
  provider: EmailProvider;
  name: string;
  credentials: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailConfigPublic {
  id: string;
  provider: EmailProvider;
  name: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailConfigWithCredentials extends EmailConfigPublic {
  credentials: EmailCredentials;
}

export interface UpsertEmailConfigInput {
  provider: EmailProvider;
  name: string;
  credentials: EmailCredentials;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
  isActive?: boolean;
}

export interface UpdateEmailConfigInput {
  provider?: EmailProvider;
  name?: string;
  credentials?: Partial<SmtpCredentials> | Partial<ResendCredentials>;
  fromEmail?: string;
  fromName?: string | null;
  replyTo?: string | null;
  isActive?: boolean;
}

function newId(): string {
  return `ec_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
}

function toPublic(entry: EmailKvEntry): EmailConfigPublic {
  return {
    id: entry.id,
    provider: entry.provider,
    name: entry.name,
    fromEmail: entry.fromEmail,
    fromName: entry.fromName,
    replyTo: entry.replyTo,
    isActive: entry.isActive,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}

async function readEntry(): Promise<EmailKvEntry | null> {
  const stored = await getConfig<EmailKvEntry>(EMAIL_KV_KEY);
  return stored && typeof stored === 'object' && typeof stored.id === 'string' ? stored : null;
}

export async function getEmailKvConfig(): Promise<EmailConfigPublic | null> {
  const entry = await readEntry();
  return entry ? toPublic(entry) : null;
}

export async function getEmailKvConfigWithCredentials(): Promise<EmailConfigWithCredentials | null> {
  const entry = await readEntry();
  if (!entry) return null;
  return {
    ...toPublic(entry),
    credentials: decryptCredentials<EmailCredentials>(entry.credentials),
  };
}

export async function upsertEmailKvConfig(
  input: UpsertEmailConfigInput,
): Promise<EmailConfigPublic> {
  const existing = await readEntry();
  const now = new Date().toISOString();
  const next: EmailKvEntry = {
    id: existing?.id ?? newId(),
    provider: input.provider,
    name: input.name,
    credentials: encryptCredentials(input.credentials),
    fromEmail: input.fromEmail,
    fromName: input.fromName ?? null,
    replyTo: input.replyTo ?? null,
    isActive: input.isActive ?? existing?.isActive ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await setConfig(EMAIL_KV_KEY, next);
  return toPublic(next);
}

export async function updateEmailKvConfig(
  input: UpdateEmailConfigInput,
): Promise<EmailConfigPublic> {
  const existing = await readEntry();
  if (!existing) throw new Error('No email config to update');

  const next: EmailKvEntry = { ...existing, updatedAt: new Date().toISOString() };
  if (input.provider !== undefined) next.provider = input.provider;
  if (input.name !== undefined) next.name = input.name;
  if (input.fromEmail !== undefined) next.fromEmail = input.fromEmail;
  if (input.fromName !== undefined) next.fromName = input.fromName;
  if (input.replyTo !== undefined) next.replyTo = input.replyTo;
  if (input.isActive !== undefined) next.isActive = input.isActive;

  if (input.credentials !== undefined) {
    const merged = {
      ...(decryptCredentials<Record<string, unknown>>(existing.credentials)),
      ...input.credentials,
    };
    next.credentials = encryptCredentials(merged);
  }

  await setConfig(EMAIL_KV_KEY, next);
  return toPublic(next);
}

export async function deleteEmailKvConfig(): Promise<void> {
  await deleteConfig(EMAIL_KV_KEY);
}
