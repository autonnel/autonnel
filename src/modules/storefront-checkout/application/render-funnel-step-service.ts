import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { FunnelSession } from '../domain/funnel-session';
import type { AttributionReaderPort, FunnelSessionStorePort, FunnelSnapshotReaderPort } from './ports/outbound';
import type { FunnelHttpPort, RenderStepResult } from './ports/inbound';

export interface RenderFunnelStepDeps {
  snapshots: FunnelSnapshotReaderPort;
  sessions: FunnelSessionStorePort;
  attribution: AttributionReaderPort;
  newSessionId: () => string;
  tenantId: string;
  ttlSeconds: number;
}

export class RenderFunnelStepService implements FunnelHttpPort {
  constructor(private readonly deps: RenderFunnelStepDeps) {}

  async renderStep(stepSlug: string, sessionCookie: string | null): Promise<RenderStepResult> {
    const snapshot = await this.deps.snapshots.loadByStepSlug(stepSlug);
    if (!snapshot) throw new Error(`Funnel step not found: ${stepSlug}`);

    let session: FunnelSession | null = null;
    if (sessionCookie) {
      const sessionId = await this.deps.sessions.verifyCookieValue(sessionCookie);
      if (sessionId) session = await this.deps.sessions.load(sessionId);
    }
    if (!session) {
      const sessionId = this.deps.newSessionId();
      const attr = await this.deps.attribution.read(sessionId);
      session = FunnelSession.start({
        sessionId,
        tenantId: this.deps.tenantId,
        snapshotRef: FunnelSnapshotRef.of(snapshot.funnelId, snapshot.version),
        stepSlugs: snapshot.stepSlugs.map((s) => StepSlug.of(s)),
        attribution: attr ? AttributionSnapshot.create({ ...attr, sessionId }) : AttributionSnapshot.empty(sessionId),
        entryStep: StepSlug.of(stepSlug),
      });
      await this.deps.sessions.store(session, this.deps.ttlSeconds);
    } else {
      session.moveTo(StepSlug.of(stepSlug));
      await this.deps.sessions.store(session, this.deps.ttlSeconds);
    }

    return {
      html: snapshot.pageHtmlByStep[stepSlug],
      funnelId: snapshot.funnelId,
      version: snapshot.version,
      currentStep: stepSlug,
    };
  }
}
