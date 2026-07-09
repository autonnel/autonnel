import { page, section, text, infoBox, callout, headerSection, footerSection } from '../_shared';

const T = (id: string) => `{{T:${id}}}`;

const banner = headerSection({ text: T('header-title') });

const intro = section({
  backgroundColor: '#ffffff',
  padding: '28px 28px 12px',
  children: [
    text({ html: T('greeting-text'), padding: '0 0 14px' }),
    callout({ html: T('order-info-text'), backgroundColor: '#eef2ff' }),
  ],
});

const lineItems = section({
  backgroundColor: '#ffffff',
  padding: '4px 28px 12px',
  children: [
    text({ html: T('items-heading'), padding: '0 0 6px' }),
    text({ html: T('items-list'), padding: '0' }),
    infoBox({ html: T('totals-table') }),
  ],
});

const delivery = section({
  backgroundColor: '#ffffff',
  padding: '4px 28px 12px',
  children: [
    text({ html: T('address-heading'), padding: '0 0 6px' }),
    infoBox({ html: T('address-text') }),
  ],
});

const signoff = section({
  backgroundColor: '#ffffff',
  padding: '4px 28px 28px',
  children: [text({ html: T('closing-text'), padding: '0' })],
});

export const orderReceiptDesign = page({
  backgroundColor: '#eef0f3',
  rows: [banner, intro, lineItems, delivery, signoff, footerSection({ text: T('footer-text') })],
});
