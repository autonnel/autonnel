import { describe, it, expect } from 'vitest';
import { applyTextsToDesign } from './apply-texts';

describe('applyTextsToDesign', () => {
  it('replaces {{T:id}} markers with values from texts dict', () => {
    const design = { children: [{ data: { value: { content: '{{T:greeting}}' } } }] };
    const out = applyTextsToDesign(design, { greeting: 'Hello' });
    expect(out.children[0].data.value.content).toBe('Hello');
  });

  it('does NOT replace {{var}} (no T: prefix)', () => {
    const design = { children: [{ data: { value: { content: '{{customerName}}' } } }] };
    const out = applyTextsToDesign(design, { customerName: 'Ignored' });
    expect(out.children[0].data.value.content).toBe('{{customerName}}');
  });

  it('handles missing text id by replacing with empty string', () => {
    const design = { children: [{ data: { value: { content: '{{T:missing}}' } } }] };
    const out = applyTextsToDesign(design, {});
    expect(out.children[0].data.value.content).toBe('');
  });

  it('replaces multiple markers in same string', () => {
    const design = { content: '{{T:a}} and {{T:b}}' };
    const out = applyTextsToDesign(design, { a: 'X', b: 'Y' });
    expect(out.content).toBe('X and Y');
  });

  it('recurses into nested objects and arrays', () => {
    const design = { rows: [{ children: [{ html: '{{T:h}}' }] }] };
    const out = applyTextsToDesign(design, { h: 'hi' });
    expect(out.rows[0].children[0].html).toBe('hi');
  });

  it('returns a new object (does not mutate input)', () => {
    const design = { content: '{{T:x}}' };
    const texts = { x: 'replaced' };
    const out = applyTextsToDesign(design, texts);
    expect(design.content).toBe('{{T:x}}');
    expect(out.content).toBe('replaced');
  });
});
