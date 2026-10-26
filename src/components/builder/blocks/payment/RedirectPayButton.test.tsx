import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RedirectPayButton } from './RedirectPayButton';

function fillForm() {
  for (const [k, v] of [['email', 'a@b.co'], ['firstName', 'Ada'], ['lastName', 'L'], ['phone', '555'], ['address1', '1 Main'], ['city', 'Austin'], ['postalCode', '73301']]) {
    const el = document.createElement('input');
    el.name = k!;
    el.value = v!;
    document.body.appendChild(el);
  }
}

function mount() {
  return render(<RedirectPayButton provider="ACME" buttonColor="#000" buttonText="Pay" onProcessingChange={() => {}} />);
}

describe('RedirectPayButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__CHECKOUT_STATE__ = undefined;
    (window as any).Autonnel = undefined;
    window.history.replaceState(null, '', '/');
  });

  function stubLocation() {
    const original = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { href: 'http://localhost/', search: original.search, pathname: original.pathname, hash: '', reload } });
    return { reload, restore: () => Object.defineProperty(window, 'location', { configurable: true, value: original }) };
  }

  function pageshow(persisted: boolean) {
    act(() => {
      const e = new Event('pageshow') as any;
      e.persisted = persisted;
      window.dispatchEvent(e);
    });
  }

  it('reloads when the page is restored from bfcache so the hosted url is never reused', () => {
    const loc = stubLocation();
    mount();
    pageshow(false);
    expect(loc.reload).not.toHaveBeenCalled();
    pageshow(true);
    expect(loc.reload).toHaveBeenCalledOnce();
    loc.restore();
  });

  it('navigates to an absolute http(s) hosted url', async () => {
    fillForm();
    const loc = stubLocation();
    (window as any).Autonnel = { checkout: { ensureOrder: vi.fn().mockResolvedValue({ orderId: 'o', clientHandle: 'https://pay.example/session/1' }) } };
    mount();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(window.location.href).toBe('https://pay.example/session/1'));
    loc.restore();
  });

  it.each(['javascript:alert(1)', '/relative/path', 'not a url'])('shows the error instead of navigating to %s', async (clientHandle) => {
    fillForm();
    const loc = stubLocation();
    (window as any).Autonnel = { checkout: { ensureOrder: vi.fn().mockResolvedValue({ orderId: 'o', clientHandle }) } };
    mount();
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/Could not start your payment/);
    expect(window.location.href).toBe('http://localhost/');
    loc.restore();
  });

  it('recovers when ensureOrder rejects', async () => {
    fillForm();
    (window as any).Autonnel = { checkout: { ensureOrder: vi.fn().mockRejectedValue(new Error('boom')) } };
    mount();
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/Could not start your payment/);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the payment_error flag once and strips it from the URL keeping other params', async () => {
    window.history.replaceState(null, '', '/checkout?payment_error=1&foo=bar');
    mount();
    await screen.findByText(/Payment was not completed/);
    expect(window.location.search).toBe('?foo=bar');
  });

  it('shows the translated reason the checkout dispatched instead of the generic error', async () => {
    fillForm();
    const ensureOrder = vi.fn(async () => {
      window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', {
        detail: { message: 'Diese Zahlungsmethode unterstützt die ausgewählte Währung nicht.', reason: '1105 Currency not supported for this site' },
      }));
      return null;
    });
    (window as any).Autonnel = { checkout: { ensureOrder } };
    mount();
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('Diese Zahlungsmethode unterstützt die ausgewählte Währung nicht.');
    expect(screen.queryByText(/Could not start your payment/)).toBeNull();
  });
});
