import { page, section, text, button, infoBox, headerSection, footerSection } from '../_shared';

export const shippedDesign = page({
  backgroundColor: '#f0f7f4',
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: '#0f766e', color: '#ecfdf5' }),
    section({
      backgroundColor: '#ffffff',
      padding: '32px 8px 4px',
      children: [text({ html: '{{T:greeting-text}}', align: 'center', padding: '0 32px 20px' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '0 8px 24px',
      children: [button({ text: '{{T:track-button}}', href: '{{trackingUrl}}', backgroundColor: '#0d9488' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '0 16px 28px',
      children: [infoBox({ html: '{{T:tracking-info}}', backgroundColor: '#e6f4f1' })],
    }),
    section({
      backgroundColor: '#fbfdfc',
      padding: '4px 8px 24px',
      children: [
        text({ html: '{{T:address-heading}}', padding: '0 32px 6px' }),
        infoBox({ html: '{{T:address-text}}', backgroundColor: '#ffffff' }),
      ],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
