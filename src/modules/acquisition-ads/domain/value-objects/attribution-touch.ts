import type { ClickIdentifier, AdPlatform } from './click-identifier';

interface AttributionTouchProps {
  clickIdentifiers: ClickIdentifier[];
  fbp?: string;
  ga?: string;
  landingUrl: string;
  transientIp?: string;
  transientUserAgent?: string;
}

export class AttributionTouch {
  private constructor(private readonly props: AttributionTouchProps) {}

  static create(props: AttributionTouchProps): AttributionTouch {
    return new AttributionTouch(props);
  }

  identifiersForPlatform(platform: AdPlatform): ClickIdentifier[] {
    return this.props.clickIdentifiers.filter((c) => c.platform === platform);
  }

  get clickIdentifiers(): readonly ClickIdentifier[] { return this.props.clickIdentifiers; }

  get fbp(): string | undefined { return this.props.fbp; }
  get ga(): string | undefined { return this.props.ga; }
  get landingUrl(): string { return this.props.landingUrl; }
  get transientIp(): string | undefined { return this.props.transientIp; }
  get transientUserAgent(): string | undefined { return this.props.transientUserAgent; }

  toPersistence() {
    return {
      clickIdentifiers: this.props.clickIdentifiers.map((c) => ({
        platform: c.platform, field: c.field, value: c.value, rawParam: c.rawParam,
      })),
      fbp: this.props.fbp,
      ga: this.props.ga,
      landingUrl: this.props.landingUrl,
    };
  }
}
