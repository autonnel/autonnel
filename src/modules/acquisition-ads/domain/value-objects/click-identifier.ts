export type AdPlatform = 'META' | 'GOOGLE' | 'TIKTOK';

// Connections/UI persist provider aliases ('FACEBOOK', 'GOOGLE_ADS'); map them to the canonical
// AdPlatform so identifier/platform comparisons line up.
export function canonicalAdPlatform(raw: string): AdPlatform {
  const p = raw.toUpperCase();
  if (p === 'META' || p === 'FACEBOOK') return 'META';
  if (p === 'GOOGLE' || p === 'GOOGLE_ADS') return 'GOOGLE';
  return 'TIKTOK';
}

interface ClickIdentifierProps {
  platform: AdPlatform;
  field: string;
  value: string;
  rawParam: string;
}

const PARAM_MAP: Record<string, { platform: AdPlatform; field: string }> = {
  fbclid: { platform: 'META', field: 'fbc' },
  gclid: { platform: 'GOOGLE', field: 'gclid' },
  gbraid: { platform: 'GOOGLE', field: 'gbraid' },
  wbraid: { platform: 'GOOGLE', field: 'wbraid' },
  ttclid: { platform: 'TIKTOK', field: 'ttclid' },
};

export class ClickIdentifier {
  private constructor(private readonly props: ClickIdentifierProps) {}

  get platform(): AdPlatform { return this.props.platform; }
  get field(): string { return this.props.field; }
  get value(): string { return this.props.value; }
  get rawParam(): string { return this.props.rawParam; }

  static fromQuery(
    query: Record<string, string | undefined>,
    ctx: { landingUrlTimestampMs: number },
  ): ClickIdentifier[] {
    const out: ClickIdentifier[] = [];
    for (const [param, mapping] of Object.entries(PARAM_MAP)) {
      const raw = query[param];
      if (!raw) continue;
      const value =
        mapping.field === 'fbc'
          ? `fb.1.${ctx.landingUrlTimestampMs}.${raw}`
          : raw;
      out.push(new ClickIdentifier({ ...mapping, value, rawParam: param }));
    }
    return out;
  }

  static fromPersistence(p: ClickIdentifierProps): ClickIdentifier {
    return new ClickIdentifier(p);
  }
}
