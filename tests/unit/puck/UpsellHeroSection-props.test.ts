import { describe, it, expect } from 'vitest';
import { UpsellHeaderConfig } from '@/components/builder/blocks/UpsellHeader';

describe('UpsellHeader contentAlign prop (post-audit)', () => {
  it('exposes contentAlign as a radio with left/center/right', () => {
    const f = (UpsellHeaderConfig.fields as any).contentAlign;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['left', 'center', 'right']));
  });
});
