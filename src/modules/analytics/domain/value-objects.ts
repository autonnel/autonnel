import { Money } from '../../shared-kernel/money';

// HARD BOUNDARY: this enum stops at payment capture. Adding any post-capture kind (refund/ship/deliver) here is forbidden — Analytics cannot model the post-handoff lifecycle.
export enum FunnelEvent {
  PageView = 'page_view',
  StepView = 'step_view',
  CheckoutStarted = 'checkout_started',
  PaymentCaptured = 'payment_captured',
  HandoffCompleted = 'handoff_completed',
}

export enum ConversionStage {
  Visit = 'VISIT',
  StepProgression = 'STEP_PROGRESSION',
  CheckoutStarted = 'CHECKOUT_STARTED',
  PaymentCaptured = 'PAYMENT_CAPTURED',
}

const FUNNEL_EVENT_VALUES: ReadonlySet<string> = new Set(Object.values(FunnelEvent));

export function isPastCaptureBoundary(kind: string): boolean {
  return !FUNNEL_EVENT_VALUES.has(kind);
}

export function conversionStageOf(event: FunnelEvent): ConversionStage {
  switch (event) {
    case FunnelEvent.PageView:
      return ConversionStage.Visit;
    case FunnelEvent.StepView:
      return ConversionStage.StepProgression;
    case FunnelEvent.CheckoutStarted:
      return ConversionStage.CheckoutStarted;
    case FunnelEvent.PaymentCaptured:
    case FunnelEvent.HandoffCompleted:
      return ConversionStage.PaymentCaptured;
  }
}

export class VisitorId {
  private constructor(readonly value: string) {}
  static of(value: string): VisitorId {
    if (!value) throw new Error('VisitorId must be non-empty');
    return new VisitorId(value);
  }
  equals(other: VisitorId): boolean {
    return this.value === other.value;
  }
}

export class CapturedRevenue {
  private constructor(private readonly money: Money) {}
  static zero(currencyCode: string): CapturedRevenue {
    return new CapturedRevenue(Money.of(0, currencyCode));
  }
  static fromMoney(money: Money): CapturedRevenue {
    return new CapturedRevenue(money);
  }
  accrue(captured: Money): CapturedRevenue {
    return new CapturedRevenue(this.money.add(captured));
  }
  toMoney(): Money {
    return this.money;
  }
}

export class TimeBucket {
  private constructor(readonly key: string) {}
  static hourly(at: Date): TimeBucket {
    const d = new Date(at);
    d.setUTCMinutes(0, 0, 0);
    return new TimeBucket(d.toISOString());
  }
}

export class DimensionKey {
  private constructor(readonly value: string) {}
  static of(dims: Record<string, string>): DimensionKey {
    const canonical = Object.keys(dims)
      .sort()
      .map((k) => `${k}=${dims[k]}`)
      .join('&');
    return new DimensionKey(canonical || '_all');
  }
}

export interface DeviceContext {
  readonly userAgent?: string;
  readonly platform?: string;
}

export interface EntryAttribution {
  readonly firstUrl: string;
  readonly channel?: string;
  readonly campaign?: string;
  readonly utm?: Record<string, string>;
}

const CLICK_ID_CHANNEL: ReadonlyArray<[string, string]> = [
  ['gclid', 'google'],
  ['wbraid', 'google'],
  ['gbraid', 'google'],
  ['fbclid', 'facebook'],
  ['ttclid', 'tiktok'],
  ['msclkid', 'bing'],
];

// First-touch attribution for a session: keep the full landing URL (its query string carries the
// clickids used for post-payment postback) and best-effort derive channel/campaign from utm/clickid.
export function deriveEntryAttribution(firstUrl: string): EntryAttribution {
  const utm: Record<string, string> = {};
  let channel: string | undefined;
  let campaign: string | undefined;
  try {
    const params = new URL(firstUrl).searchParams;
    for (const [k, v] of params) {
      if (k.startsWith('utm_') && v) utm[k] = v;
    }
    campaign = utm['utm_campaign'];
    channel = utm['utm_source'] ?? CLICK_ID_CHANNEL.find(([param]) => params.has(param))?.[1];
  } catch {
    // Non-absolute or malformed URL: keep firstUrl, leave channel/campaign undefined.
  }
  return {
    firstUrl,
    channel,
    campaign,
    utm: Object.keys(utm).length ? utm : undefined,
  };
}

export interface StepConversion {
  readonly stepId: string | null;
  readonly enteredCount: number;
  readonly completedCount: number;
}

export interface ConversionFunnelShape {
  readonly steps: ReadonlyArray<StepConversion>;
}

export interface FunnelDefinitionSnapshot {
  readonly funnelId: string;
  readonly funnelSnapshotId: string;
  readonly stepOrder: ReadonlyArray<string>;
}
