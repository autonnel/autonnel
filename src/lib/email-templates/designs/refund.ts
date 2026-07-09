import { page, section, text, callout, headerSection, footerSection } from '../_shared';

export const refundDesign = page({
  backgroundColor: '#eef1f4',
  rows: [
    headerSection({ text: '{{T:header-title}}', backgroundColor: '#3a4256', color: '#f4f6fa' }),
    section({
      backgroundColor: '#ffffff',
      padding: '28px 8px 8px',
      children: [text({ html: '{{T:greeting-text}}', padding: '0 28px 12px' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '0 16px 8px',
      children: [callout({ html: '{{T:refund-info}}', backgroundColor: '#e7ecf2' })],
    }),
    section({
      backgroundColor: '#ffffff',
      padding: '8px 8px 28px',
      children: [text({ html: '{{T:details-text}}', padding: '8px 28px 0' })],
    }),
    footerSection({ text: '{{T:footer-text}}' }),
  ],
});
