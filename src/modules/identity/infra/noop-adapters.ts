import { createLogger } from '@/lib/logger';
import type {
  DomainEventPublisherPort,
  NotificationPort,
  AppConfigPort,
} from '../application/ports/outbound';

const log = createLogger('Identity:noop');

// workerd has no Node `process`; fall back to an empty bag so EnvAppConfig never throws.
const safeEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

export class NoopDomainEventPublisher implements DomainEventPublisherPort {
  async publish(event: { type: string; payload: Record<string, unknown> }): Promise<void> {
    log.debug('domain event (noop publisher)', { type: event.type });
  }
}

export class NoopNotificationPort implements NotificationPort {
  async sendAccountEmail(input: {
    to: string;
    templateKey: string;
    vars: Record<string, unknown>;
  }): Promise<void> {
    log.debug('account email (noop)', { to: input.to, templateKey: input.templateKey });
  }
}

export class EnvAppConfig implements AppConfigPort {
  constructor(private readonly env: Record<string, string | undefined> = safeEnv) {}

  async get(key: string, envFallback?: string): Promise<string | null> {
    return this.env[key] ?? envFallback ?? null;
  }
}
