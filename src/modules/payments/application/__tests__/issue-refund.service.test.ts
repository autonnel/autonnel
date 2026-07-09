import { describe, it, expect, vi } from 'vitest';
import { IssueRefundService } from '../issue-refund.service';
import { PaymentIntent } from '../../domain/payment-intent';
import { SaleRef, CaptureMethod, CaptureResult, RefundKind } from '../../domain/value-objects';
import { RefundTransaction } from '../../domain/refund-transaction';
import { Money } from '../../../shared-kernel/money';
import type { ReserveRefundInput, ReserveRefundResult } from '../ports/outbound';

function capturedIntent(amountMinor = 10000) {
  const i = PaymentIntent.create({ id: 'int_1', saleRef: SaleRef.of('sale_1'), provider: 'STRIPE', amount: Money.of(amountMinor, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
  i.bindProvider({ provider: 'STRIPE', providerIntentId: 'pi_1' } as any);
  i.markCaptured(CaptureResult.of({ providerChargeId: 'ch_1', capturedAmount: Money.of(amountMinor, 'USD'), capturedAt: new Date() }));
  return i;
}

interface LedgerRow { id: string; idempotencyKey: string; amountMinor: number; status: 'PENDING' | 'SUCCEEDED' | 'FAILED'; kind: RefundKind; providerRefundRef?: string }

// Stateful fake that models the Prisma repo's atomic guarantee: reserveRefund serializes per parent
// (the FOR UPDATE lock) and runs `decide` against the live non-failed sum, so two concurrent
// reservations cannot both pass against the same stale prior sum.
function makeLedgerRepo(seed: LedgerRow[] = []) {
  const rows: LedgerRow[] = [...seed];
  let lock: Promise<void> = Promise.resolve();

  function nonFailedSum() {
    return rows.filter((r) => r.status !== 'FAILED').reduce((a, r) => a + r.amountMinor, 0);
  }
  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = lock;
    let release!: () => void;
    lock = new Promise<void>((r) => (release = r));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  function toDomain(r: LedgerRow): RefundTransaction {
    const t = RefundTransaction.create({ id: r.id, parentTransactionId: 'int_1', kind: r.kind, amount: Money.of(r.amountMinor, 'USD') });
    if (r.providerRefundRef) t.acknowledge(r.providerRefundRef);
    return t;
  }

  return {
    rows,
    nonFailedSum,
    reserveRefund: vi.fn(async (input: ReserveRefundInput): Promise<ReserveRefundResult> =>
      withLock(async () => {
        const existing = rows.find((r) => r.idempotencyKey === input.idempotencyKey);
        if (existing) return { status: 'duplicate', refund: toDomain(existing) };
        // Force an await between the sum read and the write so an unsynchronized impl would interleave.
        await Promise.resolve();
        const decided = input.decide(nonFailedSum()); // throws -> reservation aborts
        const row: LedgerRow = { id: decided.id, idempotencyKey: input.idempotencyKey, amountMinor: decided.amount.amountMinor, status: 'PENDING', kind: decided.kind };
        rows.push(row);
        return { status: 'reserved', refund: toDomain(row) };
      }),
    ),
    settleRefund: vi.fn(async (id: string, ref: string) => {
      const r = rows.find((x) => x.id === id);
      if (r) { r.status = 'SUCCEEDED'; r.providerRefundRef = ref; }
    }),
    failRefund: vi.fn(async (id: string) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.status = 'FAILED';
    }),
    // No CHARGE rows seeded → the service synthesizes a single charge from the capture result, so
    // these single-charge tests exercise the same refundable balance as before.
    listCharges: vi.fn(async () => []),
  };
}

function makeDeps(intent: PaymentIntent, txRepo = makeLedgerRepo()) {
  const provider = { slug: 'STRIPE' as const, refund: vi.fn(async () => ({ providerRefundRef: 're_1' })), createIntent: vi.fn(), authorize: vi.fn(), capture: vi.fn(), cancel: vi.fn(), getIntent: vi.fn(), verifyWebhookSignature: vi.fn(), parseWebhook: vi.fn() };
  const intentRepo = { findById: vi.fn(async () => intent), save: vi.fn(), findByProviderRef: vi.fn(), findBySaleRef: vi.fn(), findStaleProcessing: vi.fn() };
  const events = { publish: vi.fn() };
  return { provider, intentRepo, txRepo, events };
}

function makeService(d: ReturnType<typeof makeDeps>, ids: string[] = ['rt_1', 'rt_2', 'rt_3']) {
  let n = 0;
  return new IssueRefundService({
    providerFor: async () => d.provider as any,
    intentRepo: d.intentRepo as any,
    txRepo: d.txRepo as any,
    events: d.events as any,
    newRefundId: () => ids[n++] ?? `rt_${n}`,
  });
}

describe('IssueRefundService', () => {
  it('PERCENTAGE refund → reserves, calls provider, settles, emits RefundIssued', async () => {
    const intent = capturedIntent();
    const d = makeDeps(intent);
    const svc = makeService(d);
    const out = await svc.refund({ intentId: 'int_1', kind: RefundKind.PERCENTAGE, percentage: 33, idempotencyKey: 'idem_1' });

    expect(d.provider.refund).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 3300, currencyCode: 'USD' }));
    expect(out.refundedAmountMinor).toBe(3300);
    expect(d.txRepo.settleRefund).toHaveBeenCalledWith('rt_1', 're_1');
    expect(d.txRepo.rows.find((r) => r.id === 'rt_1')?.status).toBe('SUCCEEDED');

    const emitted = d.events.publish.mock.calls[0][0];
    expect(emitted.type).toBe('payment.refund_issued');
    expect(emitted.payload.parentTransactionId).toBe('int_1');
    expect(emitted.payload.refundedAmountMinor).toBe(3300);
  });

  it('rejects a refund that would exceed the captured total (no provider call)', async () => {
    const intent = capturedIntent();
    const d = makeDeps(intent, makeLedgerRepo([{ id: 'prior', idempotencyKey: 'prior', amountMinor: 9000, status: 'SUCCEEDED', kind: RefundKind.FIXED }]));
    const svc = makeService(d);
    await expect(svc.refund({ intentId: 'int_1', kind: RefundKind.FIXED, fixedAmount: Money.of(2000, 'USD'), idempotencyKey: 'idem_1' })).rejects.toThrow();
    expect(d.provider.refund).not.toHaveBeenCalled();
    expect(d.txRepo.nonFailedSum()).toBe(9000);
  });

  it('is idempotent on idempotencyKey: a replay returns the prior refund without re-calling the provider', async () => {
    const intent = capturedIntent();
    const d = makeDeps(intent, makeLedgerRepo([{ id: 'rt_prior', idempotencyKey: 'idem_1', amountMinor: 3300, status: 'SUCCEEDED', kind: RefundKind.PERCENTAGE, providerRefundRef: 're_prior' }]));
    const svc = makeService(d);
    const out = await svc.refund({ intentId: 'int_1', kind: RefundKind.PERCENTAGE, percentage: 33, idempotencyKey: 'idem_1' });
    expect(out.refundTransactionId).toBe('rt_prior');
    expect(d.provider.refund).not.toHaveBeenCalled();
    expect(d.txRepo.settleRefund).not.toHaveBeenCalled();
  });

  it('concurrent refunds with distinct keys cannot exceed the refundable balance', async () => {
    const intent = capturedIntent(4900); // $49.00 captured
    const d = makeDeps(intent);
    const svc = makeService(d, ['rt_a', 'rt_b']);

    // $30.00 + $25.00 = $55.00 requested against a $49.00 balance; one must lose.
    const results = await Promise.allSettled([
      svc.refund({ intentId: 'int_1', kind: RefundKind.FIXED, fixedAmount: Money.of(3000, 'USD'), idempotencyKey: 'a' }),
      svc.refund({ intentId: 'int_1', kind: RefundKind.FIXED, fixedAmount: Money.of(2500, 'USD'), idempotencyKey: 'b' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(d.provider.refund).toHaveBeenCalledTimes(1);

    const settledTotal = d.txRepo.rows.filter((r) => r.status === 'SUCCEEDED').reduce((a, r) => a + r.amountMinor, 0);
    expect(settledTotal).toBeLessThanOrEqual(4900);
    expect(d.txRepo.nonFailedSum()).toBeLessThanOrEqual(4900);
  });

  it('refunds a specific charge of a merged-upsell intent, against that charge id', async () => {
    const intent = capturedIntent(3998); // PI total = base 1999 + upsell 1999
    const d = makeDeps(intent);
    d.txRepo.listCharges = vi.fn(async () => [
      { chargeRef: 'ch_base', amountMinor: 1999, currencyCode: 'USD' },
      { chargeRef: 'ch_upsell', amountMinor: 1999, currencyCode: 'USD' },
    ]);
    const svc = makeService(d);
    const out = await svc.refund({ intentId: 'int_1', kind: RefundKind.FULL, idempotencyKey: 'k', chargeRef: 'ch_upsell' });
    expect(out.refundedAmountMinor).toBe(1999);
    expect(d.provider.refund).toHaveBeenCalledWith(expect.objectContaining({ providerChargeId: 'ch_upsell', amountMinor: 1999 }));
    expect(d.txRepo.reserveRefund).toHaveBeenCalledWith(expect.objectContaining({ chargeRef: 'ch_upsell' }));
  });

  it('rejects a refund exceeding the targeted charge amount (per-charge cap, no provider call)', async () => {
    const intent = capturedIntent(3998);
    const d = makeDeps(intent);
    d.txRepo.listCharges = vi.fn(async () => [
      { chargeRef: 'ch_base', amountMinor: 1999, currencyCode: 'USD' },
      { chargeRef: 'ch_upsell', amountMinor: 1999, currencyCode: 'USD' },
    ]);
    const svc = makeService(d);
    // $20.00 against a $19.99 charge — the exact case that used to reach Stripe and fail.
    await expect(svc.refund({ intentId: 'int_1', kind: RefundKind.FIXED, fixedAmount: Money.of(2000, 'USD'), idempotencyKey: 'k', chargeRef: 'ch_base' })).rejects.toThrow();
    expect(d.provider.refund).not.toHaveBeenCalled();
  });

  it('a failed provider call releases the reservation so the balance is refundable again', async () => {
    const intent = capturedIntent(4900);
    const d = makeDeps(intent, makeLedgerRepo());
    d.provider.refund.mockRejectedValueOnce(new Error('provider down'));
    const svc = makeService(d, ['rt_fail', 'rt_ok']);

    await expect(svc.refund({ intentId: 'int_1', kind: RefundKind.FIXED, fixedAmount: Money.of(4900, 'USD'), idempotencyKey: 'x' })).rejects.toThrow('provider down');
    expect(d.txRepo.failRefund).toHaveBeenCalledWith('rt_fail');
    expect(d.txRepo.nonFailedSum()).toBe(0);

    const out = await svc.refund({ intentId: 'int_1', kind: RefundKind.FULL, idempotencyKey: 'y' });
    expect(out.refundedAmountMinor).toBe(4900);
    expect(d.txRepo.rows.find((r) => r.id === 'rt_ok')?.status).toBe('SUCCEEDED');
  });
});
