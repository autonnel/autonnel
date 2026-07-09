import type { Data } from '@puckeditor/core';
import { lineIcon, paymentLogoIcon, wordmarkIcon } from './icons';

const MINT = '#edf7ed';
const DARK_GREEN = '#0d3b2e';
const DARK_GREEN_LIGHT = '#164a3a';
const ORANGE = '#f97316';
const DARK_TEXT = '#1a2e1f';
const MUTED_TEXT = '#5f6c63';
const LIGHT_MUTED = 'rgba(255,255,255,0.78)';

const KARE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48">`
  + `<path d="M22 8 C30 20 36 30 22 44 C8 30 14 20 22 8 Z" fill="#f97316"/>`
  + `<text x="46" y="35" font-family="'Plus Jakarta Sans', sans-serif" font-size="26" font-weight="800" letter-spacing="1" fill="#f97316">KARE</text>`
  + `</svg>`,
)}`;

const orangeTileIcon = (glyph: Parameters<typeof lineIcon>[0]) =>
  lineIcon(glyph, { stroke: '#ffffff', background: ORANGE });

const darkCardIcon = (glyph: Parameters<typeof lineIcon>[0]) =>
  lineIcon(glyph, { stroke: ORANGE, background: 'rgba(255,255,255,0.09)', shape: 'circle' });

export const lpWellnessTemplate = (): Data => ({
  root: { props: { maxWidth: 'none' }  as any },
  content: [
    {
      type: 'StoreHeader',
      props: {
        id: 'nav-wellness-1',
        logo: { url: KARE_LOGO, prompt: '', mediaType: 'image' as const },
        brandName: { text: '', color: ORANGE, fontSize: 22 },
        links: [
          { label: { text: 'SKIN CARE', color: DARK_TEXT, fontSize: 13 }, url: { type: 'custom' as const, url: '#skin-care' } },
          { label: { text: 'ABOUT', color: DARK_TEXT, fontSize: 13 }, url: { type: 'custom' as const, url: '#about' } },
          { label: { text: 'REVIEWS', color: DARK_TEXT, fontSize: 13 }, url: { type: 'custom' as const, url: '#reviews' } },
          { label: { text: 'SEND GIFT', color: DARK_TEXT, fontSize: 13 }, url: { type: 'custom' as const, url: '#gift' } },
        ],
        backgroundColor: '#ffffff',
        textColor: DARK_TEXT,
        rightIcons: [],
      },
    },
    {
      type: 'HeroPanel',
      props: {
        id: 'hero-wellness-1',
        tagline: { text: '', color: ORANGE, fontSize: 14 },
        headline: { text: "Everyday Luxuries That Don't Cost The Earth.", color: DARK_TEXT, fontSize: 44, fontFamily: "'Playfair Display', serif" },
        subheadline: 'Discover the essence of nature with our premium selection of organic oils. Sourced from the finest ingredients, our oils are crafted to elevate your health and enhance your lifestyle.',
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 13 },
        ctaLink: { type: 'custom' as const, url: '#order' },
        ctaColor: ORANGE,
        productImage: { url: 'https://placehold.co/700x520/edf7ed/0d3b2e?text=Oil+%2B+Flowers', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left',
        contentAlign: 'left',
        overlayColor: MINT,
        padding: 64,
        maxWidth: 1200,
        fullWidth: true,
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'its-wellness-intro-oil',
        sectionTitle: { text: 'INTRODUCING THE ORGANIC BEAUTY OIL', color: ORANGE, fontSize: 12 },
        headline: { text: 'Kare Beauty Oil', color: DARK_TEXT, fontSize: 30, fontFamily: "'Playfair Display', serif" },
        description: '<p><strong>$20.00</strong></p><p>Discover the transformative power of our blend of essential oils designed to nourish and renew your skin and senses.</p>',
        image: { url: 'https://placehold.co/600x700/dcefe0/0d3b2e?text=Beauty+Oil', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left',
        backgroundColor: '#ffffff',
        ctaText: { text: 'ADD TO CART', color: '#ffffff', fontSize: 13 },
        ctaColor: ORANGE,
        ctaLink: { type: 'custom' as const, url: '#shop' },
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-wellness-payments',
        headerLabel: 'Guaranteed Safe Checkout',
        features: [
          { icon: { url: paymentLogoIcon('VISA', '#1a1f71'), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('MC', '#eb001b'), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('AMEX', '#006fcf'), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('Pay', '#000000'), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
          { icon: { url: paymentLogoIcon('GPay', '#4285f4'), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 12 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 11 } },
        ],
        backgroundColor: '#ffffff',
        borderTop: false,
        borderBottom: false,
        padding: 20,
        iconSize: 30,
        iconWidth: 45,
        iconLayout: 'icon-only',
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-wellness-1',
        features: [
          { icon: { url: orangeTileIcon('truck'), prompt: '', mediaType: 'image' as const }, title: { text: 'Worldwide Free Shipping', color: '#ffffff', fontSize: 13 }, subtitle: { text: 'Free shipping available on all orders, no matter where!', color: LIGHT_MUTED, fontSize: 11 } },
          { icon: { url: orangeTileIcon('thumbsUp'), prompt: '', mediaType: 'image' as const }, title: { text: '100% Satisfaction Guarantee', color: '#ffffff', fontSize: 13 }, subtitle: { text: 'Your happiness is our priority—love it or your money back!', color: LIGHT_MUTED, fontSize: 11 } },
          { icon: { url: orangeTileIcon('returns'), prompt: '', mediaType: 'image' as const }, title: { text: 'Easy Returns', color: '#ffffff', fontSize: 13 }, subtitle: { text: 'Hassle-free returns make your shopping experience worry-free!', color: LIGHT_MUTED, fontSize: 11 } },
          { icon: { url: orangeTileIcon('lock'), prompt: '', mediaType: 'image' as const }, title: { text: 'We Protect Your Privacy', color: '#ffffff', fontSize: 13 }, subtitle: { text: 'Your privacy is our priority and confidential shopping experience.', color: LIGHT_MUTED, fontSize: 11 } },
        ],
        backgroundColor: DARK_GREEN,
        borderTop: false,
        borderBottom: false,
        padding: 48,
        iconSize: 56,
        iconLayout: 'icon-title-subtitle',
      },
    },
    {
      type: 'ImageTextSplit',
      props: {
        id: 'its-wellness-skin',
        sectionTitle: { text: 'ABOUT US', color: ORANGE, fontSize: 12 },
        headline: { text: 'Exactly What Your Skin Needs To Stay Healthy', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        description: 'Our mission is to provide high-quality, organic oils that support a healthy lifestyle and promote sustainability. We partner with farmers who share our commitment to organic practices, ensuring that every drop of oil is pure, potent, and beneficial.',
        image: { url: 'https://placehold.co/600x500/c87a5c/ffffff?text=Model+%2B+Bottles', prompt: '', mediaType: 'image' as const },
        imagePosition: 'right',
        backgroundColor: MINT,
        ctaText: { text: 'ORDER NOW', color: '#ffffff', fontSize: 13 },
        ctaColor: ORANGE,
        ctaLink: { type: 'custom' as const, url: '#order' },
      },
    },
    {
      type: 'RichTextBlock',
      props: {
        id: 'about-products-heading',
        title: { text: 'A Little About Our Products', color: '#ffffff', fontSize: 32, fontFamily: "'Playfair Display', serif" },
        titleAlignment: 'center',
        content: '<p>Quality ingredients designed for your health and well-being.</p>',
        contentAlignment: 'center',
        contentFontSize: 14,
        maxWidth: '700px',
        backgroundColor: DARK_GREEN,
        textColor: LIGHT_MUTED,
        padding: '72px 24px 8px',
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'about-products-grid',
        layout: 'card',
        columns: 2,
        features: [
          { icon: { url: darkCardIcon('leaf'), prompt: '', mediaType: 'image' as const }, title: { text: 'Natural & Organic Products', color: '#ffffff', fontSize: 17 }, subtitle: { text: 'Discover a range of carefully sourced natural and organic products that nourish your body and promote a healthier lifestyle.', color: LIGHT_MUTED, fontSize: 13 } },
          { icon: { url: darkCardIcon('ban'), prompt: '', mediaType: 'image' as const }, title: { text: 'Not Tested On Animals', color: '#ffffff', fontSize: 17 }, subtitle: { text: 'Our commitment to cruelty-free practices ensures that all our products are never tested on animals, promoting kindness to all living beings.', color: LIGHT_MUTED, fontSize: 13 } },
          { icon: { url: darkCardIcon('shield'), prompt: '', mediaType: 'image' as const }, title: { text: 'Toxin Free', color: '#ffffff', fontSize: 17 }, subtitle: { text: 'Enjoy peace of mind with our toxin-free products, crafted to promote health and wellness without harmful chemicals or additives.', color: LIGHT_MUTED, fontSize: 13 } },
          { icon: { url: darkCardIcon('flask'), prompt: '', mediaType: 'image' as const }, title: { text: 'Medically Tested Cosmetics', color: '#ffffff', fontSize: 17 }, subtitle: { text: 'Experience the confidence of using medically tested cosmetics, formulated for safety and efficacy to enhance your beauty without compromising your health.', color: LIGHT_MUTED, fontSize: 13 } },
        ],
        backgroundColor: DARK_GREEN,
        cardBackgroundColor: DARK_GREEN_LIGHT,
        borderTop: false,
        borderBottom: false,
        padding: 40,
        iconSize: 44,
        iconLayout: 'icon-title-subtitle',
      },
    },
    {
      type: 'ReviewList',
      props: {
        id: 'reviews-wellness-1',
        theme: 'cards-grid',
        sectionTitle: { text: 'Customers Love KARE', color: DARK_TEXT, fontSize: 32, fontFamily: "'Playfair Display', serif" },
        subtitle: { text: 'TESTIMONIALS', color: ORANGE, fontSize: 12 },
        backgroundColor: MINT,
        textColor: DARK_TEXT,
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
      type: 'ImageTextSplit',
      props: {
        id: 'its-wellness-gift',
        sectionTitle: { text: 'PUT PEOPLE FIRST', color: ORANGE, fontSize: 12 },
        headline: { text: 'Send The Gift To Your Loved Ones', color: '#ffffff', fontSize: 30, fontFamily: "'Playfair Display', serif" },
        description: 'Experience the rich, fruity flavor of our cold-pressed organic extra virgin olive oil. Perfect for drizzling over salads, cooking, or dipping, this oil is packed with antioxidants and healthy fats.',
        image: { url: 'https://placehold.co/520x520/0d3b2e/f97316?text=Gift+Box', prompt: '', mediaType: 'image' as const },
        imagePosition: 'left',
        backgroundColor: DARK_GREEN_LIGHT,
        ctaText: { text: 'SEND GIFT', color: '#ffffff', fontSize: 13 },
        ctaColor: ORANGE,
        ctaLink: { type: 'custom' as const, url: '#gift' },
      },
    },
    {
      type: 'FeatureIconRow',
      props: {
        id: 'features-wellness-as-seen',
        headerLabel: 'AS SEEN IN',
        features: [
          { icon: { url: wordmarkIcon('Logoipsum', DARK_GREEN), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 14 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 12 } },
          { icon: { url: wordmarkIcon('LOGO', DARK_GREEN), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 14 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 12 } },
          { icon: { url: wordmarkIcon('logoipsum', DARK_GREEN), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 14 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 12 } },
          { icon: { url: wordmarkIcon('Ipsum & Co', DARK_GREEN), prompt: '', mediaType: 'image' as const }, title: { text: '', color: DARK_TEXT, fontSize: 14 }, subtitle: { text: '', color: MUTED_TEXT, fontSize: 12 } },
        ],
        backgroundColor: MINT,
        borderTop: false,
        borderBottom: false,
        padding: 28,
        iconSize: 40,
        iconWidth: 140,
        iconLayout: 'icon-only',
      },
    },
    {
      type: 'CallToActionBanner',
      props: {
        id: 'cta-wellness-final',
        theme: 'plain',
        headline: { text: 'We Believe Everyone Deserves Beautiful Skin.', color: '#ffffff', fontSize: 32, fontFamily: "'Playfair Display', serif" },
        subheadline: { text: 'Learn the best practices for using organic oils in different flavors and nutritions, also get to explore essential oils that help alleviate stress and promote relaxation.', color: LIGHT_MUTED, fontSize: 14 },
        ctaText: { text: 'ORDER NOW', color: DARK_GREEN, fontSize: 13 },
        ctaLink: { type: 'custom' as const, url: '#order' },
        ctaColor: '#ffffff',
        backgroundColor: DARK_GREEN,
        badgePosition: 'none',
        padding: 72,
        maxWidth: 900,
        fullWidth: true,
      },
    },
    {
      type: 'PageFooter',
      props: {
        id: 'footer-wellness-1',
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
