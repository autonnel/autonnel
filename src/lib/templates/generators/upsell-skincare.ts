import type { Data } from '@puckeditor/core';
import { lineIcon } from './icons';

const CREAM = '#f8f1ea';
const CORAL = '#c46b54';
const DARK_TEXT = '#2b1d18';
const MUTED_TEXT = '#6b5b54';

export const upsellSkincareTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'UpsellHeader',
      props: {
        id: 'upsell-hero-skincare-1',
        backgroundImage: { url: 'https://placehold.co/1400x700/f8f1ea/eaddd2?text=Skincare+Bottles', prompt: '', mediaType: 'image' as const },
        backgroundColor: CREAM,
        contentAlign: 'left',
        contentMaxWidth: 560,
        padding: 56,
        minHeight: 0,
        fullWidth: true,
        content: [
          {
            type: 'StepProgress',
            props: {
              id: 'upsell-skincare-progress',
              steps: [
                { label: 'Order Submitted' },
                { label: 'Special Offer' },
                { label: 'Order Receipt' },
              ],
              currentStep: 1,
              orientation: 'horizontal',
              stepStyle: 'numbered',
              connectorStyle: 'solid',
              accentColor: CORAL,
              inactiveColor: '#c9b3a7',
            },
          },
          {
            type: 'SavingsBadge',
            props: {
              id: 'upsell-skincare-badge-1',
              badgeImage: { url: lineIcon('percent', { stroke: '#ffffff', background: CORAL, shape: 'circle' }), prompt: '', mediaType: 'image' as const },
              title: { text: "Wait! Your order is not complete!", color: DARK_TEXT, fontSize: 28 },
              backgroundColor: '',
              padding: 16,
              badgeSize: 80,
            },
          },
          {
            type: 'RichTextBlock',
            props: {
              id: 'upsell-skincare-prices-1',
              content: '<p><strong>This is a one time special combo offer! You will never see this again.</strong></p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tortor urna sit mattis bibendum. In dapibus aenean ut amet mi, augue. Parturient lacus, porttitor quisque tristique.</p>',
              contentAlignment: 'left',
              contentFontSize: 14,
              maxWidth: '480px',
              backgroundColor: 'transparent',
              textColor: MUTED_TEXT,
              padding: '0',
            },
          },
          {
            type: 'VariantSelector',
            props: {
              id: 'upsell-skincare-products-1',
              theme: 'card',
              sectionTitle: { text: 'Choose Your Combo', color: DARK_TEXT, fontSize: 16 },
              selectedItems: {
                items: [
                  {
                    id: 'upsell-skincare-combo-1',
                    productId: '90011',
                    productName: '1 Combo Pack',
                    price: 140.00,
                    comparePrice: 200.00,
                    thumbnail: 'https://placehold.co/80x80/f8f1ea/c46b54?text=Combo',
                    quantity: 1,
                    currency: 'USD',
                  },
                  {
                    id: 'upsell-skincare-combo-2',
                    productId: '90011',
                    productName: '2 Combo Packs',
                    price: 240.00,
                    comparePrice: 400.00,
                    thumbnail: 'https://placehold.co/80x80/f8f1ea/c46b54?text=Combo+x2',
                    quantity: 2,
                    badgeLabel: 'Best Value',
                    badgeColor: CORAL,
                    currency: 'USD',
                  },
                ],
                currency: 'USD',
              },
              accentColor: CORAL,
              backgroundColor: 'transparent',
              borderColor: '#e8d7cc',
              borderRadius: 8,
              perUnitText: 'per pack',
              discountBadgeColor: CORAL,
              bottomText: '',
            },
          },
          {
            type: 'UpsellAddButton',
            props: {
              id: 'upsell-skincare-cta-1',
              addButtonText: { text: 'ADD COMBO TO MY ORDER →', color: '#ffffff', fontSize: 13 },
              addButtonColor: CORAL,
              declineButtonText: { text: 'SKIP OFFER', color: MUTED_TEXT, fontSize: 11 },
              showDeclineButton: true,
              declineUrl: { type: 'custom' as const, url: '' },
              buttonSize: 'large',
              buttonRadius: 4,
              fullWidth: false,
              showGuarantee: false,
              guaranteeText: { text: '', color: MUTED_TEXT, fontSize: 13 },
              processingText: 'Adding combo...',
            },
          },
          {
            type: 'BenefitList',
            props: {
              id: 'upsell-skincare-combo-items',
              benefits: [
                { text: 'Daily Hydrating Lotion', isHighlighted: false },
                { text: 'Moisturizing Facial Wash', isHighlighted: false },
                { text: 'Daily Moisturizing Lotion', isHighlighted: false },
                { text: 'Facial Treatment Essence', isHighlighted: false },
              ],
              checkColor: CORAL,
              textColor: DARK_TEXT,
              highlightColor: CORAL,
              backgroundColor: 'transparent',
              padding: 0,
            },
          },
        ],
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'upsell-skincare-section-header-1',
        title: { text: 'Get all in one with special discount offer', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        content: '',
        maxWidth: '800px',
        backgroundColor: '#ffffff',
        textColor: DARK_TEXT,
        padding: '48px 24px 16px',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'upsell-skincare-product-1',
        sectionTitle: { text: 'INCLUDED IN COMBO', color: CORAL, fontSize: 13 },
        headline: { text: 'Daily Hydrating Lotion', color: DARK_TEXT, fontSize: 28 },
        description: 'A lightweight, fast-absorbing lotion that keeps skin soft, supple, and hydrated all day long.',
        bulletPoints: [
          { title: 'Lightweight Formula', description: 'Non-greasy, fast absorbing.' },
          { title: 'All Skin Types', description: 'Gentle enough for daily use.' },
          { title: 'Hydrates 24 Hours', description: 'Long-lasting moisture.' },
        ],
        image: { url: 'https://placehold.co/600x500/f8f1ea/a8543e?text=Hydrating+Lotion', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left' as const,
        backgroundColor: '#ffffff',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'upsell-skincare-product-2',
        sectionTitle: { text: 'INCLUDED IN COMBO', color: CORAL, fontSize: 13 },
        headline: { text: 'Moisturizing Facial Wash', color: DARK_TEXT, fontSize: 28 },
        description: 'A creamy facial wash that gently cleanses without stripping skin of its natural moisture.',
        bulletPoints: [
          { title: 'Gentle Cleanse', description: 'Removes impurities without dryness.' },
          { title: 'Hydrating Cream Base', description: 'Leaves skin soft after every wash.' },
          { title: 'Suitable for Sensitive Skin', description: 'Fragrance-free, pH balanced.' },
        ],
        image: { url: 'https://placehold.co/600x500/ffffff/a8543e?text=Facial+Wash', prompt: '', mediaType: 'image' as const },
        imagePosition: 'right' as const,
        backgroundColor: CREAM,
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'upsell-skincare-product-3',
        sectionTitle: { text: 'INCLUDED IN COMBO', color: CORAL, fontSize: 13 },
        headline: { text: 'Daily Moisturizing Lotion', color: DARK_TEXT, fontSize: 28 },
        description: 'Deep moisture for daily use that locks in hydration and smooths skin texture.',
        bulletPoints: [
          { title: 'Locks in Moisture', description: 'Forms a protective hydration barrier.' },
          { title: 'Smooths Texture', description: 'Visibly softer skin with daily use.' },
          { title: 'Vitamin Enriched', description: 'Vitamins A, C and E for healthy skin.' },
        ],
        image: { url: 'https://placehold.co/600x500/f8f1ea/a8543e?text=Daily+Lotion', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left' as const,
        backgroundColor: '#ffffff',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'upsell-skincare-product-4',
        sectionTitle: { text: 'INCLUDED IN COMBO', color: CORAL, fontSize: 13 },
        headline: { text: 'Facial Treatment Essence', color: DARK_TEXT, fontSize: 28 },
        description: 'A potent treatment essence that revitalizes skin tone and texture for a radiant glow.',
        bulletPoints: [
          { title: 'Brightens Tone', description: 'Visibly evens skin tone.' },
          { title: 'Refines Texture', description: 'Softer, smoother feel.' },
          { title: 'Clinically Tested', description: 'Proven results in 4 weeks.' },
        ],
        image: { url: 'https://placehold.co/600x500/ffffff/a8543e?text=Treatment+Essence', prompt: '', mediaType: 'image' as const },
        imagePosition: 'right' as const,
        backgroundColor: CREAM,
      },
    },
    {
      type: 'UpsellAddButton',
      props: {
        id: 'upsell-skincare-cta-final',
        addButtonText: { text: 'ADD COMBO TO MY ORDER', color: '#ffffff', fontSize: 13 },
        addButtonColor: CORAL,
        declineButtonText: { text: "No thanks, I don't want this offer.", color: MUTED_TEXT, fontSize: 11 },
        showDeclineButton: true,
        declineUrl: { type: 'custom' as const, url: '' },
        buttonSize: 'large',
        buttonRadius: 4,
        fullWidth: false,
        showGuarantee: true,
        guaranteeText: { text: '30-day money back guarantee', color: MUTED_TEXT, fontSize: 11 },
        processingText: 'Adding combo...',
      },
    },
  ],
  zones: {},
});
