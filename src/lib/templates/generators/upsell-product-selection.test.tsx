import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...a: unknown[]) => apiCall(...a) }));

import { VariantSelector } from '@/components/builder/blocks/VariantSelector';
import { UpsellAddButton } from '@/components/builder/blocks/UpsellAddButton';
import { upsellSkincareTemplate } from './upsell-skincare';
import { upsellWellnessTemplate } from './upsell-wellness';

type Node = { type: string; props: any };
function walk(content: Node[], acc: Node[] = []): Node[] {
  for (const n of content || []) {
    acc.push(n);
    for (const k of ['content', 'left', 'right']) if (Array.isArray(n.props?.[k])) walk(n.props[k], acc);
  }
  return acc;
}
function pickProps(template: () => any, type: string): any {
  const node = walk(template().content).find((n) => n.type === type);
  if (!node) throw new Error(`template missing ${type}`);
  return node.props;
}

function setUrl(search: string) {
  // happy-dom: assigning location.search updates the URL the component reads.
  window.history.replaceState({}, '', `/n/preview${search}`);
}

const cases = [
  { name: 'UPSELL_SKINCARE', tpl: upsellSkincareTemplate, productId: '90011', addLabel: /ADD COMBO TO MY ORDER/i, p1: '1 Combo Pack', p2: '2 Combo Packs' },
  { name: 'UPSELL_WELLNESS', tpl: upsellWellnessTemplate, productId: '39772', addLabel: /YES, ADD TO MY ORDER/i, p1: '1 Bottle', p2: '2 Bottles' },
];

describe('upsell template product-selection wiring', () => {
  beforeEach(() => {
    apiCall.mockReset();
    apiCall.mockResolvedValue({ success: true, nextStepUrl: '#next', order: {} });
  });

  for (const c of cases) {
    it(`${c.name}: selector feeds the add button so it is NOT "No product selected"`, async () => {
      const selectorProps = pickProps(c.tpl, 'VariantSelector');
      const buttonProps = pickProps(c.tpl, 'UpsellAddButton');

      // Real order context present -> the order-info guard passes and the productId guard is the one under test.
      setUrl('?orderId=ORD_TEST&anid=TRACK_TEST&funnelId=F1&upsellIndex=0');

      vi.useFakeTimers();
      render(
        <>
          <VariantSelector {...selectorProps} />
          <UpsellAddButton {...buttonProps} />
        </>,
      );
      // UpsellAddButton schedules requestProductSelection at 100ms; flush it so the selector broadcasts.
      await act(async () => { vi.advanceTimersByTime(200); });
      vi.useRealTimers();

      // Selector rendered the bound products, not the empty state.
      expect(screen.queryByText(/No products configured/i)).toBeNull();
      expect(screen.getByText(c.p1)).toBeTruthy();
      expect(screen.getByText(c.p2)).toBeTruthy();

      const addBtn = screen.getByRole('button', { name: c.addLabel });
      await act(async () => { fireEvent.click(addBtn); });

      // The fix: product flowed from selector to button, so the upsell call fires with the bound productId
      // and the "No product selected" error never appears.
      await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
      const [, payload] = apiCall.mock.calls[0] as [string, any];
      expect(payload.productId).toBe(c.productId);
      expect(payload.action).toBe('accept');
      expect(screen.queryByText(/No product selected/i)).toBeNull();
    });
  }
});

// Single-product OTO pages (glow / volt / atelier …) carry NO on-page selector;
// the product is bound directly on the button via `selectedProduct`. Without this
// the button had no product and the upsell could never complete.
describe('UpsellAddButton static binding via selectedProduct (no on-page selector)', () => {
  beforeEach(() => {
    apiCall.mockReset();
    apiCall.mockResolvedValue({ success: true, nextStepUrl: '#next', order: {} });
  });

  it('posts the bound productId on accept', async () => {
    setUrl('?orderId=ORD_TEST&anid=TRACK_TEST&funnelId=F1&upsellIndex=0');
    render(
      <UpsellAddButton
        selectedProduct={{
          items: [{ id: 'variant-1', productId: 'night-repair-duo', productName: 'Night Repair Duo', price: 29, quantity: 1, currency: 'USD' }],
          currency: 'USD',
        }}
        addButtonText="Yes — add to my order"
        showDeclineButton={false}
      />,
    );
    const addBtn = screen.getByRole('button', { name: /Yes — add to my order/i });
    await act(async () => { fireEvent.click(addBtn); });

    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
    const [, payload] = apiCall.mock.calls[0] as [string, any];
    expect(payload.productId).toBe('night-repair-duo');
    expect(payload.variantId).toBe('variant-1');
    expect(payload.action).toBe('accept');
  });

  it('with no product bound at all, accept makes no API call (regression guard)', async () => {
    setUrl('?orderId=ORD_TEST&anid=TRACK_TEST&funnelId=F1&upsellIndex=0');
    render(<UpsellAddButton addButtonText="Add it" showDeclineButton={false} />);
    const addBtn = screen.getByRole('button', { name: /Add it/i });
    await act(async () => { fireEvent.click(addBtn); });
    await new Promise((r) => setTimeout(r, 50));
    expect(apiCall).not.toHaveBeenCalled();
  });
});
