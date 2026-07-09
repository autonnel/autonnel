import { page, section, text, callout, infoBox, button, headerSection, footerSection } from '../_shared';

const TEAL = '#0d9488';
const SAND = '#fdf6ec';
const INK = '#0f2e2b';

export const recall2Design = page({
  backgroundColor: SAND,
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: TEAL, color: '#ffffff' }),
    section({
      backgroundColor: '#ffffff',
      padding: '28px 0 8px',
      children: [text({ html: '{{T:greeting-text}}', align: 'left' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '4px 0',
      children: [callout({ html: '{{T:coupon-box}}', backgroundColor: '#ccfbf1' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '18px 0',
      children: [button({ text: '{{T:cta-button}}', href: '{{checkoutUrl}}', backgroundColor: TEAL })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '4px 0',
      children: [infoBox({ html: '{{T:reviews-box}}', backgroundColor: SAND })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '12px 0 24px',
      children: [text({ html: '{{T:closing-text}}', align: 'left' })],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
