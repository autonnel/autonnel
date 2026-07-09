import type { FunnelSnapshotReaderPort, FunnelStepSnapshot } from '../../application/ports/outbound';

export interface PublicationReadPort {
  resolveByStepSlug(stepSlug: string): Promise<FunnelStepSnapshot | null>;
  resolvePinned(funnelId: string, version: number): Promise<FunnelStepSnapshot | null>;
}

export class FunnelSnapshotClient implements FunnelSnapshotReaderPort {
  constructor(private readonly publications: PublicationReadPort) {}
  loadByStepSlug(stepSlug: string): Promise<FunnelStepSnapshot | null> {
    return this.publications.resolveByStepSlug(stepSlug);
  }
  loadPinned(funnelId: string, version: number): Promise<FunnelStepSnapshot | null> {
    return this.publications.resolvePinned(funnelId, version);
  }
}
