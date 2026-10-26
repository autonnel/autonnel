import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const apiCall = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiCall: (...args: unknown[]) => apiCall(...args) }));

import { UpsellAddButton } from './UpsellAddButton';

const BASE = '/upsell?orderId=o1&trackingId=t1';

function mount() {
  return render(<UpsellAddButton productId="p1" variantId="v1" />);
}

function accept() {
  fireEvent.click(screen.getByText(/Yes! Add to My Order/));
}

describe('UpsellAddButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    apiCall.mockReset();
    window.history.replaceState(null, '', BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function expectNoNavigation(response: unknown) {
    apiCall.mockResolvedValue(response);
    const loc = { href: window.location.href, pathname: window.location.pathname, search: window.location.search } as any;
    const initial = loc.href;
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc);
    mount();
    accept();
    await waitFor(() => expect(apiCall).toHaveBeenCalled());
    await screen.findByText(/\S/, { selector: 'div[style*="dc2626"]' });
    expect(loc.href).toBe(initial);
    expect((screen.getByText(/Yes! Add to My Order/).closest('button') as HTMLButtonElement).disabled).toBe(false);
  }

  it('does not navigate when success is false', () =>
    expectNoNavigation({ success: false, action: 'redirect', redirectUrl: 'https://pay.example/x' }));

  it('does not navigate when redirectUrl is missing', () =>
    expectNoNavigation({ success: true, action: 'redirect' }));

  it('does not navigate to a non-http redirectUrl', () =>
    expectNoNavigation({ success: true, action: 'redirect', redirectUrl: 'javascript:alert(1)' }));

  it('does not navigate to a relative redirectUrl', () =>
    expectNoNavigation({ success: true, action: 'redirect', redirectUrl: '/pay' }));

  it('sends cancelTo and redirects to the hosted payment page', async () => {
    apiCall.mockResolvedValue({ success: true, action: 'redirect', redirectUrl: 'https://pay.example/x' });
    const loc = { href: window.location.href, pathname: window.location.pathname, search: window.location.search } as any;
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc);
    mount();
    accept();
    await waitFor(() => expect(loc.href).toBe('https://pay.example/x'));
    expect(apiCall.mock.calls[0]![1].cancelTo).toBe('/upsell?orderId=o1&trackingId=t1');
    expect((screen.getByText(/Adding to order/).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('falls back to the anid cookie when the URL carries no tracking id', async () => {
    window.history.replaceState(null, '', '/upsell?orderId=o1');
    document.cookie = 'anid=visitor-1; path=/';
    apiCall.mockResolvedValue({ success: false });
    mount();
    accept();
    await waitFor(() => expect(apiCall).toHaveBeenCalled());
    expect(apiCall.mock.calls[0]![1].trackingId).toBe('visitor-1');
    document.cookie = 'anid=; path=/; max-age=0';
  });

  it('keeps accepted behavior', async () => {
    apiCall.mockResolvedValue({ success: true, nextStepUrl: 'https://next.example/' });
    const loc = { href: window.location.href, pathname: window.location.pathname, search: window.location.search } as any;
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc);
    mount();
    accept();
    await waitFor(() => expect(loc.href).toContain('https://next.example/'));
  });

  it('keeps declined behavior', async () => {
    apiCall.mockResolvedValue({ success: true, action: 'declined', nextStepUrl: 'https://next.example/' });
    const loc = { href: window.location.href, pathname: window.location.pathname, search: window.location.search } as any;
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc);
    mount();
    fireEvent.click(screen.getByText(/No thanks/));
    await waitFor(() => expect(loc.href).toContain('https://next.example/'));
    expect(apiCall.mock.calls[0]![1].action).toBe('decline');
  });

  it('shows payment_error once and strips it from the URL', async () => {
    window.history.replaceState(null, '', `${BASE}&payment_error=1`);
    mount();
    await screen.findByText('Payment was not completed. Please try again.');
    expect(window.location.search).toBe('?orderId=o1&trackingId=t1');
  });

  it('resets processing on bfcache restore', async () => {
    apiCall.mockResolvedValue({ success: true, action: 'redirect', redirectUrl: 'https://pay.example/x' });
    const loc = { href: window.location.href, pathname: window.location.pathname, search: window.location.search } as any;
    vi.spyOn(window, 'location', 'get').mockReturnValue(loc);
    mount();
    accept();
    await waitFor(() => expect(loc.href).toBe('https://pay.example/x'));
    act(() => {
      const e = new Event('pageshow') as any;
      e.persisted = true;
      window.dispatchEvent(e);
    });
    await waitFor(() => expect((screen.getByText(/Yes! Add to My Order/).closest('button') as HTMLButtonElement).disabled).toBe(false));
  });
});
