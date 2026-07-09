import { describe, it, expect } from 'vitest';
import { Money } from '@/modules/shared-kernel/money';
import { IdempotencyKey } from '@/modules/shared-kernel/idempotency-key';
import type {
  FunnelSessionStorePort,
  PaymentCapturePort,
  CommerceCatalogReaderPort,
  CommerceHandoffPort,
  FunnelSnapshotReaderPort,
  DomainEventPublisherPort,
  JobQueuePort,
  AttributionReaderPort,
  AppConfigPort,
  HashIdentityPort,
} from './outbound';

describe('Storefront outbound ports', () => {
  it('a fake PaymentCapturePort matches the create(SaleRef, Money, captureMethod) shape', async () => {
    const fake: PaymentCapturePort = {
      async createIntent(saleRef, amount, captureMethod) {
        expect(amount.currencyCode).toBe('USD');
        return { clientHandle: `cs_${saleRef}_${captureMethod}` };
      },
    };
    const handle = await fake.createIntent('sale_1', Money.of(2000, 'USD'), 'automatic');
    expect(handle.clientHandle).toBe('cs_sale_1_automatic');
  });

  it('a fake CommerceHandoffPort accepts an idempotency key', async () => {
    const fake: CommerceHandoffPort = {
      async submit(payload) {
        return { backendRef: `ext_${payload.idempotencyKey.value}` };
      },
    };
    const res = await fake.submit({ idempotencyKey: IdempotencyKey.of('k'), saleRef: 's', grandTotal: Money.of(1, 'USD'), lines: [], customer: { fullName: '', hashedIdentity: '', shippingAddress: {} as any } });
    expect(res.backendRef).toBe('ext_k');
  });

  it('HashIdentityPort produces a deterministic hash', () => {
    const fake: HashIdentityPort = { hash: (n) => `h:${n}` };
    expect(fake.hash('a@b.co')).toBe('h:a@b.co');
  });
});
