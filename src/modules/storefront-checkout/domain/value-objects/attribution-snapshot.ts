export interface AttributionSnapshotProps {
  landingUrl: string;
  clickIds: Record<string, string>;
  utm: Record<string, string>;
  sessionId: string;
}

export class AttributionSnapshot {
  private constructor(private readonly props: AttributionSnapshotProps) {}
  static create(props: AttributionSnapshotProps): AttributionSnapshot {
    return new AttributionSnapshot({ ...props, clickIds: { ...props.clickIds }, utm: { ...props.utm } });
  }
  static empty(sessionId: string): AttributionSnapshot {
    return new AttributionSnapshot({ landingUrl: '', clickIds: {}, utm: {}, sessionId });
  }
  get sessionId() { return this.props.sessionId; }
  toJSON(): AttributionSnapshotProps { return { ...this.props }; }
}
