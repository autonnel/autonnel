import type { Data } from '@puckeditor/core';

const CREAM = '#f8f1ea';
const CREAM_CARD = '#f1e6db';
const CORAL = '#c46b54';
const CORAL_DARK = '#a8543e';
const DARK_TEXT = '#2b1d18';

const BEAUTY_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100" viewBox="0 0 240 100">`
  + `<circle cx="36" cy="42" r="22" fill="none" stroke="#c46b54" stroke-width="2"/>`
  + `<circle cx="36" cy="42" r="12" fill="#f1e2d8"/>`
  + `<rect x="22" y="56" width="28" height="5" rx="1" fill="#c46b54"/>`
  + `<text x="72" y="50" font-family="'Playfair Display', serif" font-style="italic" font-size="36" font-weight="500" fill="#a8543e">Beauty</text>`
  + `<text x="78" y="72" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" letter-spacing="3" fill="#a8543e">SKIN CARE CREAM</text>`
  + `</svg>`,
)}`;

export const checkoutSkincareTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'ColumnLayout',
      props: {
        id: 'cols-checkout-skincare-1',
        maxWidth: 0,
        gap: 0,
        backgroundColor: CREAM,
        distribution: '1fr 1fr',
        mobileBreakpoint: 768,
        verticalAlign: 'stretch',
        padding: 0,
        left: [
          {
            type: 'CheckoutHeader',
            props: {
              id: 'hero-checkout-skincare-1',
              brandLogo: { url: BEAUTY_LOGO, prompt: '', mediaType: 'image' as const },
              brandName: { text: '', color: CORAL_DARK, fontSize: 36 },
              productImage: { url: 'https://placehold.co/600x800/f8f1ea/a8543e?text=B.S.C.+Cream+jar', prompt: '', mediaType: 'image' as const },
              productImageWidth: 440,
              productImageFill: true,
              benefits: [],
              backgroundColor: CREAM,
            },
          },
        ],
        right: [
          {
            type: 'ShippingAddressForm',
            props: {
              id: 'address-checkout-skincare-1',
              sectionTitle: { text: 'Billing details', color: CORAL_DARK, fontSize: 20 },
              titleIcon: 'none',
              type: 'both',
              showPhone: true,
              showEmail: true,
              useGoogleAutocomplete: false,
              addressPlaceholder: 'House number and street name',
              backgroundColor: '#ffffff',
              borderColor: '#e8d7cc',
              borderRadius: 0,
              padding: 24,
            },
          },
          {
            type: 'VariantSelector',
            props: {
              id: 'products-checkout-skincare-1',
              theme: 'card',
              sectionTitle: { text: 'Your Products', color: CORAL_DARK, fontSize: 18 },
              selectedItems: {
                items: [
                  {
                    id: 'beauty-skincare-cream-83202',
                    productId: '83202',
                    productName: 'Beauty Skincare Cream (#83202)',
                    price: 20.00,
                    thumbnail: 'https://placehold.co/64x64/f8f1ea/a8543e?text=Cream',
                    quantity: 1,
                    currency: 'USD',
                  },
                ],
                currency: 'USD',
              },
              accentColor: CORAL,
              backgroundColor: CREAM_CARD,
              borderColor: '#e8d7cc',
              borderRadius: 0,
              perUnitText: 'per pack',
              discountBadgeColor: CORAL,
              bottomText: '',
            },
          },
          {
            type: 'OrderSummaryCard',
            props: {
              id: 'order-summary-checkout-skincare-1',
              title: 'Your order',
              titleIcon: 'none',
              showCouponField: true,
              showTrustBadges: false,
              backgroundColor: '#ffffff',
              borderColor: '#e8d7cc',
              borderRadius: 0,
              padding: 24,
            },
          },
          {
            type: 'PaymentEntryForm',
            props: {
              id: 'payment-checkout-skincare-1',
              sectionTitle: { text: 'Payment', color: DARK_TEXT, fontSize: 16 },
              titleIcon: 'none',
              showPayPalOption: false,
              buttonText: 'PLACE ORDER $20.00',
              buttonColor: CORAL,
              showSecurityBadges: false,
              backgroundColor: CREAM,
              borderColor: '#e8d7cc',
              borderRadius: 0,
              padding: 24,
            },
          },
        ],
      },
    },
    {
      type: 'CallToActionBanner',
      props: {
        id: 'cta-checkout-skincare-footer',
        theme: 'plain',
        headline: { text: 'Skin Care Cream', color: '#ffffff', fontSize: 28, fontFamily: "'Playfair Display', serif" },
        subheadline: { text: '', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
        ctaText: { text: '', color: '#ffffff', fontSize: 14 },
        backgroundColor: CORAL_DARK,
        padding: 36,
        maxWidth: 1200,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
