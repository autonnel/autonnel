import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDefaultTemplate = vi.fn();

vi.mock('@/lib/email-templates/default-templates', () => ({
  getDefaultTemplate: (...args: unknown[]) => getDefaultTemplate(...args),
}));

import { buildDefaultVersion, GENERIC_NOTIFICATION_KEY } from './default-version.factory';
import { TemplateRenderer } from '../../domain/services/template-renderer';
import { ChannelType } from '../../domain/value-objects';

describe('buildDefaultVersion', () => {
  beforeEach(() => getDefaultTemplate.mockReset());

  it('builds a published EMAIL version from the styled default with every referenced var declared', async () => {
    getDefaultTemplate.mockResolvedValue({
      name: 'Receipt',
      subject: 'Receipt {{orderNumber}}',
      design: {},
      content: '<p>Hi {{customerFirstName}}, total {{orderTotal}} for {{orderNumber}}</p>',
    });

    const version = await buildDefaultVersion('order.receipt', 'en');

    expect(version).not.toBeNull();
    expect(version!.channel).toBe(ChannelType.EMAIL);
    expect(version!.locale).toBe('en');
    expect(version!.isPublished).toBe(true);
    expect(version!.versionId).toBe('default');
    expect(version!.subject).toBe('Receipt {{orderNumber}}');
    expect(version!.text).toBe('');
    // every distinct token must be declared (required:false) so validate() never throws on empties
    for (const name of ['orderNumber', 'customerFirstName', 'orderTotal']) {
      expect(version!.schema.declares(name)).toBe(true);
    }
    expect(getDefaultTemplate).toHaveBeenCalledWith('ORDER_RECEIPT', 'en');
  });

  it('declares vars referenced only inside conditional blocks', async () => {
    getDefaultTemplate.mockResolvedValue({
      name: 'Receipt',
      subject: 'Receipt',
      design: {},
      content: '<!-- IF_COUPON -->{{couponCode}} {{couponDiscount}}<!-- END_COUPON -->',
    });

    const version = await buildDefaultVersion('order.receipt', 'en');
    expect(version!.schema.declares('couponCode')).toBe(true);
    expect(version!.schema.declares('couponDiscount')).toBe(true);
  });

  it('returns null for an unknown messaging key', async () => {
    const version = await buildDefaultVersion('not.a.key', 'en');
    expect(version).toBeNull();
    expect(getDefaultTemplate).not.toHaveBeenCalled();
  });

  it('maps recall keys to their styled defaults', async () => {
    getDefaultTemplate.mockResolvedValue({ name: 'R', subject: 'S', design: {}, content: '<p>{{storeName}}</p>' });
    const version = await buildDefaultVersion('recall.touch.2', 'fr');
    expect(version).not.toBeNull();
    expect(getDefaultTemplate).toHaveBeenCalledWith('RECALL_2', 'fr');
  });

  it('renders the generic notification key from caller subject/body without a styled default', async () => {
    const version = await buildDefaultVersion(GENERIC_NOTIFICATION_KEY, 'en');
    expect(version).not.toBeNull();
    expect(version!.channel).toBe(ChannelType.EMAIL);
    expect(version!.isPublished).toBe(true);
    expect(getDefaultTemplate).not.toHaveBeenCalled();

    const rendered = new TemplateRenderer().render(
      version!,
      { subject: 'Order paid', body: 'Total <b>$10</b>' },
      { unsubscribeUrl: 'https://x/u' },
    );
    expect(rendered.subject).toBe('Order paid');
    expect(rendered.html).toContain('Total &lt;b&gt;$10&lt;/b&gt;');
    expect(rendered.text).toBe('Total <b>$10</b>');
  });
});
