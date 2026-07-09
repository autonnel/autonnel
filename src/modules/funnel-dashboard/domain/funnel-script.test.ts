import { describe, it, expect } from 'vitest';
import { FunnelScript } from './funnel-script';

describe('FunnelScript', () => {
  it('requires name and content', () => {
    expect(() => FunnelScript.create({ funnelId: 'f1', name: '', content: 'x', position: 'HEAD' })).toThrow(
      /Name and content/,
    );
    expect(() => FunnelScript.create({ funnelId: 'f1', name: 'n', content: '  ', position: 'HEAD' })).toThrow(
      /Name and content/,
    );
  });

  it('rejects invalid position', () => {
    expect(() => FunnelScript.create({ funnelId: 'f1', name: 'n', content: 'x', position: 'FOOTER' })).toThrow(
      /Invalid position/,
    );
  });

  it('defaults isActive to true and order to 0', () => {
    const s = FunnelScript.create({ funnelId: 'f1', name: 'GA', content: '<s/>', position: 'BODY_END' });
    expect(s.isActive).toBe(true);
    expect(s.order).toBe(0);
    expect(s.position).toBe('BODY_END');
  });

  it('applyEdit patches fields and validates', () => {
    const s = FunnelScript.create({ funnelId: 'f1', name: 'GA', content: '<s/>', position: 'HEAD' });
    s.applyEdit({ name: 'Pixel', isActive: false });
    expect(s.name).toBe('Pixel');
    expect(s.isActive).toBe(false);
    expect(() => s.applyEdit({ position: 'NOPE' })).toThrow(/Invalid position/);
  });
});
