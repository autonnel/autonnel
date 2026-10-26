import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { FunnelSession, type SessionMarket } from '../domain/funnel-session';
import type { AttributionReaderPort, FunnelSnapshotReaderPort, FunnelSessionStorePort } from './ports/outbound';

export interface StartFunnelSessionDeps {
  snapshots: FunnelSnapshotReaderPort;
  attribution: AttributionReaderPort;
  sessions: FunnelSessionStorePort;
  newSessionId: () => string;
  ttlSeconds: number;
  tenantId: string;
  // Throws for a currency the checkout cannot sell in, which fails the session start.
  resolveMarket: (currency: string | null) => SessionMarket;
}

export class StartFunnelSessionService {
  constructor(private readonly deps: StartFunnelSessionDeps) {}

  async execute(stepSlug: string): Promise<FunnelSession> {
    const snapshot = await this.deps.snapshots.loadByStepSlug(stepSlug);
    if (!snapshot) throw new Error('No published funnel for step ' + stepSlug);
    const market = this.deps.resolveMarket(snapshot.pageCurrencyByStep[stepSlug] ?? null);
    const sessionId = this.deps.newSessionId();
    const attr = await this.deps.attribution.read(sessionId);
    const session = FunnelSession.start({
      sessionId,
      tenantId: this.deps.tenantId,
      snapshotRef: FunnelSnapshotRef.of(snapshot.funnelId, snapshot.version),
      stepSlugs: snapshot.stepSlugs.map((s) => StepSlug.of(s)),
      attribution: attr
        ? AttributionSnapshot.create({ ...attr, sessionId })
        : AttributionSnapshot.empty(sessionId),
      entryStep: StepSlug.of(stepSlug),
      market,
    });
    await this.deps.sessions.store(session, this.deps.ttlSeconds);
    return session;
  }
}
