import { safeLocalPath } from './payment-request-context';
import { MAX_WAIT_ATTEMPTS, redirect, settleOrWait, waitPage, withParam } from './redirect-payment-routes';
import type { ProviderCaptureResult } from '@/modules/payments/application/ports/outbound';

export interface PendingHostedUpsell {
  upsellIndex: number;
  sessionRef: string;
  sessionRefs: string[];
  status: 'pending' | 'captured';
  attempt: number;
  duplicatePaid?: string[];
  capturedRef?: string;
  line: { externalRef: string; title: string; quantity: number; unitMinor: number; lineMinor: number; currency: string };
  nextStepUrl?: string;
  cancelTo?: string;
  pageId?: string;
  funnelId?: string;
  createdAt: string;
}

export type HostedUpsellOutcome = 'captured' | 'pending' | 'failed' | 'not_found';

type SnapshotRecord = Record<string, unknown>;

export function hostedSessionRef(saleRef: string, upsellIndex: number, attempt: number): string {
  return `${saleRef}-u${upsellIndex}-${attempt}`;
}

export function pendingUpsellsOf(snapshot: unknown): Record<string, PendingHostedUpsell> {
  const raw = (snapshot as SnapshotRecord | null | undefined)?.pendingUpsells;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, PendingHostedUpsell>) : {};
}

// A new attempt joins the entry's session list: an earlier session the buyer abandoned may still get paid.
export function snapshotWithPending(snapshot: unknown, entry: PendingHostedUpsell): SnapshotRecord {
  const previous = pendingUpsellsOf(snapshot)[String(entry.upsellIndex)];
  const sessionRefs = [...new Set([...(previous?.sessionRefs ?? []), ...entry.sessionRefs])];
  const merged: PendingHostedUpsell = { ...previous, ...entry, sessionRefs, attempt: sessionRefs.length, status: 'pending' };
  return { ...(snapshot as SnapshotRecord | null), pendingUpsells: { ...pendingUpsellsOf(snapshot), [String(entry.upsellIndex)]: merged } };
}

export function snapshotWithEntryPatch(snapshot: unknown, upsellIndex: number, patch: Partial<PendingHostedUpsell>): SnapshotRecord {
  const entries = pendingUpsellsOf(snapshot);
  const current = entries[String(upsellIndex)];
  if (!current) return snapshot as SnapshotRecord;
  return { ...(snapshot as SnapshotRecord | null), pendingUpsells: { ...entries, [String(upsellIndex)]: { ...current, ...patch } } };
}

export const HOSTED_UPSELL_WINDOW_MS = 7 * 24 * 60 * 60_000;

function withinWindow(entry: PendingHostedUpsell, now: number): boolean {
  return now - new Date(entry.createdAt).getTime() < HOSTED_UPSELL_WINDOW_MS;
}

// A captured entry with several sessions keeps being swept: an abandoned earlier session may still be paid.
export function entryNeedsSweep(entry: PendingHostedUpsell, now = Date.now()): boolean {
  return withinWindow(entry, now) && (entry.status === 'pending' || entry.sessionRefs.length > 1);
}

export function hasPendingEntry(snapshot: unknown, now = Date.now()): boolean {
  return Object.values(pendingUpsellsOf(snapshot)).some((e) => entryNeedsSweep(e, now));
}

export interface FinalizeHostedUpsellDeps<I extends { currencyCode: string; checkoutSnapshot: unknown }> {
  loadIntent(saleRef: string): Promise<I | null>;
  recordedCharge(saleRef: string, upsellIndex: number): Promise<{ chargeRef: string | null } | null>;
  queryStatus(intent: I, sessionRef: string, hint: { amountMinor: number; currencyCode: string }): Promise<{ status: string; capture?: ProviderCaptureResult }>;
  recordCharge(intent: I, entry: PendingHostedUpsell, capture: ProviderCaptureResult): Promise<void>;
  updateEntry(saleRef: string, upsellIndex: number, patch: Partial<PendingHostedUpsell>): Promise<void>;
  onPaidTwice(saleRef: string, upsellIndex: number, sessionRef: string, providerChargeId: string): void;
  onQueryError?(error: unknown, saleRef: string, sessionRef: string): void;
}

