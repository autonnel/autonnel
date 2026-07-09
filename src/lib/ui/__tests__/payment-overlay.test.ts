// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hidePaymentError,
  hideProcessingOverlay,
  isPaymentErrorOpen,
  showPaymentError,
  showProcessingOverlay,
  updateProcessingOverlay,
} from '../payment-overlay';

declare global {
  interface Window {
    __pwn?: unknown;
  }
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as any).__pwn;
});

afterEach(() => {
  delete (window as any).__pwn;
});

describe('showPaymentError XSS resistance', () => {
  const payloads = [
    '<img src=x onerror=window.__pwn=1>',
    '<svg onload=window.__pwn=1>',
    '"><script>window.__pwn=1</script>',
  ];

  it.each(payloads)('does not execute payload: %s', (payload) => {
    showPaymentError(payload);

    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('svg[onload]')).toBeNull();

    const messageEl = document.querySelector('.autonnel-payment-error-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl!.textContent).toBe(payload);

    expect((window as any).__pwn).toBeUndefined();
  });
});

describe('showPaymentError modal lifecycle', () => {
  it('does not stack multiple modals on repeated show', () => {
    showPaymentError('first');
    showPaymentError('second');
    showPaymentError('third');

    const modals = document.querySelectorAll('#payment-error-modal');
    expect(modals.length).toBe(1);

    const messageEl = document.querySelector('.autonnel-payment-error-message');
    expect(messageEl!.textContent).toBe('third');
  });

  it('isPaymentErrorOpen reflects modal presence', () => {
    expect(isPaymentErrorOpen()).toBe(false);
    showPaymentError('boom');
    expect(isPaymentErrorOpen()).toBe(true);
    hidePaymentError();
    expect(isPaymentErrorOpen()).toBe(false);
  });

  it('hidePaymentError removes modal node', () => {
    showPaymentError('boom');
    expect(document.getElementById('payment-error-modal')).not.toBeNull();
    hidePaymentError();
    expect(document.getElementById('payment-error-modal')).toBeNull();
  });

  it('cancel button invokes onCancel and removes modal', () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    showPaymentError('boom', { onCancel, onRetry });

    const cancelBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(document.getElementById('payment-error-modal')).toBeNull();
  });

  it('retry button invokes onRetry and removes modal', () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    showPaymentError('boom', { onCancel, onRetry });

    const retryBtn = document.getElementById('modal-retry-btn') as HTMLButtonElement;
    retryBtn.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.getElementById('payment-error-modal')).toBeNull();
  });

  it('uses default message when none supplied', () => {
    showPaymentError();
    const messageEl = document.querySelector('.autonnel-payment-error-message');
    expect(messageEl!.textContent).toMatch(/payment could not be processed/i);
  });
});

describe('processing overlay lifecycle', () => {
  it('show -> update -> hide flow updates message via textContent', () => {
    showProcessingOverlay('Initial');
    const overlay = document.getElementById('processing-overlay');
    const msg = document.getElementById('processing-message');
    expect(overlay).not.toBeNull();
    expect(msg!.textContent).toBe('Initial');

    updateProcessingOverlay('Updated message');
    expect(document.getElementById('processing-message')!.textContent).toBe('Updated message');

    hideProcessingOverlay();
    expect(document.getElementById('processing-overlay')).toBeNull();
  });

  it('default message is "Processing..."', () => {
    showProcessingOverlay();
    expect(document.getElementById('processing-message')!.textContent).toBe('Processing...');
  });

  it('overlay is XSS-safe for message argument', () => {
    const payload = '<img src=x onerror=window.__pwn=1>';
    showProcessingOverlay(payload);
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.getElementById('processing-message')!.textContent).toBe(payload);
    expect((window as any).__pwn).toBeUndefined();
  });
});

describe('keyframes injection', () => {
  it('injects style tag once across multiple calls', () => {
    showPaymentError('a');
    showProcessingOverlay('b');
    showPaymentError('c');
    updateProcessingOverlay('d');
    showProcessingOverlay('e');

    const styles = document.head.querySelectorAll('style#autonnel-payment-overlay-styles');
    expect(styles.length).toBe(1);
  });
});
