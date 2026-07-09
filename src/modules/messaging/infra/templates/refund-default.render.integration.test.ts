import { describe, it, expect } from 'vitest';
import { buildDefaultVersion } from './default-version.factory';
import { TemplateRenderer } from '../../domain/services/template-renderer';

// Reproduces the blank-refund-email bug: when the variables map is dropped on the way to the
// renderer, every {{var}} previously collapsed to an empty string and a blank email shipped. The
// core lifecycle vars are now declared required, so the renderer fails loudly instead.
describe('ORDER_REFUNDED default render (integration)', () => {
  it('throws on an empty variables map instead of rendering a blank email', async () => {
    const version = await buildDefaultVersion('order.refunded', 'en');
    expect(version).not.toBeNull();

    expect(() =>
      new TemplateRenderer().render(version!, {}, { unsubscribeUrl: 'https://acme.test/u/abc' }),
    ).toThrow(/missing required variable\(s\).*orderNumber/);
  });

  it('renders the real refund values when variables are present', async () => {
    const version = await buildDefaultVersion('order.refunded', 'en');
    const rendered = new TemplateRenderer().render(
      version!,
      {
        orderNumber: '203594345829',
        refundAmount: '$6.00',
        refundDate: 'June 14, 2026',
        customerFirstName: 'Sherman',
        storeEmail: 'hello@acme.test',
      },
      { unsubscribeUrl: 'https://acme.test/u/abc' },
    );

    expect(rendered.subject).toContain('203594345829');
    expect(rendered.html).toContain('Refund Amount: $6.00');
    expect(rendered.html).toContain('Order #203594345829');
    expect(rendered.html).toContain('Hi Sherman,');
    expect(rendered.html).toContain('hello@acme.test');
    // the blank-email symptom must not recur
    expect(rendered.html).not.toContain('Refund Amount: </strong>');
  });
});
