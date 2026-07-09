type SectionContent = {
  type?: string;
  theme?: string;
};

type MappingFactory = (planContent: any, sectionContent: SectionContent | undefined, index: number) => any;

type SectionMapping = {
  component: string;
  getDefaultProps: MappingFactory;
};

type ImageTextDefaults = {
  key: string;
  slug: string;
  title: string;
  fallbackHeadline: string;
  description: string;
  imagePosition: 'left' | 'right';
};

function generation(sectionContent: SectionContent | undefined, fallbackType: string) {
  return {
    sectionType: sectionContent?.type || fallbackType,
    theme: sectionContent?.theme || '',
  };
}

function generatedBase(sectionContent: SectionContent | undefined, sectionType: string, id: string) {
  return {
    id,
    _generate: generation(sectionContent, sectionType),
    _generated: false,
  };
}

function mapping(component: string, getDefaultProps: MappingFactory): SectionMapping {
  return { component, getDefaultProps };
}

function skipSection(): SectionMapping {
  return mapping('', () => null);
}

function imageTextSection(defaults: ImageTextDefaults): SectionMapping {
  return mapping('ImageTextSplit', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, defaults.key, `${defaults.slug}-${index}`),
    _sectionType: defaults.key,
    sectionTitle: defaults.title,
    headline: sectionContent?.theme || defaults.fallbackHeadline,
    description: defaults.description,
    bulletPoints: [],
    imagePosition: defaults.imagePosition,
  }));
}

const IMAGE_TEXT_ROWS: Array<[string, string, string, string, string, 'left' | 'right']> = [
  ['BACKGROUND_2', 'background', 'OUR MISSION', 'Brand Slogan Here', 'Your trusted partner.', 'left'],
  ['PAIN_POINTS', 'pain-points', 'THE PROBLEM', 'Understanding Your Struggles', 'We understand your pain points.', 'left'],
  ['ADVANTAGES', 'advantages', 'THE SOLUTION', 'Why Choose Us', 'Our unique advantages.', 'right'],
  ['SCENE_BENEFIT_1', 'scene-benefit-1', 'BENEFIT 1', 'First Key Benefit', 'Experience the difference.', 'left'],
  ['SCENE_BENEFIT_2', 'scene-benefit-2', 'BENEFIT 2', 'Second Key Benefit', 'Another amazing benefit.', 'right'],
  ['INGREDIENT_INTRO', 'ingredient-intro', 'KEY INGREDIENTS', 'Natural & Safe Ingredients', 'Premium quality ingredients.', 'left'],
  ['PATENT_INTRO', 'patent-intro', 'PATENTED TECHNOLOGY', 'Innovative Technology', 'Our unique patented technology.', 'right'],
  ['BENEFIT_INTRO', 'benefit-intro', 'REAL RESULTS', 'Quantified Benefits', 'See the real results.', 'left'],
  ['CERTIFICATION', 'certification', 'CERTIFIED QUALITY', 'Trust & Certification', 'FDA approved quality.', 'right'],
  ['INGREDIENTS', 'ingredients', 'INGREDIENTS', "What's Inside", 'Premium ingredients.', 'left'],
];

const IMAGE_TEXT_SECTIONS: ImageTextDefaults[] = IMAGE_TEXT_ROWS.map(([key, slug, title, fallbackHeadline, description, imagePosition]) => ({
  key,
  slug,
  title,
  fallbackHeadline,
  description,
  imagePosition,
}));

const imageTextMappings = Object.fromEntries(
  IMAGE_TEXT_SECTIONS.map((defaults) => [defaults.key, imageTextSection(defaults)]),
);

