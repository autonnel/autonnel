import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function flushedEvents(beacon: ReturnType<typeof vi.fn>): Promise<Array<{ kind: string; metadata: Record<string, unknown> }>> {
  const blob = beacon.mock.calls.at(-1)?.[1] as Blob;
  return (JSON.parse(await blob.text()) as { events: Array<{ kind: string; metadata: Record<string, unknown> }> }).events;
}

describe('payment_error analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records the raw reason while the buyer sees the translated message', async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    await import('./behavior');

    window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', {
      detail: { message: 'Dieses Produkt ist nicht zum Kauf verfügbar.', reason: 'Variant is not sellable', provider: 'stripe', code: 'x' },
    }));
    window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', { detail: { message: 'Only message' } }));
    vi.advanceTimersByTime(2500);

    const events = (await flushedEvents(beacon)).filter((e) => e.kind === 'payment_error');
    expect(events).toHaveLength(2);
    expect(events[0].metadata.message).toBe('Variant is not sellable');
    expect(events[0].metadata.provider).toBe('stripe');
    expect(events[1].metadata.message).toBe('Only message');
  });
});
