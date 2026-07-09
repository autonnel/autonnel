import { describe, it, expect } from 'vitest';
import { GoogleConversionApiAdapter } from './google/conversion-api.adapter';
import { TikTokConversionApiAdapter } from './tiktok/conversion-api.adapter';
import { ConversionEvent } from '../../domain/value-objects/conversion-event';
import { Money } from '../../../shared-kernel/money';

const event = ConversionEvent.create({ eventName: 'purchase', eventId: 'evt1', eventTimeMs: 1_700_000_000_000, value: Money.of(2999, 'USD') });

describe('GoogleConversionApiAdapter', () => {
  it('uploads click conversions with hashed user identifiers', async () => {
    let captured: any;
    const fetchImpl = async (url: string, init: any) => {
      captured = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ results: [{}] }), { status: 200 });
    };
    const adapter = new GoogleConversionApiAdapter(fetchImpl as any);
    const res = await adapter.sendConversion({
      accessToken: 'tok',
      destination: { id: 'd1', kind: 'EVENT_SET', externalId: 'customers/123', isDefault: true },
      event, payload: { clickIds: [{ field: 'gclid', value: 'g1' }], hashedEmail: 'a'.repeat(64) },
    });
    expect(res.acknowledged).toBe(true);
    expect(captured.url).toContain(':uploadClickConversions');
    expect(captured.body.conversions[0].gclid).toBe('g1');
  });
});

describe('TikTokConversionApiAdapter', () => {
  it('tracks a web event with the Access-Token header and event_id dedup', async () => {
    let captured: any;
    const fetchImpl = async (url: string, init: any) => {
      captured = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ code: 0, message: 'OK', request_id: 'R1' }), { status: 200 });
    };
    const adapter = new TikTokConversionApiAdapter(fetchImpl as any);
    const res = await adapter.sendConversion({
      accessToken: 'tok',
      destination: { id: 'd1', kind: 'EVENT_SET', externalId: 'PIXEL9', isDefault: true },
      event, payload: { clickIds: [{ field: 'ttclid', value: 't1' }], hashedEmail: 'a'.repeat(64) },
    });
    expect(res.acknowledged).toBe(true);
    expect(res.providerRef).toBe('R1');
    expect(captured.headers['Access-Token']).toBe('tok');
    expect(captured.body.data[0].event_id).toBe('evt1');
  });

  it('treats TikTok body code != 0 as a permanent failure', async () => {
    const adapter = new TikTokConversionApiAdapter((async () => new Response(JSON.stringify({ code: 40001, message: 'bad' }), { status: 200 })) as any);
    const res = await adapter.sendConversion({
      accessToken: 't', destination: { id: 'd1', kind: 'EVENT_SET', externalId: 'P', isDefault: true }, event, payload: { clickIds: [] },
    });
    expect(res.acknowledged).toBe(false);
    expect(res.retryable).toBe(false);
  });
});
