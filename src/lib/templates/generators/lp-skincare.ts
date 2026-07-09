import type { Data } from '@puckeditor/core';
import { lineIcon, numberBadgeIcon } from './icons';

const CREAM = '#f8f1ea';
const CREAM_TILE = '#f1e2d8';
const CORAL = '#c46b54';
const CORAL_DARK = '#a8543e';
const DARK_TEXT = '#2b1d18';
const MUTED_TEXT = '#6b5b54';

const BEAUTY_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">`
  + `<circle cx="32" cy="32" r="20" fill="none" stroke="#c46b54" stroke-width="2"/>`
  + `<circle cx="32" cy="32" r="11" fill="#f1e2d8"/>`
  + `<rect x="22" y="42" width="20" height="4" rx="1" fill="#c46b54"/>`
  + `<text x="68" y="38" font-family="'Playfair Display', serif" font-style="italic" font-size="32" font-weight="500" fill="#c46b54">Beauty</text>`
  + `<text x="74" y="58" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" letter-spacing="3" fill="#c46b54">SKIN CARE CREAM</text>`
  + `</svg>`,
)}`;

const HERO_PRODUCT_IMAGE = 'https://placehold.co/900x900/eae0d5/a8543e?text=Lorem+%2F+B.S.C.+Cream';

const coralIcon = (glyph: Parameters<typeof lineIcon>[0]) =>
  lineIcon(glyph, { stroke: CORAL, background: CREAM_TILE });

const SALIENT_FEATURES = [
  { n: '01.', title: 'Smooth, Lightweight & Shining', text: 'Amet, semper pretium leo morbi congue nam sit sed odio tempus lobortis id donec commodo.' },
  { n: '02.', title: 'Reduces Puffiness', text: 'Consectetur eget risus dignissim in tellus a urna pulvinar consequat, consequat facilisi ultrices vitae orci arcu.' },
  { n: '03.', title: 'Compatible with All Skin Types', text: 'Vestibulum vel dignissim gravida pharetra ullamcorper arcu, at aliquam, donec ultrices vitae orci arcu varius et.' },
  { n: '04.', title: 'Zero Makeup Sense Needed', text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Massa tortor porttitor fermentum fames ultrices vitae.' },
  { n: '05.', title: 'Makes Skin Brighter & Radiant', text: 'Nulla adipiscing integer ipsum, cras viverra tincidunt. Faucibus commodo non, cursus pharetra ac ut quam et.' },
  { n: '06.', title: 'Gentle Moisturization', text: 'Egestas sit volutpat aliquet nunc nec volutpat hac. Eget tempor felis condimentum ornare in vitae orci.' },
];

export const lpSkincareTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'HeroPanel',
      props: {
        id: 'hero-skincare-1',
        logoImage: { url: BEAUTY_LOGO, prompt: '', mediaType: 'image' as const },
        logoHeight: 64,
        tagline: { text: '', color: CORAL, fontSize: 14 },
        headline: { text: 'Personalised skincare at its best.', color: DARK_TEXT, fontSize: 52, fontFamily: "'Playfair Display', serif" },
        subheadline: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed amet magna quis a sem dignissim semper libero, amet. Nibh proin placerat molestie vestibulum.',
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 13 },
        ctaLink: { type: 'custom' as const, url: '#shop' },
        ctaColor: CORAL,
        productImage: { url: HERO_PRODUCT_IMAGE, prompt: '', mediaType: 'image' as const },
        imagePosition: 'right',
        contentAlign: 'left',
        overlayColor: CREAM,
        padding: 64,
        maxWidth: 1200,
        fullWidth: true,
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-skincare-1',
        features: [
          { icon: { url: coralIcon('truck'), prompt: '', mediaType: 'image' as const }, title: { text: 'Free 2 Days Shipping', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: coralIcon('dollar'), prompt: '', mediaType: 'image' as const }, title: { text: 'Money Back Guarantee', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: coralIcon('returns'), prompt: '', mediaType: 'image' as const }, title: { text: 'Free Return Up to 30 Days', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: coralIcon('heart'), prompt: '', mediaType: 'image' as const }, title: { text: '100% User Satisfaction', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: coralIcon('headset'), prompt: '', mediaType: 'image' as const }, title: { text: '24/7 Customer Support', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
        ],
        backgroundColor: '#ffffff',
        borderTop: false,
        borderBottom: false,
        padding: 36,
        iconSize: 44,
        iconLayout: 'icon-title',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'its-skincare-intro',
        sectionTitle: { text: 'ABOUT B.S.C CREAM', color: CORAL, fontSize: 12 },
        headline: { text: 'Introducing: Beauty Skincare Cream - tailored to your needs.', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tortor urna sit mattis bibendum. In dapibus aenean ut amet mi, augue. Parturient lacus, porttitor quisque tristique. Id placerat, vivera velit faucibus penatibus gravida et, quam.',
        image: { url: 'https://placehold.co/600x700/eae0d5/a8543e?text=Lorem+B.S.C.+jar', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left',
        backgroundColor: '#ffffff',
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 13 },
        ctaColor: CORAL,
        ctaLink: { type: 'custom' as const, url: '#shop' },
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'salient-features-heading',
        title: { text: 'Think high always expect the best.', color: DARK_TEXT, fontSize: 36, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        content: '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tortor urna sit mattis bibendum. In dapibus aenean ut amet mi, augue. Parturient lacus, porttitor quisque tristique.</p>',
        contentAlignment: 'center',
        contentFontSize: 14,
        maxWidth: '620px',
        backgroundColor: CREAM,
        textColor: MUTED_TEXT,
        padding: '72px 24px 8px',
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'salient-features-grid',
        layout: 'card',
        columns: 3,
        features: SALIENT_FEATURES.map((f) => ({
          icon: { url: numberBadgeIcon(f.n, CORAL, CREAM_TILE), prompt: '', mediaType: 'image' as const },
          title: { text: f.title, color: DARK_TEXT, fontSize: 17 },
          subtitle: { text: f.text, color: MUTED_TEXT, fontSize: 13 },
        })),
        backgroundColor: CREAM,
        cardBackgroundColor: '#ffffff',
        borderTop: false,
        borderBottom: false,
        padding: 32,
        iconSize: 44,
        iconLayout: 'icon-title-subtitle',
      },
    },
    {
      type: 'CallToActionBanner',
      props: {
        id: 'salient-features-cta',
        theme: 'plain',
        headline: { text: '', color: DARK_TEXT, fontSize: 28 },
        subheadline: { text: '', color: MUTED_TEXT, fontSize: 14 },
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 12 },
        ctaLink: { type: 'custom' as const, url: '#shop' },
        ctaColor: CORAL,
        ctaRadius: 4,
        backgroundColor: CREAM,
        padding: 24,
        maxWidth: 1200,
        fullWidth: false,
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'its-skincare-story',
        sectionTitle: { text: 'SINCE 2018', color: CORAL, fontSize: 12 },
        headline: { text: 'Why I started this business?', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        description: '<p>Dolor malesuada vivamus massa nec. Nunc praesent nisi, faucibus vulputate elementum cursus. Facilisis tellus id tincidunt lacus faucibus erat lobortis. Vivamus venenatis lacinia pretium mauris. Volutpat nisi sit id et, vulputate tristique a vitae.</p><p>Pretium in enim tortor vehicula aenean. Gravida congue id quis interdum pretium egestas lectus. Convallis et ipsum pretium faucibus gravida lacinia.</p><p><strong>Julia Keys</strong><br/><em>Owner of Beauty Skincare Cream</em></p>',
        image: { url: 'https://placehold.co/600x700/eae0d5/a8543e?text=Founder', prompt: '', mediaType: 'image' as const },
        imagePosition: 'right',
        backgroundColor: '#ffffff',
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-skincare-2',
        headerLabel: 'We leave no room for doubt.',
        features: [
          { icon: { url: lineIcon('ban', { stroke: CORAL, background: '#ffffff', shape: 'circle' }), prompt: '', mediaType: 'image' as const }, title: { text: 'Cruelty Free', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: lineIcon('sparkles', { stroke: CORAL, background: '#ffffff', shape: 'circle' }), prompt: '', mediaType: 'image' as const }, title: { text: 'Visible Effects', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: lineIcon('flask', { stroke: CORAL, background: '#ffffff', shape: 'circle' }), prompt: '', mediaType: 'image' as const }, title: { text: 'Dermatologist Tested', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: lineIcon('leaf', { stroke: CORAL, background: '#ffffff', shape: 'circle' }), prompt: '', mediaType: 'image' as const }, title: { text: 'Paraben Free', color: DARK_TEXT, fontSize: 13 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
        ],
        backgroundColor: CREAM,
        borderTop: false,
        borderBottom: false,
        padding: 56,
        iconSize: 88,
        iconLayout: 'icon-title',
      },
    },
    {
      type: 'HowToSteps',
      props: {
        id: 'usage-skincare-1',
        sectionTitle: { text: 'How to apply?', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        subtitle: { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tortor urna sit mattis bibendum. In dapibus aenean ut amet mi, augue. Parturient lacus, porttitor quisque tristique.', color: MUTED_TEXT, fontSize: 14 },
        steps: [
          { title: 'Clean Your Face with Warm Water', description: '', image: { url: 'https://placehold.co/280x320/eae0d5/a8543e?text=Step+1', prompt: '', mediaType: 'image' as const } },
          { title: 'Apply the Cream on Your Face', description: '', image: { url: 'https://placehold.co/280x320/eae0d5/a8543e?text=Step+2', prompt: '', mediaType: 'image' as const } },
          { title: 'Massage in Circular Motion Until Absorbed', description: '', image: { url: 'https://placehold.co/280x320/eae0d5/a8543e?text=Step+3', prompt: '', mediaType: 'image' as const } },
        ],
        backgroundColor: '#ffffff',
        showStepNumbers: true,
        accentColor: CORAL,
      },
    },
    {
      type: 'FaqAccordion',
      props: {
        id: 'faq-skincare-1',
        title: { text: 'Frequently asked questions', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        faqs: [
          { question: { text: 'Q: Cras cursus tellus ac placerat suscipit?', color: DARK_TEXT, fontSize: 16 }, answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.' },
          { question: { text: 'Q: Sed blandit justo in sollicitudin molestie?', color: DARK_TEXT, fontSize: 16 }, answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.' },
          { question: { text: 'Q: Praesent interdum est et enim venenatis?', color: DARK_TEXT, fontSize: 16 }, answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.' },
          { question: { text: 'Q: Sed vehicula ipsum ac vestibulum aliquam?', color: DARK_TEXT, fontSize: 16 }, answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.' },
        ],
        backgroundColor: CREAM,
      },
    },
    {
      type: 'ReviewList',
      props: {
        id: 'reviews-skincare-1',
        theme: 'cards-grid',
        sectionTitle: { text: 'What our happy customers say', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        subtitle: { text: 'CUSTOMER REVIEWS', color: CORAL, fontSize: 12 },
        backgroundColor: '#ffffff',
        columns: 3,
        cardStyle: 'plain',
        showAvatar: true,
        showStars: true,
        showName: true,
        showRole: true,
        accentColor: CORAL,
        reviews: [
          { author: 'Julia Keys', country: 'New York City', rating: 5, content: 'Felis semper duis massa scelerisque ac amet porttitor ac tellus venenatis aliquam varius mauris integer turpis scelerisque molestie.', avatarImage: { url: 'https://placehold.co/96x96/eae0d5/a8543e?text=JK', prompt: '', mediaType: 'image' as const } },
          { author: 'David Hurry', country: 'New York City', rating: 5, content: 'Non malesuada fringilla non varius odio in id pellentesque aliquam volutpat sapien faucibus mauris iaculis elementum.', avatarImage: { url: 'https://placehold.co/96x96/eae0d5/a8543e?text=DH', prompt: '', mediaType: 'image' as const } },
          { author: 'Maria Anna', country: 'New York City', rating: 5, content: 'Malesuada odio ut et sodales pretium in maecenas rhoncus. Quis suspendisse auctor egestas lacus erat rhoncus, at luctus massa.', avatarImage: { url: 'https://placehold.co/96x96/eae0d5/a8543e?text=MA', prompt: '', mediaType: 'image' as const } },
        ],
      },
    },
    {
      type: 'CallToActionBanner',
      props: {
        id: 'cta-skincare-final',
        theme: 'plain',
        headline: { text: 'Fall in love with your skin again with Beauty Skincare Cream.', color: DARK_TEXT, fontSize: 28, fontFamily: "'Playfair Display', serif" },
        subheadline: { text: 'Fringilla neque convallis in ultrices libero interdum sed ultrices euismod. Eu morbi magna et, fames. Erat faucibus odio at sed eu ultrices phasellus.', color: MUTED_TEXT, fontSize: 14 },
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 12 },
        ctaLink: { type: 'custom' as const, url: '#shop' },
        ctaColor: CORAL,
        backgroundColor: CREAM,
        badgePosition: 'none',
        padding: 56,
        maxWidth: 860,
        fullWidth: true,
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'footer-skincare-1',
        theme: 'compact',
        brandName: { text: 'Beauty Skincare', color: '#ffffff', fontSize: 18 },
        backgroundColor: CORAL_DARK,
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
        copyright: { text: '© 2026 Beauty Skincare. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
        padding: 32,
        fullWidth: true,
      },
    },
  ],
  zones: {},
});
