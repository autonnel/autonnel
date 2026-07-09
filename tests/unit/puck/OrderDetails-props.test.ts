import { describe, it, expect } from 'vitest';
import { OrderDetailPanelConfig } from '@/components/builder/blocks/OrderDetailPanel';

describe('OrderDetailPanel empty-state orthogonal props (post-audit)', () => {
  it('exposes emptyStateMessage as a text field', () => {
    expect((OrderDetailPanelConfig.fields as any).emptyStateMessage).toBeDefined();
  });

  it('exposes emptyStateStyle as a radio with card/inline/minimal', () => {
    const f = (OrderDetailPanelConfig.fields as any).emptyStateStyle;
    expect(f.type).toBe('radio');
    const values = f.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['card', 'inline', 'minimal']));
  });
});
