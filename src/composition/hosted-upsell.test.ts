import { describe, it, expect, vi } from 'vitest';
import {
  finalizeHostedUpsellWith, reconcilePendingHostedUpsellsWith, handleUpsellReturn,
  pendingUpsellsOf, snapshotWithPending, snapshotWithEntryPatch, hasPendingEntry, hostedSessionRef,
  type PendingHostedUpsell,
} from './hosted-upsell';

const entry: PendingHostedUpsell = {
  upsellIndex: 0, sessionRef: 's1-u0-1', sessionRefs: ['s1-u0-1'], status: 'pending', attempt: 1,
  line: { externalRef: 'v1', title: 'Up', quantity: 1, unitMinor: 500, lineMinor: 500, currency: 'USD' },
  nextStepUrl: '/thanks?orderId=s1', cancelTo: '/upsell-1', createdAt: new Date().toISOString(),
};
const capture = { providerChargeId: 'TR9', capturedAmountMinor: 500, currencyCode: 'USD', capturedAt: 'now' };
const snapshot = { lines: [{ variantExternalId: 'base' }], buyer: { fullName: 'A' }, returnTargets: { next: '/n' }, pendingUpsells: { '0': entry } };

function finalizeDeps(over: Record<string, unknown> = {}) {
  return {
    loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: snapshot })),
    recordedCharge: vi.fn(async () => null),
    queryStatus: vi.fn(async () => ({ status: 'CAPTURED', capture })),
    recordCharge: vi.fn(async () => {}),
    updateEntry: vi.fn(async () => {}),
    onPaidTwice: vi.fn(),
    ...over,
  } as never as Parameters<typeof finalizeHostedUpsellWith>[0];
}

describe('pending snapshot helpers', () => {
  it('adds an entry preserving every other key and appends new attempts to the session list', () => {
    const base = { lines: [1], buyer: { a: 1 }, returnTargets: { next: '/n' } };
    const added = snapshotWithPending(base, entry);
    expect(added).toMatchObject({ ...base, pendingUpsells: { '0': entry } });
    const again = pendingUpsellsOf(snapshotWithPending(added, { ...entry, sessionRef: 's1-u0-2', sessionRefs: ['s1-u0-2'], attempt: 2 }))['0'];
    expect(again).toMatchObject({ sessionRef: 's1-u0-2', sessionRefs: ['s1-u0-1', 's1-u0-2'], attempt: 2, status: 'pending' });
  });
  it('patches one entry in place and tracks whether any entry is pending', () => {
    const patched = snapshotWithEntryPatch(snapshot, 0, { status: 'captured' });
    expect(patched).toMatchObject({ lines: snapshot.lines, buyer: snapshot.buyer, returnTargets: snapshot.returnTargets });
    expect(pendingUpsellsOf(patched)['0']).toMatchObject({ status: 'captured', nextStepUrl: '/thanks?orderId=s1' });
    expect(hasPendingEntry(snapshot)).toBe(true);
    expect(hasPendingEntry(patched)).toBe(false);
    expect(hasPendingEntry(snapshotWithEntryPatch({ pendingUpsells: { '0': two } }, 0, { status: 'captured' }))).toBe(true);
    expect(hasPendingEntry({ pendingUpsells: { '0': { ...entry, createdAt: '2020-01-01T00:00:00.000Z' } } })).toBe(false);
    expect(snapshotWithEntryPatch(snapshot, 9, { status: 'captured' })).toEqual(snapshot);
  });
  it('reads pending entries defensively and builds session refs', () => {
    expect(pendingUpsellsOf(null)).toEqual({});
    expect(pendingUpsellsOf({ pendingUpsells: 'x' })).toEqual({});
    expect(hostedSessionRef('s1', 2, 3)).toBe('s1-u2-3');
  });
});

const two: PendingHostedUpsell = { ...entry, sessionRef: 's1-u0-2', sessionRefs: ['s1-u0-1', 's1-u0-2'], attempt: 2 };
const twoSnapshot = { ...snapshot, pendingUpsells: { '0': two } };

