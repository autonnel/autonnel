import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { FunnelSession } from '../domain/funnel-session';
import type { AttributionReaderPort, FunnelSnapshotReaderPort, FunnelSessionStorePort } from './ports/outbound';

export interface StartFunnelSessionDeps {
  snapshots: FunnelSnapshotReaderPort;
  attribution: AttributionReaderPort;
  sessions: FunnelSessionStorePort;
  newSessionId: () => string;
  ttlSeconds: number;
  tenantId: string;
}

export class StartFunnelSessionService {
  constructor(private readonly deps: StartFunnelSessionDeps) {}

  async execute(stepSlug: string): Promise<FunnelSession> {
    const snapshot = await this.deps.snapshots.loadByStepSlug(stepSlug);
    if (!snapshot) throw new Error('No published funnel for step ' + stepSlug);
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
    });
    await this.deps.sessions.store(session, this.deps.ttlSeconds);
    return session;
  }
}
