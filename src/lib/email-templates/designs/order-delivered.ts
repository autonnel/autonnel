import { page, section, text, callout, button, headerSection, footerSection } from '../_shared';

const INK = '#2a2118';
const AMBER = '#c2700f';
const SAND = '#fbf4ea';
const PARCHMENT = '#fff9f0';

export const orderDeliveredDesign = page({
  backgroundColor: PARCHMENT,
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: INK, color: '#fdf3e3' }),
    section({
      backgroundColor: '#ffffff',
      padding: '34px 8px 10px',
      children: [text({ html: '{{T:greeting-text}}', align: 'left', padding: '0 30px 16px' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '0 8px 22px',
      children: [button({ text: '{{T:review-button}}', href: '{{storeUrl}}', backgroundColor: AMBER })],
    }),
    section({
      backgroundColor: SAND,
      padding: '20px 16px',
      children: [callout({ html: '{{T:review-prompt}}', backgroundColor: SAND })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '22px 16px 32px',
      children: [text({ html: '{{T:delivery-info}}', align: 'left', padding: '0 30px' })],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