// The provider's status query is the only source of truth: notifications never confirm an upsell.
// Every session of the entry is queried because a buyer may pay an earlier page after a re-click, and
// a failure signal never ends a session (another card can be tried on the same hosted page).
export async function finalizeHostedUpsellWith<I extends { currencyCode: string; checkoutSnapshot: unknown }>(
  deps: FinalizeHostedUpsellDeps<I>,
  saleRef: string,
  upsellIndex: number,
): Promise<HostedUpsellOutcome> {
  const intent = await deps.loadIntent(saleRef);
  if (!intent) return 'not_found';
  const entry = pendingUpsellsOf(intent.checkoutSnapshot)[String(upsellIndex)];
  const recorded = await deps.recordedCharge(saleRef, upsellIndex);
  if (!entry) return recorded ? 'captured' : 'not_found';
  const wasCaptured = entry.status === 'captured';
  if (!withinWindow(entry, Date.now())) return wasCaptured || recorded ? 'captured' : 'failed';
  if (wasCaptured && entry.sessionRefs.length < 2) return 'captured';

  const duplicatePaid = [...(entry.duplicatePaid ?? [])];
  let captured = wasCaptured || !!recorded;
  let capturedRef = entry.capturedRef;
  let anyPending = false;
  const hint = { amountMinor: entry.line.lineMinor, currencyCode: intent.currencyCode };
  for (const ref of entry.sessionRefs) {
    if (duplicatePaid.includes(ref) || ref === capturedRef) continue;
    let live: { status: string; capture?: ProviderCaptureResult };
    try {
      live = await deps.queryStatus(intent, ref, hint);
    } catch (error) {
      deps.onQueryError?.(error, saleRef, ref);
      anyPending = true;
      continue;
    }
    if (live.status === 'CAPTURED' && live.capture) {
      if (recorded?.chargeRef === live.capture.providerChargeId) continue;
      if (!captured) {
        await deps.recordCharge(intent, entry, live.capture);
        captured = true;
        capturedRef = ref;
      } else {
        deps.onPaidTwice(saleRef, upsellIndex, ref, live.capture.providerChargeId);
        duplicatePaid.push(ref);
      }
    } else if (live.status !== 'FAILED') {
      anyPending = true;
    }
  }
  if (captured) {
    if (!wasCaptured || capturedRef !== entry.capturedRef || duplicatePaid.length !== (entry.duplicatePaid ?? []).length) {
      await deps.updateEntry(saleRef, upsellIndex, { status: 'captured', duplicatePaid, ...(capturedRef ? { capturedRef } : {}) });
    }
    return 'captured';
  }
  return anyPending ? 'pending' : 'failed';
}

export interface ReconcileHostedUpsellDeps {
  candidates(): Promise<Array<{ saleRef: string; checkoutSnapshot: unknown }>>;
  finalize(saleRef: string, upsellIndex: number): Promise<HostedUpsellOutcome>;
  onError?(error: unknown, saleRef: string, upsellIndex: number): void;
}

export async function reconcilePendingHostedUpsellsWith(
  deps: ReconcileHostedUpsellDeps,
  limit = 50,
): Promise<{ scanned: number; captured: number; errors: number }> {
  const targets: Array<[string, number]> = [];
  for (const row of await deps.candidates()) {
    for (const [key, entry] of Object.entries(pendingUpsellsOf(row.checkoutSnapshot))) {
      if (entryNeedsSweep(entry)) targets.push([row.saleRef, Number(key)]);
    }
  }
  const result = { scanned: 0, captured: 0, errors: 0 };
  for (const [saleRef, upsellIndex] of targets.slice(0, limit)) {
    result.scanned += 1;
    try {
      if ((await deps.finalize(saleRef, upsellIndex)) === 'captured') result.captured += 1;
    } catch (error) {
      result.errors += 1;
      deps.onError?.(error, saleRef, upsellIndex);
    }
  }
  return result;
}

export interface UpsellReturnDeps {
  pending(saleRef: string, upsellIndex: number): Promise<PendingHostedUpsell | undefined>;
  finalize(saleRef: string, upsellIndex: number): Promise<HostedUpsellOutcome>;
}

// Only saleRef / n / attempt are read from the URL; the provider's own status parameters and every
// redirect target come from the stored pending entry.
export async function handleUpsellReturn(url: URL, deps: UpsellReturnDeps): Promise<Response> {
  const saleRef = url.searchParams.get('saleRef');
  const rawIndex = url.searchParams.get('n');
  const upsellIndex = rawIndex === null || rawIndex === '' ? NaN : Number(rawIndex);
  if (!saleRef || !Number.isInteger(upsellIndex) || upsellIndex < 0) return new Response('saleRef and n are required', { status: 400 });
  const attempt = Number(url.searchParams.get('attempt') ?? '0') || 0;
  const entry = await deps.pending(saleRef, upsellIndex);
  const thankYou = `/thank-you?orderId=${encodeURIComponent(saleRef)}`;

  const outcome = await settleOrWait(() => deps.finalize(saleRef, upsellIndex), { saleRef, upsellIndex });
  if (outcome === 'captured') return redirect(safeLocalPath(entry?.nextStepUrl, thankYou));
  if (outcome === 'not_found') return redirect(thankYou);
  if (outcome === 'pending' && attempt < MAX_WAIT_ATTEMPTS) {
    const again = new URL(url.toString());
    again.searchParams.set('attempt', String(attempt + 1));
    return waitPage(again);
  }
  return redirect(withParam(safeLocalPath(entry?.cancelTo, '/'), 'payment_error', '1'));
}
