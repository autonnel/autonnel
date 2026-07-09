import { getConfig } from '@/lib/config/get-config';
import { SenderIdentity, type ChannelType } from '../domain/value-objects';
import type { TenantConfigPort, ResolvedSender } from '../application/ports/outbound';

interface EmailConfig {
  provider?: string;
  fallbackProvider?: string;
  fromAddress?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  unsubscribeBaseUrl?: string;
}

export class TenantConfigAdapter implements TenantConfigPort {
  async channelProviders(_channel: ChannelType): Promise<{ primary: string; fallback?: string }> {
    const cfg = ((await getConfig('email.config')) as EmailConfig) ?? {};
    const primary = cfg.provider ?? 'resend';
    return cfg.fallbackProvider ? { primary, fallback: cfg.fallbackProvider } : { primary };
  }

  async defaultSender(_channel: ChannelType): Promise<ResolvedSender> {
    const cfg = ((await getConfig('email.config')) as EmailConfig) ?? {};
    const fromAddress = cfg.fromAddress ?? cfg.fromEmail;
    if (!fromAddress) throw new Error('email.config.fromAddress not configured');
    return {
      senderIdentityId: fromAddress,
      // OSS assumes the from-address is DKIM/SPF-verified by the tenant; SaaS verifies out-of-band.
      sender: SenderIdentity.of({ fromAddress, fromName: cfg.fromName, replyTo: cfg.replyTo, verified: true }),
    };
  }

  async unsubscribeBaseUrl(): Promise<string> {
    const cfg = ((await getConfig('email.config')) as EmailConfig) ?? {};
    return cfg.unsubscribeBaseUrl ?? 'https://localhost/u';
  }
}
