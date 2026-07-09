import type { Data } from '@puckeditor/core';
import { lineIcon } from './icons';

const KARE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48">`
  + `<path d="M22 8 C30 20 36 30 22 44 C8 30 14 20 22 8 Z" fill="#f97316"/>`
  + `<text x="46" y="35" font-family="'Plus Jakarta Sans', sans-serif" font-size="26" font-weight="800" letter-spacing="1" fill="#f97316">KARE</text>`
  + `</svg>`,
)}`;

const DARK_GREEN = '#0d3b2e';
const ORANGE = '#f97316';
const LIGHT_TEXT = '#ffffff';
const MUTED_LIGHT = 'rgba(255,255,255,0.75)';

export const thankyouWellnessTemplate = (): Data => ({
  root: { props: { maxWidth: '1080' }  as any },
  content: [
    {
      type: 'CallToActionBanner',
      props: {
        id: 'hero-thankyou-wellness-1',
        theme: 'plain',
        headline: { text: 'Thank You! Your Order Will Be Delivered Soon.', color: LIGHT_TEXT, fontSize: 44, fontFamily: "'Playfair Display', serif" },
        subheadline: { text: 'We appreciate your purchase! Your order is being processed and will be delivered shortly. Thank you for choosing us!', color: MUTED_LIGHT, fontSize: 15 },
        ctaText: { text: '', color: '#ffffff', fontSize: 16 },
        backgroundColor: DARK_GREEN,
        badgeImage: { url: KARE_LOGO, prompt: '', mediaType: 'image' as const },
        badgePosition: 'top',
        badgeSize: 140,
        padding: 72,
        maxWidth: 900,
        fullWidth: true,
      },
    },
    {
      type: 'OrderDetailPanel',
      props: {
        id: 'order-details-thankyou-wellness-1',
        emptyStateStyle: 'inline',
        emptyStateMessage: 'Order not found. You cannot access this page directly.',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'its-thankyou-wellness-earth',
        sectionTitle: { text: 'JOIN THE MOVEMENT', color: ORANGE, fontSize: 13 },
        headline: { text: 'Take Few Steps With Us To Save Our Mother Earth', color: LIGHT_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        description: 'Get 25% off your next purchase when you share your Kare Organic Oil moment with our community.',
        bulletPoints: [
          { title: 'Step 1', description: 'Capture a photo with Kare Organic Oil' },
          { title: 'Step 2', description: 'Upload the photo on your Instagram' },
          { title: 'Step 3', description: 'Tag @kare_organic_oil' },
          { title: 'Step 4', description: 'Get flat 25% OFF on your next purchase' },
        ],
        image: { url: 'https://placehold.co/600x500/164a3a/f97316?text=Earth+Eco', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left' as const,
        backgroundColor: DARK_GREEN,
        ctaText: { text: '', color: '#ffffff', fontSize: 14 },
      },
    },
    {
      type: 'CodeSnippet',
      props: {
        id: 'code-thankyou-wellness-1',
        label: 'Use Code:',
        code: 'KARE25',
        description: '',
        terms: 'Terms & Conditions Applied',
        borderStyle: 'dashed' as const,
        accentColor: ORANGE,
        backgroundColor: DARK_GREEN,
        showCopyButton: true,
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'richtext-thankyou-wellness-1',
        title: { text: 'Follow Us @kare_organic_oil', color: LIGHT_TEXT, fontSize: 28, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        lastUpdated: { text: '', color: ORANGE, fontSize: 12 },
        content: 'We are on a mission to make wellness accessible while protecting our planet. Join our community and follow our journey toward a more sustainable future.',
        maxWidth: '700px',
        backgroundColor: DARK_GREEN,
        textColor: MUTED_LIGHT,
        padding: '40px 24px 16px',
      },
    },
    {
      type: 'SocialShareRow',
      props: {
        id: 'social-thankyou-wellness-1',
        title: { text: '', color: LIGHT_TEXT, fontSize: 22 },
        subtitle: { text: '', color: MUTED_LIGHT, fontSize: 14 },
        platforms: [
          { platform: 'facebook' as const },
          { platform: 'twitter' as const },
          { platform: 'instagram' as const },
          { platform: 'pinterest' as const },
        ],
        iconStyle: 'filled' as const,
        iconColor: ORANGE,
        iconSize: 36,
        align: 'center' as const,
        backgroundColor: DARK_GREEN,
      },
    },
    {
      type: 'MediaGrid',
      props: {
        id: 'media-grid-thankyou-wellness-1',
        columns: 4,
        aspectRatio: '1:1',
        gap: 12,
        tileBorderRadius: 8,
        backgroundColor: DARK_GREEN,
        tiles: [
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/dcefe0/0d3b2e?text=Insta+1', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/kare_organic_oil' },
          },
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/edf7ed/0d3b2e?text=Insta+2', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/kare_organic_oil' },
          },
          {
            tileType: 'image' as const,
            image: { url: 'https://placehold.co/400x400/dcefe0/0d3b2e?text=Insta+3', prompt: '', mediaType: 'image' as const },
            link: { type: 'custom' as const, url: 'https://instagram.com/kare_organic_oil' },
          },
          {
            tileType: 'cta' as const,
            title: { text: 'Join Our Instagram Community', color: '#ffffff', fontSize: 16 },
            icon: { url: lineIcon('instagram', { stroke: '#ffffff', shape: 'none' }), prompt: '', mediaType: 'image' as const },
            url: { type: 'custom' as const, url: 'https://instagram.com/kare_organic_oil' },
            backgroundColor: ORANGE,
          },
        ],
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'footer-thankyou-wellness-1',
        theme: 'compact',
        brandName: { text: 'KARE', color: '#ffffff', fontSize: 18 },
        backgroundColor: DARK_GREEN,
        showNav: false,
        showAbout: false,
        showLogo: true,
        showCopyright: true,
        showSocial: false,
        copyright: { text: '© 2026 KARE. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        padding: 28,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
