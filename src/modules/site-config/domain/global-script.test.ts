import { describe, it, expect } from 'vitest';
import { GlobalScript, isScriptPosition } from './global-script';

describe('GlobalScript', () => {
  it('creates with valid input and defaults enabled=true', () => {
    const s = GlobalScript.create({ tenantId: 't1', name: ' GA ', content: '<script></script>', position: 'HEAD' });
    expect(s.name).toBe('GA');
    expect(s.enabled).toBe(true);
    expect(s.order).toBe(0);
  });

  it('rejects blank name or content', () => {
    expect(() => GlobalScript.create({ tenantId: 't1', name: '  ', content: 'x', position: 'HEAD' })).toThrow(/name/);
    expect(() => GlobalScript.create({ tenantId: 't1', name: 'x', content: '  ', position: 'HEAD' })).toThrow(/content/);
  });

  it('rejects invalid position', () => {
    expect(() => GlobalScript.create({ tenantId: 't1', name: 'x', content: 'y', position: 'FOOTER' })).toThrow(/position/);
    expect(isScriptPosition('BODY_END')).toBe(true);
    expect(isScriptPosition('NOPE')).toBe(false);
  });

  it('applies partial edits and validates them', () => {
    const s = GlobalScript.create({ tenantId: 't1', name: 'x', content: 'y', position: 'HEAD' });
    s.applyEdit({ enabled: false, position: 'BODY_END' });
    expect(s.enabled).toBe(false);
    expect(s.position).toBe('BODY_END');
    expect(() => s.applyEdit({ name: '   ' })).toThrow(/name/);
  });
});
