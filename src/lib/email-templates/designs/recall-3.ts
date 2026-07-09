import { page, section, text, callout, infoBox, button, headerSection, footerSection } from '../_shared';

const PLUM = '#7c2d6b';
const BLUSH = '#fbf3f9';
const AMBER = '#b45309';

export const recall3Design = page({
  backgroundColor: BLUSH,
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: PLUM, color: '#ffffff' }),
    section({
      backgroundColor: '#ffffff',
      padding: '28px 0 6px',
      children: [text({ html: '{{T:greeting-text}}', align: 'left' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '6px 0',
      children: [text({ html: '{{T:items-placeholder}}', align: 'left' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '6px 0',
      children: [callout({ html: '{{T:coupon-box}}', backgroundColor: '#fde68a' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '18px 0',
      children: [button({ text: '{{T:cta-button}}', href: '{{checkoutUrl}}', backgroundColor: AMBER })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '6px 0',
      children: [infoBox({ html: '{{T:feedback-box}}', backgroundColor: BLUSH })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '10px 0 24px',
      children: [text({ html: '{{T:closing-text}}', align: 'left' })],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
