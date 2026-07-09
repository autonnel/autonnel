import type { Data } from '@puckeditor/core';
import { lineIcon } from './icons';

const CREAM = '#f8f1ea';
const CORAL = '#c46b54';
const CORAL_DARK = '#a8543e';
const DARK_TEXT = '#2b1d18';
const MUTED_TEXT = '#6b5b54';

export const thankyouSkincareTemplate = (): Data => ({
  root: { props: { maxWidth: '1080' }  as any },
  content: [
    {
      type: 'HeroPanel',
      props: {
        id: 'hero-thankyou-skincare-1',
        tagline: { text: 'ORDER CONFIRMED', color: CORAL, fontSize: 13 },
        headline: { text: 'Yay! Beauty Skincare Cream is on its way.', color: DARK_TEXT, fontSize: 42, fontFamily: "'Playfair Display', serif" },
        subheadline: "Thank you for your purchase. We have sent a confirmation email with your order details and tracking info.",
        productImage: { url: 'https://placehold.co/600x400/eae0d5/a8543e?text=Happy+Customer', prompt: '', mediaType: 'image' as const },
        imagePosition: 'right',
        contentAlign: 'left',
        overlayColor: CREAM,
        ctaText: { text: 'Shop Now', color: '#ffffff', fontSize: 16 },
        ctaLink: { type: 'custom' as const, url: '#shop' },
        ctaColor: CORAL,
        padding: 56,
        maxWidth: 1200,
        fullWidth: true,
      },
    },
    {
      type: 'OrderDetailPanel',
      props: {
        id: 'order-details-thankyou-skincare-1',
        emptyStateStyle: 'card',
        emptyStateMessage: 'Order not found. You cannot access this page directly.',
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'richtext-thankyou-skincare-follow',
        title: { text: 'Follow us @beauty_skincare', color: DARK_TEXT, fontSize: 28, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        lastUpdated: { text: '', color: CORAL, fontSize: 12 },
        content: '',
        maxWidth: '700px',
        backgroundColor: '#ffffff',
        textColor: MUTED_TEXT,
        padding: '40px 24px 16px',
      },
    },
    {
      type: 'MediaGrid',
      props: {
        id: 'media-grid-thankyou-skincare-1',
        columns: 4,
        aspectRatio: '1:1',
        gap: 12,
        tileBorderRadius: 8,
        backgroundColor: '#ffffff',
        tiles: [
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/f1e2d8/c46b54?text=Insta+1', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/beauty_skincare' },
          },
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/eae0d5/a8543e?text=Insta+2', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/beauty_skincare' },
          },
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/f1e2d8/c46b54?text=Insta+3', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/beauty_skincare' },
          },
          {
            tileType: 'cta' as const,
            title: { text: 'Join our Instagram community', color: '#ffffff', fontSize: 16 },
            icon: { url: lineIcon('instagram', { stroke: '#ffffff', shape: 'none' }), prompt: '', mediaType: 'image' as const },
            url: { type: 'custom' as const, url: 'https://instagram.com/beauty_skincare' },
            backgroundColor: CORAL,
          },
        ],
      },
    },
    {
      type: 'SocialShareRow',
      props: {
        id: 'social-thankyou-skincare-1',
        title: { text: 'Share it with your friends', color: DARK_TEXT, fontSize: 22 },
        subtitle: { text: 'Spread the love', color: MUTED_TEXT, fontSize: 14 },
        platforms: [
          { platform: 'facebook' as const },
          { platform: 'twitter' as const },
          { platform: 'instagram' as const },
          { platform: 'pinterest' as const },
        ],
        iconStyle: 'filled' as const,
        iconColor: CORAL,
        iconSize: 36,
        align: 'center' as const,
        backgroundColor: '#ffffff',
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'footer-thankyou-skincare-1',
        theme: 'compact',
        brandName: { text: 'Beauty Skincare', color: '#ffffff', fontSize: 18 },
        backgroundColor: CORAL_DARK,
        showNav: false,
        showAbout: false,
        showLogo: true,
        showCopyright: true,
        showSocial: false,
        copyright: { text: '© 2026 Beauty Skincare. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        padding: 28,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
