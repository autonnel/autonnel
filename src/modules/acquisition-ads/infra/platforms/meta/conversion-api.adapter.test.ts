import { describe, it, expect } from 'vitest';
import { MetaConversionApiAdapter } from './conversion-api.adapter';
import { ConversionEvent } from '../../../domain/value-objects/conversion-event';
import { Money } from '../../../../shared-kernel/money';

const event = ConversionEvent.create({ eventName: 'Purchase', eventId: 'evt1', eventTimeMs: 1_700_000_000_000, value: Money.of(2999, 'USD') });
const dest = { id: 'd1', kind: 'PIXEL' as const, externalId: '123456', isDefault: true };

describe('MetaConversionApiAdapter', () => {
  it('POSTs the events payload to the pixel endpoint and returns providerRef on 200', async () => {
    let captured: any;
    const fetchImpl = async (url: string, init: any) => {
      captured = { url, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'TRACE9' }), { status: 200 });
    };
    const adapter = new MetaConversionApiAdapter(fetchImpl as any);
    const res = await adapter.sendConversion({
      accessToken: 'tok', destination: dest, event,
      payload: { clickIds: [{ field: 'fbc', value: 'fb.1.1.x' }], hashedEmail: 'a'.repeat(64) },
    });
    expect(res.acknowledged).toBe(true);
    expect(res.providerRef).toBe('TRACE9');
    expect(captured.url).toContain('/123456/events');
    expect(captured.body.data[0].event_name).toBe('Purchase');
    expect(captured.body.data[0].event_id).toBe('evt1');
    expect(captured.body.data[0].user_data.em).toContain('a'.repeat(64));
  });

  it('marks 5xx as retryable and 400 as permanent', async () => {
    const adapter5 = new MetaConversionApiAdapter((async () => new Response('err', { status: 503 })) as any);
    expect((await adapter5.sendConversion({ accessToken: 't', destination: dest, event, payload: { clickIds: [] } })).retryable).toBe(true);
    const adapter4 = new MetaConversionApiAdapter((async () => new Response('bad', { status: 400 })) as any);
    const r4 = await adapter4.sendConversion({ accessToken: 't', destination: dest, event, payload: { clickIds: [] } });
    expect(r4.acknowledged).toBe(false);
    expect(r4.retryable).toBe(false);
  });
});
