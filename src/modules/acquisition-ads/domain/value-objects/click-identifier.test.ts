import { describe, it, expect } from 'vitest';
import { ClickIdentifier } from './click-identifier';

describe('ClickIdentifier', () => {
  it('normalizes fbclid into an fbc cookie value and routes to META', () => {
    const ids = ClickIdentifier.fromQuery(
      { fbclid: 'AbC123' },
      { landingUrlTimestampMs: 1_700_000_000_000 },
    );
    expect(ids).toHaveLength(1);
    expect(ids[0].platform).toBe('META');
    expect(ids[0].field).toBe('fbc');
    expect(ids[0].value).toBe('fb.1.1700000000000.AbC123');
    expect(ids[0].rawParam).toBe('fbclid');
  });

  it('maps gclid/gbraid/wbraid to GOOGLE, ttclid to TIKTOK, msclkid is ignored (unsupported platform)', () => {
    const ids = ClickIdentifier.fromQuery(
      { gclid: 'g1', wbraid: 'w1', ttclid: 't1', msclkid: 'm1' },
      { landingUrlTimestampMs: 1 },
    );
    const byPlatform = Object.fromEntries(ids.map((i) => [i.rawParam, i.platform]));
    expect(byPlatform).toEqual({ gclid: 'GOOGLE', wbraid: 'GOOGLE', ttclid: 'TIKTOK' });
    expect(ids.find((i) => i.rawParam === 'msclkid')).toBeUndefined();
  });

  it('returns an empty list when no click ids are present', () => {
    expect(ClickIdentifier.fromQuery({}, { landingUrlTimestampMs: 1 })).toEqual([]);
  });
});
