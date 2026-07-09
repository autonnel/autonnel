import {
  getEmailKvConfig,
  getEmailKvConfigWithCredentials,
  upsertEmailKvConfig,
  updateEmailKvConfig,
  deleteEmailKvConfig,
  type EmailProvider,
  type SmtpCredentials,
  type ResendCredentials,
  type EmailConfigPublic,
  type EmailConfigWithCredentials,
} from '@/lib/config/email';

export type { EmailConfigPublic, EmailConfigWithCredentials };

export interface CreateEmailConfigInput {
  provider: EmailProvider;
  name: string;
  credentials: SmtpCredentials | ResendCredentials;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
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

export interface IEmailConfigRepository {
  upsert(data: CreateEmailConfigInput): Promise<EmailConfigPublic>;
  find(): Promise<EmailConfigPublic | null>;
  findWithCredentials(): Promise<EmailConfigWithCredentials | null>;
  update(data: UpdateEmailConfigInput): Promise<EmailConfigPublic>;
  delete(): Promise<void>;
}

export class KvEmailConfigRepository implements IEmailConfigRepository {
  async upsert(data: CreateEmailConfigInput): Promise<EmailConfigPublic> {
    return upsertEmailKvConfig({
      provider: data.provider,
      name: data.name,
      credentials: data.credentials,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      replyTo: data.replyTo,
    });
  }

  async find(): Promise<EmailConfigPublic | null> {
    return getEmailKvConfig();
  }

  async findWithCredentials(): Promise<EmailConfigWithCredentials | null> {
    return getEmailKvConfigWithCredentials();
  }

  async update(data: UpdateEmailConfigInput): Promise<EmailConfigPublic> {
    return updateEmailKvConfig(data);
  }

  async delete(): Promise<void> {
    await deleteEmailKvConfig();
  }
}

let emailConfigRepo: IEmailConfigRepository | null = null;

export function getEmailConfigRepository(): IEmailConfigRepository {
  if (!emailConfigRepo) {
    emailConfigRepo = new KvEmailConfigRepository();
  }
  return emailConfigRepo;
}
