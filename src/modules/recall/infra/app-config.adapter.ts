import type { AppConfigPort, RecallConfig } from '../application/ports';

export interface ConfigQuery {
  getConfig(key: string, envFallback?: unknown): Promise<unknown>;
}

const DEFAULT_CONFIG: RecallConfig = { enabled: true, quietHours: null, attributionWindowHours: 48 };

export class AppConfigAdapter implements AppConfigPort {
  constructor(private readonly config: ConfigQuery) {}
  async getRecallConfig(): Promise<RecallConfig> {
    const raw = (await this.config.getConfig('recall.config', DEFAULT_CONFIG)) as Partial<RecallConfig> | null;
    return { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  }
}
