import { SuppressionEntry } from '../domain/suppression';
import type { ClockPort } from '../domain/ports';
import type { SuppressionRepository } from './ports';
import type { SuppressionScopeValue } from '../domain/value-objects';

export class ManageSuppressionService {
  constructor(
    private readonly suppressions: SuppressionRepository,
    private readonly clock: ClockPort,
  ) {}

  async list(): Promise<SuppressionEntry[]> {
    return this.suppressions.list();
  }

  async block(scope: SuppressionScopeValue, subjectKey: string): Promise<SuppressionEntry> {
    return this.suppressions.upsert(
      SuppressionEntry.create({ scope, subjectKey, reason: 'manual', source: 'manual_admin', expiresAt: null }, this.clock.now()),
    );
  }

  async unblock(scope: SuppressionScopeValue, subjectKey: string): Promise<void> {
    await this.suppressions.remove(scope, subjectKey);
  }
}