describe('finalizeHostedUpsellWith', () => {
  it('captured: queries with the line amount, records the charge, marks the entry captured', async () => {
    const d = finalizeDeps();
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.queryStatus).toHaveBeenCalledWith(expect.anything(), 's1-u0-1', { amountMinor: 500, currencyCode: 'USD' });
    expect(d.recordCharge).toHaveBeenCalledOnce();
    expect(d.updateEntry).toHaveBeenCalledWith('s1', 0, expect.objectContaining({ status: 'captured' }));
  });
  it('a captured entry returns captured without querying', async () => {
    const d = finalizeDeps({ loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: { pendingUpsells: { '0': { ...entry, status: 'captured' } } } })) });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.queryStatus).not.toHaveBeenCalled();
    expect(d.recordCharge).not.toHaveBeenCalled();
  });
  it('an existing charge for the paying session is not recorded again nor flagged', async () => {
    const d = finalizeDeps({ recordedCharge: vi.fn(async () => ({ chargeRef: 'TR9' })) });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.recordCharge).not.toHaveBeenCalled();
    expect(d.onPaidTwice).not.toHaveBeenCalled();
    expect(d.updateEntry).toHaveBeenCalledWith('s1', 0, expect.objectContaining({ status: 'captured' }));
  });
  it('re-click then paying attempt 1 is recorded', async () => {
    const d = finalizeDeps({
      loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: twoSnapshot })),
      queryStatus: vi.fn(async (_i: unknown, ref: string) => (ref === 's1-u0-1' ? { status: 'CAPTURED', capture } : { status: 'PROCESSING' })),
    });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.recordCharge).toHaveBeenCalledOnce();
  });
  it('both attempts paid: one charge, paid-twice reported once and remembered', async () => {
    const d = finalizeDeps({
      loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: twoSnapshot })),
      queryStatus: vi.fn(async (_i: unknown, ref: string) => ({ status: 'CAPTURED', capture: { ...capture, providerChargeId: `C-${ref}` } })),
    });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.recordCharge).toHaveBeenCalledOnce();
    expect(d.onPaidTwice).toHaveBeenCalledOnce();
    expect(d.onPaidTwice).toHaveBeenCalledWith('s1', 0, 's1-u0-2', 'C-s1-u0-2');
    expect(d.updateEntry).toHaveBeenCalledWith('s1', 0, expect.objectContaining({ status: 'captured', duplicatePaid: ['s1-u0-2'] }));
  });
  it('FAILED is not terminal: a session that failed first and is paid later is recorded on a later finalize', async () => {
    const status = { value: 'FAILED' };
    const d = finalizeDeps({ queryStatus: vi.fn(async () => (status.value === 'FAILED' ? { status: 'FAILED' } : { status: 'CAPTURED', capture })) });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('failed');
    expect(d.updateEntry).not.toHaveBeenCalled();
    status.value = 'CAPTURED';
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.recordCharge).toHaveBeenCalledOnce();
  });
  it('a captured entry with two sessions keeps checking the other one and reports a late payment once', async () => {
    const snap = { pendingUpsells: { '0': { ...two, status: 'captured' } } };
    const late = { value: false };
    const d = finalizeDeps({
      loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: snap })),
      recordedCharge: vi.fn(async () => ({ chargeRef: 'C-s1-u0-1' })),
      queryStatus: vi.fn(async (_i: unknown, ref: string) => (ref === 's1-u0-1' ? { status: 'CAPTURED', capture: { ...capture, providerChargeId: 'C-s1-u0-1' } } : late.value ? { status: 'CAPTURED', capture: { ...capture, providerChargeId: 'C-s1-u0-2' } } : { status: 'PROCESSING' })),
    });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.onPaidTwice).not.toHaveBeenCalled();
    late.value = true;
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.onPaidTwice).toHaveBeenCalledOnce();
    expect(d.recordCharge).not.toHaveBeenCalled();
    expect(d.updateEntry).toHaveBeenCalledWith('s1', 0, { status: 'captured', duplicatePaid: ['s1-u0-2'] });
  });
  it('a captured entry with a null chargeRef row never flags its own session as a duplicate', async () => {
    const snap = { pendingUpsells: { '0': { ...two, status: 'captured', capturedRef: 's1-u0-1' } } };
    const d = finalizeDeps({
      loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: snap })),
      recordedCharge: vi.fn(async () => ({ chargeRef: null })),
      queryStatus: vi.fn(async (_i: unknown, ref: string) => (ref === 's1-u0-1' ? { status: 'CAPTURED', capture } : { status: 'PROCESSING' })),
    });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('captured');
    expect(d.queryStatus).toHaveBeenCalledOnce();
    expect(d.onPaidTwice).not.toHaveBeenCalled();
  });
  it('stores the winning session on capture', async () => {
    const d = finalizeDeps();
    await finalizeHostedUpsellWith(d, 's1', 0);
    expect(d.updateEntry).toHaveBeenCalledWith('s1', 0, expect.objectContaining({ capturedRef: 's1-u0-1' }));
  });
  it('an expired entry is not queried', async () => {
    const old = { pendingUpsells: { '0': { ...entry, createdAt: '2020-01-01T00:00:00.000Z' } } };
    const d = finalizeDeps({ loadIntent: vi.fn(async () => ({ currencyCode: 'USD', checkoutSnapshot: old })) });
    expect(await finalizeHostedUpsellWith(d, 's1', 0)).toBe('failed');
    expect(d.queryStatus).not.toHaveBeenCalled();
  });
  it('pending records nothing; a throwing session query counts as pending', async () => {
    const pending = finalizeDeps({ queryStatus: vi.fn(async () => ({ status: 'PROCESSING' })) });
    expect(await finalizeHostedUpsellWith(pending, 's1', 0)).toBe('pending');
    const boom = finalizeDeps({ queryStatus: vi.fn(async () => { throw new Error('net'); }) });
    expect(await finalizeHostedUpsellWith(boom, 's1', 0)).toBe('pending');
    expect(pending.recordCharge).not.toHaveBeenCalled();
  });
  it('not_found without an intent or without an entry (unless a charge exists)', async () => {
    expect(await finalizeHostedUpsellWith(finalizeDeps({ loadIntent: vi.fn(async () => null) }), 's1', 0)).toBe('not_found');
    expect(await finalizeHostedUpsellWith(finalizeDeps(), 's1', 7)).toBe('not_found');
    expect(await finalizeHostedUpsellWith(finalizeDeps({ recordedCharge: vi.fn(async () => ({ chargeRef: 'x' })) }), 's1', 7)).toBe('captured');
  });
});

