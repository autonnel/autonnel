export interface TrackingInfoProps {
  carrier?: string;
  trackingNumber?: string;
  url?: string;
}

export class TrackingInfo {
  private constructor(
    readonly carrier: string | undefined,
    readonly trackingNumber: string | undefined,
    readonly url: string | undefined,
  ) {}

  static of(props: TrackingInfoProps): TrackingInfo {
    return new TrackingInfo(props.carrier, props.trackingNumber, props.url);
  }

  hasTracking(): boolean {
    return !!this.trackingNumber && this.trackingNumber.length > 0;
  }
}
