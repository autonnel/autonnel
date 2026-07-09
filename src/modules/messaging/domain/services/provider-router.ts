import type { ChannelType } from '../value-objects';

export interface ChannelProviderConfig {
  primary: string;
  fallback?: string;
}

export class ProviderRouter {
  route(_channel: ChannelType, config: ChannelProviderConfig): string[] {
    if (!config || !config.primary) throw new Error('no provider configured for channel');
    return config.fallback ? [config.primary, config.fallback] : [config.primary];
  }
}
