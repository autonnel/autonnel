import { describe, it, expect } from 'vitest';
import { buildDefaultVersion } from './default-version.factory';
import { TemplateRenderer } from '../../domain/services/template-renderer';

// End-to-end render of the real styled ORDER_RECEIPT default (bundle -> MJML compile -> renderer)
// reproducing the customer receipt screenshot: the order line-items table must render as markup,
// and an unsupported checkout locale must not leak CJK date/currency formatting into English copy.
const ITEMS_HTML =
  '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">' +
  '<tr><td style="padding:6px 0;">E2E Widget - Default &times; 1</td>' +
  '<td align="right" style="padding:6px 0;">US$19.99</td></tr></table>';

describe('ORDER_RECEIPT default render (integration)', () => {
  it('renders orderItemsHtml as a real table, not escaped literal markup', async () => {
    const version = await buildDefaultVersion('order.receipt', 'en');
    expect(version).not.toBeNull();

    const rendered = new TemplateRenderer().render(
      version!,
      {
        orderNumber: '203594345829',
        customerFirstName: 'Sherman',
        customerFullName: 'Sherman Eidson',
        orderDate: 'June 14, 2026',
        orderItemsHtml: ITEMS_HTML,
        orderSubtotal: '$19.99',
        orderTotal: '$19.99',
        storeName: 'Acme',
        storeUrl: 'https://acme.test',
        storeEmail: 'hello@acme.test',
      },
      { unsubscribeUrl: 'https://acme.test/u/abc' },
    );

    expect(rendered.html).toContain('E2E Widget - Default &times; 1');
    expect(rendered.html).toContain('<td align="right"');
    expect(rendered.html).not.toContain('&lt;table');
    expect(rendered.html).toContain('June 14, 2026');
    // the screenshot leaked CJK date characters; the rendered receipt must stay ASCII
    expect(rendered.html).not.toMatch(/年|月|日/);
  });
});
