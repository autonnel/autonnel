import { describe, it, expect } from 'vitest';
import { TemplateRenderer, resolveConditionals } from './template-renderer';
import { MessageTemplate } from '../message-template';
import { ChannelType, TemplateKey } from '../value-objects';
import { VariableSchema } from '../variable-schema';

function conditionalVersion() {
  const t = MessageTemplate.create({ tenantId: 'default', templateKey: TemplateKey.of('order.receipt') });
  const v = t.addDraft({
    channel: ChannelType.EMAIL,
    locale: 'en',
    subject: 'Receipt #{{orderNumber}}',
    html:
      '<p>Hi {{firstName}}</p>' +
      '<!-- IF_COUPON --><span>Code {{couponCode}}</span><!-- END_COUPON -->' +
      '<!-- IF_ADDRESS2 --><span>{{shippingAddress2}}</span><!-- END_ADDRESS2 -->' +
      '<!-- IF_UNKNOWN --><span>always {{firstName}}</span><!-- END_UNKNOWN -->',
    text:
      'Hi {{firstName}}' +
      '<!-- IF_COUPON --> code {{couponCode}}<!-- END_COUPON -->',
    schema: VariableSchema.of([
      { name: 'orderNumber', required: true },
      { name: 'firstName', required: false },
      { name: 'couponCode', required: false },
      { name: 'shippingAddress2', required: false },
    ]),
  });
  t.publish(v.versionId);
  return v;
}

function publishedVersion() {
  const t = MessageTemplate.create({ tenantId: 'default', templateKey: TemplateKey.of('order.receipt') });
  const v = t.addDraft({
    channel: ChannelType.EMAIL,
    locale: 'en',
    subject: 'Receipt #{{orderNumber}}',
    html: '<p>Hi {{firstName}}, total {{total}}</p>',
    text: 'Hi {{firstName}}, total {{total}}',
    schema: VariableSchema.of([
      { name: 'orderNumber', required: true },
      { name: 'firstName', required: true },
      { name: 'total', required: true },
    ]),
  });
  t.publish(v.versionId);
  return v;
}

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  it('interpolates declared variables into subject/html/text', () => {
    const r = renderer.render(publishedVersion(), { orderNumber: '1001', firstName: 'Ada', total: '$42.00' }, {
      unsubscribeUrl: 'https://shop.com/u/abc',
    });
    expect(r.subject).toBe('Receipt #1001');
    expect(r.html).toContain('Hi Ada, total $42.00');
    expect(r.text).toContain('Hi Ada, total $42.00');
    expect(r.headers['List-Unsubscribe']).toBe('<https://shop.com/u/abc>');
  });

  it('HTML-escapes interpolated values in the html body (XSS-safe) but not the text body', () => {
    const r = renderer.render(publishedVersion(), { orderNumber: '1', firstName: '<script>x</script>', total: '$1' }, {
      unsubscribeUrl: 'https://shop.com/u/abc',
    });
    expect(r.html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(r.html).not.toContain('<script>x</script>');
    expect(r.text).toContain('<script>x</script>'); // text part is literal
  });

  it('inserts *Html variable values as raw markup while still escaping other values', () => {
    const t = MessageTemplate.create({ tenantId: 'default', templateKey: TemplateKey.of('order.receipt') });
    const v = t.addDraft({
      channel: ChannelType.EMAIL,
      locale: 'en',
      subject: 'Receipt #{{orderNumber}}',
      html: '<p>Hi {{firstName}}</p>{{orderItemsHtml}}',
      text: 'Hi {{firstName}}',
      schema: VariableSchema.of([
        { name: 'orderNumber', required: true },
        { name: 'firstName', required: false },
        { name: 'orderItemsHtml', required: false },
      ]),
    });
    t.publish(v.versionId);

    const r = renderer.render(
      v,
      {
        orderNumber: '1',
        firstName: '<b>x</b>',
        orderItemsHtml: '<table><tr><td>Widget &times; 1</td></tr></table>',
      },
      { unsubscribeUrl: 'https://shop.com/u/a' },
    );

    expect(r.html).toContain('<table><tr><td>Widget &times; 1</td></tr></table>');
    expect(r.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(r.html).not.toContain('<b>x</b>');
  });

  it('throws when a required variable is missing', () => {
    expect(() =>
      renderer.render(publishedVersion(), { orderNumber: '1', firstName: 'Ada' }, { unsubscribeUrl: 'https://shop.com/u/a' }),
    ).toThrow(/missing required variable.*total/i);
  });

  it('does not evaluate expressions or access globals (sandboxed): unknown tokens render empty', () => {
    // `constructor` is not a declared var; schema validation would catch declared-undeclared at publish.
    // Here we prove the engine treats {{x}} as a literal lookup, never as code.
    const r = renderer.render(publishedVersion(), { orderNumber: '1', firstName: 'Ada', total: '{{evil}}' }, {
      unsubscribeUrl: 'https://shop.com/u/a',
    });
    // the merge value '{{evil}}' is inserted literally and escaped, never re-interpolated
    expect(r.html).toContain('{{evil}}');
  });

  it('keeps a conditional block when its mapped variable is a non-empty string', () => {
    const r = renderer.render(conditionalVersion(), { orderNumber: '1', firstName: 'Ada', couponCode: 'SAVE10' }, {
      unsubscribeUrl: 'https://shop.com/u/a',
    });
    expect(r.html).toContain('Code SAVE10');
    expect(r.text).toContain('code SAVE10');
    expect(r.html).not.toContain('IF_COUPON');
    expect(r.html).not.toContain('END_COUPON');
  });

  it('drops a conditional block when its mapped variable is absent or empty', () => {
    const r = renderer.render(conditionalVersion(), { orderNumber: '1', firstName: 'Ada', couponCode: '' }, {
      unsubscribeUrl: 'https://shop.com/u/a',
    });
    expect(r.html).not.toContain('Code');
    expect(r.text).not.toContain('code');
    expect(r.html).not.toContain('IF_COUPON');
  });

  it('treats independent blocks separately (address2 present while coupon absent)', () => {
    const r = renderer.render(conditionalVersion(), { orderNumber: '1', firstName: 'Ada', shippingAddress2: 'Apt 5' }, {
      unsubscribeUrl: 'https://shop.com/u/a',
    });
    expect(r.html).toContain('Apt 5');
    expect(r.html).not.toContain('Code ');
  });

  it('keeps content of an unknown conditional name and strips its markers', () => {
    const r = renderer.render(conditionalVersion(), { orderNumber: '1', firstName: 'Ada' }, {
      unsubscribeUrl: 'https://shop.com/u/a',
    });
    expect(r.html).toContain('always Ada');
    expect(r.html).not.toContain('IF_UNKNOWN');
    expect(r.html).not.toContain('END_UNKNOWN');
  });

  it('resolveConditionals is a pure helper independent of substitution', () => {
    const out = resolveConditionals('a<!-- IF_TAX -->T<!-- END_TAX -->b', { orderTax: '$3.00' });
    expect(out).toBe('aTb');
    const hidden = resolveConditionals('a<!-- IF_TAX -->T<!-- END_TAX -->b', {});
    expect(hidden).toBe('ab');
  });
});