export const SECTION_TO_COMPONENT: Record<string, SectionMapping> = {
  LOGO: skipSection(),

  BANNER: mapping('HeroPanel', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'BANNER', `hero-${index}`),
    logoImage: { url: '', prompt: 'Brand logo, square format, clean design', mediaType: 'image' },
    tagline: 'The Answer to Better Results',
    headline: sectionContent?.theme?.split('.')[0] || 'Discover Our Product',
    subheadline: 'Experience the revolutionary solution.',
    benefits: [
      { value: 'Clinically proven formula' },
      { value: 'Natural ingredients' },
      { value: '30-day money back guarantee' },
    ],
    ctaText: 'Shop Now',
    ctaLink: { type: 'custom', url: '' },
    trustBadges: [
      { value: '⭐ EFFECTIVE' },
      { value: '🌿 SCIENCE' },
      { value: '💰 MONEY' },
    ],
  })),

  REVIEW_CAROUSEL: mapping('ReviewList', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'REVIEW_CAROUSEL', `reviews-carousel-${index}`),
    theme: 'carousel',
    sectionTitle: '★★★★★ Excellent Reviews',
    subtitle: sectionContent?.theme || 'Join thousands of happy customers',
  })),

  ...imageTextMappings,

  EXPERT: mapping('EndorsementPanel', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'EXPERT', `expert-${index}`),
    sectionTitle: 'Say Hello To The Experts',
    expertName: 'Dr. Sarah Parker, M.D.',
    expertTitle: 'Board Certified Specialist',
    quote: sectionContent?.theme || "This is one of the most effective solutions I've seen.",
    credentials: [
      { value: 'Medical Expert' },
      { value: '15+ Years Experience' },
      { value: 'Published Researcher' },
    ],
  })),

  PRODUCT_DISPLAY: mapping('ProductSpotlight', (planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'PRODUCT_DISPLAY', `product-${index}`),
    headline: sectionContent?.theme?.split('.')[0] || 'Get your product today!',
    productName: planContent?.keySellingPoints?.[0]?.split(' ')[0] || 'Premium Product',
    badgeText: 'Amazing Deal',
    cardTitle: 'Get Product And Change Starts Today!',
    ctaText: 'CHECK AVAILABILITY',
    guaranteeText: '30 Day Money-Back Guarantee',
    showPaymentIcons: true,
    countdownHours: 2,
    countdownMinutes: 44,
    countdownSeconds: 14,
  })),

  USAGE_STEPS: mapping('HowToSteps', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'USAGE_STEPS', `usage-steps-${index}`),
    sectionTitle: sectionContent?.theme || 'How to Use - Simple & Effective',
    subtitle: 'Easy steps for the best results',
    steps: [],
  })),

  REVIEWS: mapping('ReviewList', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'REVIEWS', `customer-reviews-${index}`),
    theme: 'list',
    sectionTitle: sectionContent?.theme || 'What people are saying about our product',
    reviews: [],
  })),

  SHIPPING: mapping('ImageTextSplit', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'SHIPPING', `shipping-${index}`),
    _sectionType: 'SHIPPING',
    sectionTitle: 'SHIPPING & GUARANTEE',
    headline: sectionContent?.theme || 'Risk-Free Purchase',
    description: 'Free shipping worldwide. 30-day money back guarantee. 24/7 customer support.',
    bulletPoints: [
      { icon: '🌍', title: 'Global Shipping', description: '' },
      { icon: '💰', title: '30-Day Money Back', description: '' },
      { icon: '📦', title: 'Free Shipping', description: '' },
      { icon: '💬', title: '24/7 Support', description: '' },
    ],
    imagePosition: 'right',
  })),

  FAQ: mapping('FaqAccordion', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'FAQ', `faq-${index}`),
    title: sectionContent?.theme || 'Frequently Asked Questions',
    faqs: [],
  })),

  FOOTER_LOGO: mapping('Footer', (_planContent, sectionContent, index) => ({
    ...generatedBase(sectionContent, 'FOOTER_LOGO', `footer-${index}`),
    tagline: 'Your trusted partner',
    backgroundColor: '#1e293b',
  })),
};
