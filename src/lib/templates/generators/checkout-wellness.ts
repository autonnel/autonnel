import type { Data } from '@puckeditor/core';
import { sealIcon } from './icons';

const MINT = '#edf7ed';
const MINT_CARD = '#dcefe0';
const DARK_GREEN = '#0d3b2e';
const ORANGE = '#f97316';
const DARK_TEXT = '#1a2e1f';

const KARE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" viewBox="0 0 180 48">`
  + `<path d="M22 6 C30 18 36 28 22 42 C8 28 14 18 22 6 Z" fill="#f97316"/>`
  + `<text x="50" y="33" font-family="'Plus Jakarta Sans',-apple-system,Segoe UI,sans-serif" font-size="26" font-weight="700" letter-spacing="2" fill="#f97316">KARE</text>`
  + `</svg>`,
)}`;

export const checkoutWellnessTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'HeroPanel',
      props: {
        id: 'hero-checkout-wellness-1',
        logoImage: { url: KARE_LOGO, prompt: '', mediaType: 'image' as const },
        logoHeight: 36,
        tagline: { text: '', color: ORANGE, fontSize: 14 },
        headline: { text: 'Discover Your Softest Skin Yet.', color: DARK_TEXT, fontSize: 44, fontFamily: "'Playfair Display', serif" },
        subheadline: 'Relax and unwind with our organic lavender essential oil. Ideal for aromatherapy, it promotes tranquility and reduces stress, making it a must-have for your wellness routine.',
        benefits: [
          { value: { text: 'Your information is secure', color: DARK_TEXT, fontSize: 15 }, icon: '✓' },
          { value: { text: '100% Satisfaction Guarantee', color: DARK_TEXT, fontSize: 15 }, icon: '👍' },
          { value: { text: 'We Protect your Privacy', color: DARK_TEXT, fontSize: 15 }, icon: '🔒' },
        ],
        benefitIconColor: ORANGE,
        productImage: { url: 'https://placehold.co/700x520/c87a5c/ffffff?text=Lifestyle+Image', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left',
        contentAlign: 'left',
        overlayColor: MINT,
        ctaText: { text: '', color: '#ffffff', fontSize: 18 },
        ctaLink: { type: 'custom' as const, url: '' },
        padding: 56,
        maxWidth: 1100,
        fullWidth: false,
      },
    },
    {
      type: 'ColumnLayout',
      props: {
        id: 'cols-checkout-wellness-1',
        maxWidth: 1100,
        gap: 40,
        backgroundColor: '#ffffff',
        distribution: '60fr 40fr',
        mobileBreakpoint: 768,
        verticalAlign: 'start',
        padding: 40,
        left: [
          {
            type: 'ShippingAddressForm',
            props: {
              id: 'address-checkout-wellness-1',
              sectionTitle: { text: 'Customer information', color: DARK_TEXT, fontSize: 18 },
              titleIcon: 'none',
              type: 'both',
              showPhone: true,
              showEmail: true,
              useGoogleAutocomplete: false,
              addressPlaceholder: 'House number and street name',
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 0,
              padding: 0,
            },
          },
          {
            type: 'PaymentEntryForm',
            props: {
              id: 'payment-checkout-wellness-1',
              sectionTitle: { text: 'Payment', color: DARK_TEXT, fontSize: 18 },
              titleIcon: 'none',
              showPayPalOption: false,
              buttonText: 'PLACE ORDER $20.00',
              buttonColor: ORANGE,
              showSecurityBadges: false,
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 0,
              padding: 0,
            },
          },
        ],
        right: [
          {
            type: 'VariantSelector',
            props: {
              id: 'products-checkout-wellness-1',
              theme: 'card',
              sectionTitle: { text: 'Your Products', color: DARK_TEXT, fontSize: 18 },
              selectedItems: {
                items: [
                  {
                    id: 'kare-organic-oil-39772',
                    productId: '39772',
                    productName: 'Kare Organic Oil (#39772)',
                    price: 20.00,
                    thumbnail: 'https://placehold.co/64x64/f5f5f0/0d3b2e?text=Oil',
                    quantity: 1,
                    currency: 'USD',
                  },
                ],
                currency: 'USD',
              },
              accentColor: DARK_GREEN,
              backgroundColor: MINT_CARD,
              borderColor: '#c7e0cd',
              borderRadius: 8,
              perUnitText: 'per pack',
              discountBadgeColor: ORANGE,
              bottomText: '',
            },
          },
          {
            type: 'OrderSummaryCard',
            props: {
              id: 'order-summary-checkout-wellness-1',
              title: 'Your order',
              titleIcon: 'none',
              showCouponField: true,
              showTrustBadges: false,
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 8,
              padding: 24,
            },
          },
        ],
      },
    },
    {
      type: 'CallToActionBanner',
      props: {
        id: 'cta-checkout-wellness-guarantee',
        theme: 'plain',
        headline: { text: '100% No-Risk Money Back Guarantee!', color: '#ffffff', fontSize: 28, fontFamily: "'Playfair Display', serif" },
        subheadline: { text: 'We stand behind our products with a 100% no-risk money-back guarantee. If you are not completely satisfied, simply return it for a full refund — your happiness is our top priority!', color: 'rgba(255,255,255,0.85)', fontSize: 15 },
        ctaText: { text: '', color: '#ffffff', fontSize: 16 },
        backgroundColor: DARK_GREEN,
        badgeImage: { url: sealIcon(['30', 'DAY', 'GUARANTEE'], { background: ORANGE, color: '#ffffff' }), prompt: '', mediaType: 'image' as const },
        badgePosition: 'left',
        badgeSize: 130,
        padding: 56,
        maxWidth: 1200,
        fullWidth: true,
      },
    },
    {
      type: 'ReviewList',
      props: {
        id: 'reviews-checkout-wellness-1',
        theme: 'cards-grid',
        sectionTitle: { text: 'Customers Love KARE', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        subtitle: { text: 'TESTIMONIALS', color: ORANGE, fontSize: 13 },
        backgroundColor: '#ffffff',
        columns: 3,
        cardStyle: 'shadow',
        showAvatar: true,
        showStars: true,
        showName: true,
        showRole: false,
        accentColor: ORANGE,
        reviews: [
          { author: 'John Doe', rating: 5, content: "My skin has never felt better. It's so nourishing and absorbs beautifully — thank you for such a wonderful product!", avatarImage: { url: 'https://placehold.co/96x96/0d3b2e/ffffff?text=JD', prompt: '', mediaType: 'image' as const } },
          { author: 'Mary Paul', rating: 5, content: 'The lavender essential oil is my go-to for relaxation. Just a few drops in my diffuser, and my stress melts away.', avatarImage: { url: 'https://placehold.co/96x96/0d3b2e/ffffff?text=MP', prompt: '', mediaType: 'image' as const } },
          { author: 'Saint Rish', rating: 5, content: 'Top-notch quality, unmatched freshness — and I love their commitment to organic sourcing.', avatarImage: { url: 'https://placehold.co/96x96/0d3b2e/ffffff?text=SR', prompt: '', mediaType: 'image' as const } },
        ],
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'footer-checkout-wellness-1',
        theme: 'compact',
        brandName: { text: 'KARE', color: '#ffffff', fontSize: 18 },
        backgroundColor: DARK_GREEN,
        showNav: true,
        showAbout: false,
        showLogo: false,
        showCopyright: true,
        showSocial: false,
        links: [
          { label: { text: 'About', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/about' } },
          { label: { text: 'Contact', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/contact' } },
          { label: { text: 'Privacy', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/privacy' } },
          { label: { text: 'Terms', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/terms' } },
        ],
        copyright: { text: '© 2026 KARE. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        padding: 32,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
