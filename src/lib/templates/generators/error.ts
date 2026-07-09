import type { Data } from '@puckeditor/core';

const INK = '#0f172a';
const SLATE = '#334155';
const MUTED = '#64748b';
const SOFT = '#f8fafc';
const SURFACE = '#ffffff';
const BORDER = '#e2e8f0';
const PRIMARY = '#4f46e5';
const AMBER_BG = '#fef3c7';
const AMBER_TEXT = '#92400e';
const GREEN = '#16a34a';
const FOOTER_BG = '#0f172a';

const NUMBER_DOTS = [
  -190, -170, -150, -130,
  -80, -60, -40, -20,
  30, 50, 70, 90,
  140, 160, 180, 200,
]
  .map((x) => `<circle cx="${x}" cy="40" r="7"/>`)
  .join('');

const ERROR_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 758" fill="none">`
  + `<rect width="800" height="758" fill="#eef2ff"/>`
  + `<circle cx="110" cy="120" r="66" fill="#e0e7ff"/>`
  + `<circle cx="700" cy="650" r="98" fill="#e0e7ff"/>`
  + `<circle cx="672" cy="150" r="22" fill="#c7d2fe"/>`
  + `<circle cx="150" cy="628" r="15" fill="#c7d2fe"/>`
  + `<circle cx="612" cy="588" r="9" fill="#a5b4fc"/>`
  + `<circle cx="205" cy="182" r="7" fill="#a5b4fc"/>`
  + `<ellipse cx="400" cy="588" rx="196" ry="26" fill="#4f46e5" opacity="0.10"/>`
  + `<g transform="translate(400 358) rotate(-8)">`
  +   `<rect x="-236" y="-136" width="472" height="304" rx="30" fill="#c7d2fe" opacity="0.55"/>`
  +   `<rect x="-236" y="-152" width="472" height="304" rx="30" fill="#ffffff"/>`
  +   `<rect x="-236" y="-152" width="472" height="304" rx="30" fill="none" stroke="#e2e8f0" stroke-width="2"/>`
  +   `<rect x="-196" y="-96" width="70" height="52" rx="10" fill="#fcd34d"/>`
  +   `<line x1="-161" y1="-96" x2="-161" y2="-44" stroke="#f59e0b" stroke-width="2" opacity="0.5"/>`
  +   `<line x1="-196" y1="-70" x2="-126" y2="-70" stroke="#f59e0b" stroke-width="2" opacity="0.5"/>`
  +   `<circle cx="150" cy="-84" r="30" fill="#f59e0b" opacity="0.85"/>`
  +   `<circle cx="192" cy="-84" r="30" fill="#4f46e5" opacity="0.55"/>`
  +   `<g fill="#cbd5e1">${NUMBER_DOTS}</g>`
  +   `<rect x="-190" y="92" width="150" height="14" rx="7" fill="#e2e8f0"/>`
  +   `<circle cx="196" cy="128" r="58" fill="#eef2ff"/>`
  +   `<circle cx="196" cy="128" r="50" fill="#f59e0b"/>`
  +   `<rect x="190" y="104" width="12" height="30" rx="6" fill="#ffffff"/>`
  +   `<circle cx="196" cy="146" r="7" fill="#ffffff"/>`
  + `</g>`
  + `</svg>`,
)}`;

export const errorTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' } as any },
  content: [
    {
      type: 'NoticeBar',
      props: {
        id: 'error-notice-1',
        text: { text: 'Good news — your card was not charged. Review your details below and try again.', color: AMBER_TEXT, fontSize: 14 },
        link: { type: 'custom' as const, url: '' },
        backgroundColor: AMBER_BG,
        padding: 12,
        fullWidth: false,
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'error-hero-1',
        sectionTitle: { text: 'PAYMENT UNSUCCESSFUL', color: PRIMARY, fontSize: 13 },
        headline: { text: 'There was a problem with your payment', color: INK, fontSize: 38 },
        description:
          "We couldn't process your payment — but don't worry, nothing was charged. This usually comes down to something small: a mistyped card detail, insufficient funds, or a temporary hold from your bank. Run through the quick checks, then try again below.",
        bulletPoints: [
          { icon: '💳', title: 'Check your card details', description: 'Confirm the card number, expiry date, and CVV are entered correctly.' },
          { icon: '🏦', title: 'Verify available funds', description: 'Make sure your account has enough balance and no bank hold.' },
          { icon: '🔁', title: 'Try again or switch cards', description: 'A quick retry — or a different card or PayPal — often does the trick.' },
          { icon: '💬', title: 'Contact support', description: 'Still stuck? Our team is here to help you complete your order.' },
        ],
        image: { url: ERROR_ILLUSTRATION, prompt: '', mediaType: 'image' as const },
        imagePosition: 'right',
        backgroundColor: SOFT,
      },
    },
    {
      type: 'ColumnLayout',
      props: {
        id: 'error-retry-cols-1',
        maxWidth: 1040,
        gap: 44,
        rowGap: 20,
        backgroundColor: SURFACE,
        distribution: '55fr 45fr',
        mobileBreakpoint: 768,
        verticalAlign: 'start',
        padding: 64,
        left: [
          {
            type: 'PaymentEntryForm',
            props: {
              id: 'error-retry-form-1',
              sectionTitle: { text: 'Try your payment again', color: INK, fontSize: 20 },
              titleIcon: 'none',
              showPayPalOption: true,
              buttonText: 'Retry Payment',
              buttonColor: PRIMARY,
              showSecurityBadges: true,
              backgroundColor: SOFT,
              borderColor: BORDER,
              borderRadius: 16,
              padding: 28,
            },
          },
        ],
        right: [
          {
            type: 'RichTextBlock',
            props: {
              id: 'error-trust-heading-1',
              title: { text: "You're in safe hands", color: INK, fontSize: 22 },
              titleAlignment: 'left',
              lastUpdated: { text: '', color: MUTED, fontSize: 12 },
              content: 'Every payment on this store is protected. Here is what that means for you:',
              contentFontSize: 15,
              contentAlignment: 'left',
              maxWidth: '100%',
              backgroundColor: 'transparent',
              textColor: MUTED,
              padding: '4px 0 0',
            },
          },
          {
            type: 'BenefitList',
            props: {
              id: 'error-trust-list-1',
              benefits: [
                { text: '<strong>Encrypted &amp; secure</strong> — protected by 256-bit SSL, just like your bank.', isHighlighted: false },
                { text: "<strong>No charge until it works</strong> — you're only billed on a successful payment.", isHighlighted: false },
                { text: '<strong>Pay your way</strong> — use any major card or check out with PayPal.', isHighlighted: false },
                { text: '<strong>Here to help</strong> — friendly support, seven days a week.', isHighlighted: false },
              ],
              checkColor: GREEN,
              textColor: SLATE,
              highlightColor: PRIMARY,
              backgroundColor: 'transparent',
              padding: 0,
            },
          },
        ],
      },
    },
    {
      type: 'FaqAccordion',
      props: {
        id: 'error-faq-1',
        title: { text: 'Common payment questions', color: INK, fontSize: 32 },
        backgroundColor: SOFT,
        faqs: [
          { question: 'Why was my payment declined?', answer: 'Common reasons include insufficient funds, incorrect card details, expired cards, or a temporary hold from your bank. Double-check your information or contact your bank if it keeps happening.' },
          { question: 'Can I try a different payment method?', answer: 'Yes. You can switch between credit card and PayPal, or use a different card altogether — just pick another option in the form above.' },
          { question: 'Will I be charged multiple times?', answer: 'No. If a payment fails you are not charged. Only successful transactions result in a charge, so it is safe to try again.' },
          { question: 'How do I contact support?', answer: 'Reach our support team by email or live chat. We are available every day to help you resolve any issue and complete your order.' },
        ],
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'error-footer-1',
        theme: 'compact',
        brandName: { text: 'Your Brand', color: '#ffffff', fontSize: 18 },
        backgroundColor: FOOTER_BG,
        showNav: true,
        showAbout: false,
        showLogo: false,
        showCopyright: true,
        showSocial: false,
        links: [
          { label: { text: 'Home', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/' } },
          { label: { text: 'Contact Support', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/contact' } },
        ],
        copyright: { text: '© 2026 Your Brand. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        padding: 32,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
