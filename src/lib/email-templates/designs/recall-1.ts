import { page, section, text, callout, infoBox, button, headerSection, footerSection } from '../_shared';

const CORAL = '#ef5d52';
const CREAM = '#fff7f4';
const BLUSH = '#fde4dd';

export const recall1Design = page({
  backgroundColor: CREAM,
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: CORAL, color: '#fffaf8' }),
    section({
      backgroundColor: '#ffffff',
      padding: '30px 0 6px',
      children: [text({ html: '{{T:greeting-text}}', align: 'left' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '6px 0 4px',
      children: [text({ html: '{{T:items-placeholder}}', align: 'left' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '20px 0 8px',
      children: [button({ text: '{{T:cta-button-label}}', href: '{{checkoutUrl}}', backgroundColor: CORAL })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '6px 0',
      children: [callout({ html: '{{T:coupon-text}}', backgroundColor: BLUSH })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '10px 0',
      children: [infoBox({ html: '{{T:trust-box}}', backgroundColor: CREAM })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '8px 0 28px',
      children: [text({ html: '{{T:closing-text}}', align: 'center' })],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
