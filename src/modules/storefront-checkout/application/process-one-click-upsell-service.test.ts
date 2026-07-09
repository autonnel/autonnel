import { describe, it, expect, vi } from 'vitest';
import { FunnelSession } from '../domain/funnel-session';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { ContactHandle } from '../domain/value-objects/contact-handle';
import { BuyerContact, Address } from '../domain/value-objects/buyer-contact';
import { ProcessOneClickUpsellService } from './process-one-click-upsell-service';
import type { CommerceCatalogReaderPort, PurchasableView } from './ports/outbound';

function session() {
  const s = FunnelSession.start({
    sessionId: 'sess_1', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
    stepSlugs: [StepSlug.of('checkout'), StepSlug.of('upsell-1')],
    attribution: AttributionSnapshot.empty('sess_1'), entryStep: StepSlug.of('checkout'),
  });
  const handle = ContactHandle.fromEmail('ada@example.com', (n) => `h:${n}`);
  // Mirror the live main-checkout submit: only attachBuyer is called (never captureContact),
  // so the upsell guard must accept a session that has the attached buyer.
  s.attachBuyer(
    BuyerContact.create({
      fullName: 'Ada Lovelace',
      handle,
      address: Address.create({ line1: '1 St', city: 'London', countryCode: 'GB', postalCode: 'EC1' }),
    }),
  );
  return s;
}

function catalog(view: PurchasableView): CommerceCatalogReaderPort {
  return { resolve: vi.fn(async () => [view]) };
}

describe('ProcessOneClickUpsellService', () => {
  it('creates an independent PaymentIntent correlated by sessionId with the upsell snapshot and total', async () => {
    const s = session();
    const published: any[] = [];
    const deps = {
      sessions: { load: vi.fn(async () => s), store: vi.fn(async () => {}), signCookieValue: () => '', verifyCookieValue: () => null },
      catalog: catalog({ variantExternalId: 'gid://v/9', title: 'Upsell', unitPriceMinor: 2500, currencyCode: 'USD', sellable: true }),
      payments: { createIntent: vi.fn(async () => ({ clientHandle: 'client_handle_xyz' })) },
      publisher: { publish: vi.fn(async (events: any[]) => { published.push(...events); }) },
      newSaleId: () => 'sale_upsell_1',
      clock: () => new Date('2026-06-04T00:00:00Z'),
      market: { countryCode: 'GB', currencyCode: 'USD' },
    };
    const svc = new ProcessOneClickUpsellService(deps as any);

    const result = await svc.execute('sess_1', { variantExternalId: 'gid://v/9', quantity: 2 });

    expect(result.saleRef).toBe('sale_upsell_1');
    expect(result.clientHandle).toBe('client_handle_xyz');

    expect(deps.payments.createIntent).toHaveBeenCalledWith('sale_upsell_1', expect.objectContaining({ amountMinor: 5000, currencyCode: 'USD' }), 'automatic', undefined, expect.objectContaining({
      sessionId: 'sess_1',
      visitorId: null,
      buyer: expect.objectContaining({ fullName: 'Ada Lovelace', channel: 'email', hashedIdentity: 'h:ada@example.com' }),
      lines: [expect.objectContaining({ variantExternalId: 'gid://v/9', quantity: 2, unitPriceMinor: 2500, currencyCode: 'USD' })],
    }));
    expect(published.some((e: any) => e.type === 'CheckoutSubmitted' && e.payload.saleRef === 'sale_upsell_1' && e.payload.hashedIdentity === 'h:ada@example.com')).toBe(true);
  });

  it('refuses an unsellable upsell variant', async () => {
    const s = session();
    const deps = {
      sessions: { load: vi.fn(async () => s), store: vi.fn(async () => {}), signCookieValue: () => '', verifyCookieValue: () => null },
      catalog: catalog({ variantExternalId: 'gid://v/9', title: 'Upsell', unitPriceMinor: 2500, currencyCode: 'USD', sellable: false }),
      payments: { createIntent: vi.fn(async () => ({ clientHandle: 'x' })) },
      publisher: { publish: vi.fn(async () => {}) },
      newSaleId: () => 'sale_upsell_1',
      clock: () => new Date(),
      market: { countryCode: 'GB', currencyCode: 'USD' },
    };
    const svc = new ProcessOneClickUpsellService(deps as any);
    await expect(svc.execute('sess_1', { variantExternalId: 'gid://v/9', quantity: 1 })).rejects.toThrow(/sellable/i);
  });

  it('requires the main-checkout buyer to be attached', async () => {
    const bare = FunnelSession.start({
      sessionId: 'sess_2', tenantId: 'default', snapshotRef: FunnelSnapshotRef.of('fn_1', 1),
      stepSlugs: [StepSlug.of('checkout')], attribution: AttributionSnapshot.empty('sess_2'), entryStep: StepSlug.of('checkout'),
    });
    const deps = {
      sessions: { load: vi.fn(async () => bare), store: vi.fn(async () => {}), signCookieValue: () => '', verifyCookieValue: () => null },
      catalog: catalog({ variantExternalId: 'gid://v/9', title: 'Upsell', unitPriceMinor: 2500, currencyCode: 'USD', sellable: true }),
      payments: { createIntent: vi.fn(async () => ({ clientHandle: 'x' })) },
      publisher: { publish: vi.fn(async () => {}) },
      newSaleId: () => 'sale_upsell_1',
      clock: () => new Date(),
      market: { countryCode: 'GB', currencyCode: 'USD' },
    };
    const svc = new ProcessOneClickUpsellService(deps as any);
    await expect(svc.execute('sess_2', { variantExternalId: 'gid://v/9', quantity: 1 })).rejects.toThrow(/buyer/i);
  });
});
