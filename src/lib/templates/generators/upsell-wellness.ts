import type { Data } from '@puckeditor/core';
import { paymentLogoIcon } from './icons';

const MINT = '#e8f5e9';
const DARK_GREEN = '#0d3b2e';
const ORANGE = '#f97316';
const DARK_TEXT = '#1a2e1f';
const MUTED_TEXT = '#4a5d51';

export const upsellWellnessTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'StepProgress',
      props: {
        id: 'stepper-upsell-wellness-1',
        steps: [
          { label: 'Order Submitted' },
          { label: 'Special Offer' },
          { label: 'Order Receipt' },
        ],
        currentStep: 1,
        orientation: 'horizontal',
        stepStyle: 'numbered',
        connectorStyle: 'solid',
        accentColor: DARK_GREEN,
        inactiveColor: '#d1d5db',
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'hero-upsell-wellness-1',
        title: { text: 'Hey, Wait! Your Order Is Almost Complete...', color: DARK_TEXT, fontSize: 36, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        content: '<p>We have a special one time offer just for you.</p>',
        contentAlignment: 'center',
        contentFontSize: 16,
        maxWidth: '800px',
        backgroundColor: MINT,
        textColor: MUTED_TEXT,
        padding: '72px 24px 56px',
      },
    },
    {
      type: 'ColumnLayout',
      props: {
        id: 'cols-upsell-wellness-card',
        maxWidth: 900,
        gap: 32,
        backgroundColor: '#ffffff',
        distribution: '1fr 1fr',
        mobileBreakpoint: 768,
        verticalAlign: 'center',
        padding: 56,
        left: [
          {
            type: 'ImageBlock',
            props: {
              id: 'upsell-wellness-product-image',
              image: { url: 'https://placehold.co/500x500/f5f5f0/0d3b2e?text=Kare+Organic+Oil', prompt: '', mediaType: 'image' as const },
              maxWidth: '100%',
              alignment: 'center',
              borderRadius: 12,
              backgroundColor: '#f5f5f0',
              padding: 24,
            },
          },
        ],
        right: [
          {
            type: 'RichTextBlock',
            props: {
              id: 'upsell-wellness-product-info',
              title: { text: 'Kare Organic Oil - 1 Ltr', color: DARK_TEXT, fontSize: 26, fontFamily: "'Playfair Display', serif" },
              titleAlignment: 'left',
              content: '<p>Our premium organic oil — extracted naturally to nourish skin and promote relaxation. A wellness essential at an exclusive one-time price.</p>',
              contentAlignment: 'left',
              contentFontSize: 15,
              maxWidth: '100%',
              backgroundColor: 'transparent',
              textColor: MUTED_TEXT,
              padding: '0',
            },
          },
          {
            type: 'VariantSelector',
            props: {
              id: 'upsell-wellness-products-1',
              theme: 'card',
              sectionTitle: { text: 'Select Your Quantity', color: DARK_TEXT, fontSize: 16 },
              selectedItems: {
                items: [
                  {
                    id: 'upsell-wellness-oil-1',
                    productId: '39772',
                    productName: '1 Bottle',
                    price: 59.50,
                    comparePrice: 79.00,
                    thumbnail: 'https://placehold.co/80x80/f5f5f0/0d3b2e?text=Oil',
                    quantity: 1,
                    currency: 'USD',
                  },
                  {
                    id: 'upsell-wellness-oil-2',
                    productId: '39772',
                    productName: '2 Bottles',
                    price: 99.00,
                    comparePrice: 158.00,
                    thumbnail: 'https://placehold.co/80x80/f5f5f0/0d3b2e?text=Oil+x2',
                    quantity: 2,
                    badgeLabel: 'Most Popular',
                    badgeColor: ORANGE,
                    currency: 'USD',
                  },
                ],
                currency: 'USD',
              },
              accentColor: DARK_GREEN,
              backgroundColor: 'transparent',
              borderColor: '#cbe3d0',
              borderRadius: 12,
              perUnitText: 'per bottle',
              discountBadgeColor: ORANGE,
              bottomText: '',
            },
          },
          {
            type: 'UpsellAddButton',
            props: {
              id: 'upsell-wellness-cta-1',
              addButtonText: { text: 'YES, ADD TO MY ORDER', color: '#ffffff', fontSize: 16 },
              addButtonColor: ORANGE,
              declineButtonText: { text: 'NO THANKS', color: MUTED_TEXT, fontSize: 12 },
              showDeclineButton: true,
              declineUrl: { type: 'custom' as const, url: '' },
              buttonSize: 'large',
              buttonRadius: 32,
              fullWidth: true,
              showGuarantee: false,
              guaranteeText: { text: '', color: MUTED_TEXT, fontSize: 13 },
              processingText: 'Adding to order...',
            },
          },
        ],
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-upsell-wellness-payments',
        headerLabel: 'GUARANTEED SAFE CHECKOUT',
        features: [
          { icon: { url: paymentLogoIcon('VISA', '#1a1f71'), mediaType: 'image' as const, prompt: '' }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('MC', '#eb001b'), mediaType: 'image' as const, prompt: '' }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('AMEX', '#006fcf'), mediaType: 'image' as const, prompt: '' }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('Pay', '#000000'), mediaType: 'image' as const, prompt: '' }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('GPay', '#4285f4'), mediaType: 'image' as const, prompt: '' }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
        ],
        backgroundColor: MINT,
        borderTop: false,
        borderBottom: false,
        padding: 32,
        iconSize: 30,
        iconWidth: 45,
        iconLayout: 'icon-only',
      },
    },
  ],
  zones: {},
});
