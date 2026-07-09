export class StepSlug {
  private constructor(readonly value: string) {}
  static of(raw: string): StepSlug {
    const v = raw.trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(v)) throw new Error(`Invalid StepSlug: ${raw}`);
    return new StepSlug(v);
  }
}

export class FunnelSnapshotRef {
  private constructor(readonly funnelId: string, readonly version: number) {}
  static of(funnelId: string, version: number): FunnelSnapshotRef {
    if (!funnelId) throw new Error('FunnelSnapshotRef requires a funnelId');
    if (!Number.isInteger(version) || version < 1) throw new Error('FunnelSnapshotRef version must be a positive integer');
    return new FunnelSnapshotRef(funnelId, version);
  }
  equals(other: FunnelSnapshotRef): boolean {
    return this.funnelId === other.funnelId && this.version === other.version;
  }
}
