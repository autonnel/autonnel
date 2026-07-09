export const ACTIVITY_KINDS = [
  'page_view',
  'add_to_cart',
  'remove_from_cart',
  'coupon_applied',
  'coupon_removed',
  'checkout_view',
  'shipping_submitted',
  'payment_method_selected',
  'payment_button_click',
  'payment_submit',
  'payment_success',
  'payment_error',
  'upsell_view',
  'upsell_accept',
  'upsell_decline',
  'page_leave',
  'js_error',
] as const;

export type KnownActivityKind = (typeof ACTIVITY_KINDS)[number];

const KIND_MAX_LENGTH = 64;
const URL_MAX_LENGTH = 2048;

export interface RawActivityEvent {
  kind?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  funnelId?: unknown;
  pageId?: unknown;
  stepId?: unknown;
  url?: unknown;
  referrer?: unknown;
  metadata?: unknown;
  occurredAt?: unknown;
}

export interface ActivityEvent {
  kind: string;
  visitorId: string;
  sessionId: string | null;
  funnelId: string | null;
  pageId: string | null;
  stepId: string | null;
  url: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

export class InvalidActivityEventError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidActivityEventError';
  }
}

function optionalString(value: unknown, maxLength?: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function parseOccurredAt(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

// kind is an OPEN set: unknown kinds are allowed, ACTIVITY_KINDS is only the known catalog.
export function normalizeActivityEvent(raw: RawActivityEvent): ActivityEvent {
  const kind = typeof raw.kind === 'string' ? raw.kind.trim() : '';
  if (!kind) throw new InvalidActivityEventError('kind is required');
  if (kind.length > KIND_MAX_LENGTH) throw new InvalidActivityEventError('kind too long');

  const visitorId = typeof raw.visitorId === 'string' ? raw.visitorId.trim() : '';
  if (!visitorId) throw new InvalidActivityEventError('visitorId is required');

  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : null;

  return {
    kind,
    visitorId,
    sessionId: optionalString(raw.sessionId),
    funnelId: optionalString(raw.funnelId),
    pageId: optionalString(raw.pageId),
    stepId: optionalString(raw.stepId),
    url: optionalString(raw.url, URL_MAX_LENGTH),
    referrer: optionalString(raw.referrer, URL_MAX_LENGTH),
    metadata,
    occurredAt: parseOccurredAt(raw.occurredAt),
  };
}