describe('reconcilePendingHostedUpsellsWith', () => {
  it('finalizes each pending entry once and isolates a failing one', async () => {
    const two = { ...snapshot, pendingUpsells: { '0': entry, '1': { ...entry, upsellIndex: 1 }, '2': { ...entry, upsellIndex: 2, status: 'captured' } } };
    const finalize = vi.fn(async (saleRef: string, n: number) => {
      if (saleRef === 'a' && n === 0) throw new Error('boom');
      return 'captured' as const;
    });
    const out = await reconcilePendingHostedUpsellsWith({
      candidates: async () => [{ saleRef: 'a', checkoutSnapshot: two }, { saleRef: 'b', checkoutSnapshot: snapshot }, { saleRef: 'c', checkoutSnapshot: { lines: [] } }],
      finalize,
    }, 50);
    expect(finalize.mock.calls).toEqual([['a', 0], ['a', 1], ['b', 0]]);
    expect(out).toEqual({ scanned: 3, captured: 2, errors: 1 });
  });
  it('honours the limit', async () => {
    const finalize = vi.fn(async () => 'pending' as const);
    await reconcilePendingHostedUpsellsWith({
      candidates: async () => [{ saleRef: 'a', checkoutSnapshot: snapshot }, { saleRef: 'b', checkoutSnapshot: snapshot }],
      finalize,
    }, 1);
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});

describe('handleUpsellReturn after the sweep won', () => {
  it('redirects to the stored next step of the captured entry', async () => {
    const d = { pending: vi.fn(async () => ({ ...entry, status: 'captured' }) as never), finalize: vi.fn(async () => 'captured' as never) };
    const res = await handleUpsellReturn(new URL('https://shop.example/x?saleRef=s1&n=0'), d);
    expect(res.headers.get('location')).toBe('/thanks?orderId=s1');
  });
});

describe('handleUpsellReturn', () => {
  const url = (q: string) => new URL(`https://shop.example/api/shop/payment/upsell-return/acme?${q}`);
  const deps = (outcome: string, pending: unknown = entry) => ({ pending: vi.fn(async () => pending as never), finalize: vi.fn(async () => outcome as never) });

  it('keeps the buyer on the wait page when the provider lookup throws, then falls back to cancel', async () => {
    const throwing = { pending: vi.fn(async () => entry as never), finalize: vi.fn(async () => { throw new Error('provider down'); }) };
    const res = await handleUpsellReturn(url('saleRef=s1&n=0'), throwing);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('attempt=1');
    const last = await handleUpsellReturn(url('saleRef=s1&n=0&attempt=20'), throwing);
    expect(last.headers.get('location')).toBe('/upsell-1?payment_error=1');
  });

  it('captured redirects to the stored next step', async () => {
    const res = await handleUpsellReturn(url('saleRef=s1&n=0&status=FAILED'), deps('captured'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/thanks?orderId=s1');
  });
  it('captured without a stored next step falls back to thank-you', async () => {
    const res = await handleUpsellReturn(url('saleRef=s1&n=0'), deps('captured', { ...entry, nextStepUrl: undefined }));
    expect(res.headers.get('location')).toBe('/thank-you?orderId=s1');
  });
  it('pending renders a refresh page, and gives up at the attempt limit', async () => {
    const wait = await handleUpsellReturn(url('saleRef=s1&n=0'), deps('pending'));
    expect(wait.status).toBe(200);
    expect(await wait.text()).toContain('attempt=1');
    const done = await handleUpsellReturn(url('saleRef=s1&n=0&attempt=20'), deps('pending'));
    expect(done.headers.get('location')).toBe('/upsell-1?payment_error=1');
  });
  it('failed goes to the stored cancel path with payment_error', async () => {
    const res = await handleUpsellReturn(url('saleRef=s1&n=0'), deps('failed'));
    expect(res.headers.get('location')).toBe('/upsell-1?payment_error=1');
  });
  it('rejects off-site stored targets', async () => {
    const bad = { ...entry, nextStepUrl: 'https://evil.example/', cancelTo: '//evil.example' };
    expect((await handleUpsellReturn(url('saleRef=s1&n=0'), deps('captured', bad))).headers.get('location')).toBe('/thank-you?orderId=s1');
    expect((await handleUpsellReturn(url('saleRef=s1&n=0'), deps('failed', bad))).headers.get('location')).toBe('/?payment_error=1');
  });
  it('not_found goes to thank-you; missing params are a 400', async () => {
    expect((await handleUpsellReturn(url('saleRef=s1&n=0'), deps('not_found', undefined))).headers.get('location')).toBe('/thank-you?orderId=s1');
    expect((await handleUpsellReturn(url('n=0'), deps('captured'))).status).toBe(400);
    expect((await handleUpsellReturn(url('saleRef=s1'), deps('captured'))).status).toBe(400);
    expect((await handleUpsellReturn(url('saleRef=s1&n=x'), deps('captured'))).status).toBe(400);
  });
});
