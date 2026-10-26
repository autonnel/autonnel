import { describe, it, expect } from 'vitest';
import { ClientHandle } from '../value-objects';

describe('ClientHandle', () => {
  it('builds a redirect handle for any provider slug', () => {
    const h = ClientHandle.of('ACME', 'redirect_url', 'https://pay.example/x');
    expect(h.provider).toBe('ACME');
    expect(h.kind).toBe('redirect_url');
    expect(h.value).toBe('https://pay.example/x');
  });

  it('keeps the built-in constructors', () => {
    expect(ClientHandle.stripeClientSecret('cs').kind).toBe('client_secret');
    expect(ClientHandle.paypalApprovalUrl('u').provider).toBe('PAYPAL');
  });
});
