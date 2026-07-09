import type { Data } from '@puckeditor/core';
import { builderExtensions } from 'virtual:autonnel/builder-ext';
import { mergeTemplates, assertBuilderExtensionsValid } from '@/components/builder/merge-extensions';
import { CORE_COMPONENT_KEYS } from '@/components/builder/core-component-keys';
import type { TemplateDescriptor, TemplateSection } from './types';
import { policyTemplate } from './generators/policy';
import { trackingTemplate } from './generators/tracking';
import { errorTemplate } from './generators/error';
import { lpSkincareTemplate } from './generators/lp-skincare';
import { lpWellnessTemplate } from './generators/lp-wellness';
import { checkoutSkincareTemplate } from './generators/checkout-skincare';
import { checkoutWellnessTemplate } from './generators/checkout-wellness';
import { upsellSkincareTemplate } from './generators/upsell-skincare';
import { upsellWellnessTemplate } from './generators/upsell-wellness';
import { thankyouSkincareTemplate } from './generators/thankyou-skincare';
import { thankyouWellnessTemplate } from './generators/thankyou-wellness';

const EMPTY_DATA: Data = { root: { props: {} }, content: [], zones: {} };

const CORE_TEMPLATE_REGISTRY: TemplateDescriptor[] = [
  {
    value: 'POLICY',
    label: 'Policy Page',
    subtitle: 'Privacy / terms page',
    section: 'utility',
    thumbnail: '/template-thumbnails/policy.png',
    defaultPageType: 'CUSTOM',
    generator: policyTemplate,
  },
  {
    value: 'TRACKING',
    label: 'Order Tracking',
    subtitle: 'Customer order lookup page',
    section: 'utility',
    thumbnail: '/template-thumbnails/tracking.png',
    defaultPageType: 'CUSTOM',
    defaultSlug: 'tracking',
    generator: trackingTemplate,
  },
  {
    value: 'ERROR',
    label: 'Error Page',
    subtitle: 'Payment error handling',
    section: 'utility',
    thumbnail: '/template-thumbnails/error.png',
    defaultPageType: 'ERROR',
    generator: errorTemplate,
  },
  {
    value: 'LP_SKINCARE',
    label: 'Landing Page · Skincare',
    subtitle: 'Cream-focused cosmetics funnel LP',
    section: 'funnel',
    thumbnail: '/template-thumbnails/lp-skincare.png',
    defaultPageType: 'CUSTOM',
    defaultSlug: 'lp-skincare',
    generator: lpSkincareTemplate,
  },
  {
    value: 'LP_WELLNESS',
    label: 'Landing Page · Wellness',
    subtitle: 'Organic-oil / wellness funnel LP',
    section: 'funnel',
    thumbnail: '/template-thumbnails/lp-wellness.png',
    defaultPageType: 'CUSTOM',
    defaultSlug: 'lp-wellness',
    generator: lpWellnessTemplate,
  },
  {
    value: 'CHECKOUT_SKINCARE',
    label: 'Checkout · Skincare',
    subtitle: 'Two-column cream checkout',
    section: 'funnel',
    thumbnail: '/template-thumbnails/checkout-skincare.png',
    defaultPageType: 'CHECKOUT',
    defaultSlug: 'checkout-skincare',
    generator: checkoutSkincareTemplate,
  },
  {
    value: 'CHECKOUT_WELLNESS',
    label: 'Checkout · Wellness',
    subtitle: 'Hero-led organic-oil checkout',
    section: 'funnel',
    thumbnail: '/template-thumbnails/checkout-wellness.png',
    defaultPageType: 'CHECKOUT',
    defaultSlug: 'checkout-wellness',
    generator: checkoutWellnessTemplate,
  },
  {
    value: 'UPSELL_SKINCARE',
    label: 'Upsell · Skincare',
    subtitle: 'Combo offer with image-text bundles',
    section: 'funnel',
    thumbnail: '/template-thumbnails/upsell-skincare.png',
    defaultPageType: 'UPSELL',
    defaultSlug: 'upsell-skincare',
    generator: upsellSkincareTemplate,
  },
  {
    value: 'UPSELL_WELLNESS',
    label: 'Upsell · Wellness',
    subtitle: 'Single-product upsell with stepper',
    section: 'funnel',
    thumbnail: '/template-thumbnails/upsell-wellness.png',
    defaultPageType: 'UPSELL',
    defaultSlug: 'upsell-wellness',
    generator: upsellWellnessTemplate,
  },
  {
    value: 'THANKYOU_SKINCARE',
    label: 'Thank You · Skincare',
    subtitle: 'Cream confirmation + social grid',
    section: 'funnel',
    thumbnail: '/template-thumbnails/thankyou-skincare.png',
    defaultPageType: 'THANKYOU',
    defaultSlug: 'thank-you-skincare',
    generator: thankyouSkincareTemplate,
  },
  {
    value: 'THANKYOU_WELLNESS',
    label: 'Thank You · Wellness',
    subtitle: 'Dark eco-themed thank-you with coupon',
    section: 'funnel',
    thumbnail: '/template-thumbnails/thankyou-wellness.png',
    defaultPageType: 'THANKYOU',
    defaultSlug: 'thank-you-wellness',
    generator: thankyouWellnessTemplate,
  },
];

// Server-only chokepoint: hard-fail the build/startup on namespace collisions or
// unsatisfied template `requires`. Zero plugins -> empty array -> never throws.
assertBuilderExtensionsValid(
  builderExtensions,
  new Set<string>(CORE_COMPONENT_KEYS),
  new Set<string>(CORE_TEMPLATE_REGISTRY.map((t) => t.value)),
);

export const TEMPLATE_REGISTRY: TemplateDescriptor[] = mergeTemplates(
  CORE_TEMPLATE_REGISTRY,
  builderExtensions,
);

export function getTemplateByValue(value: string): TemplateDescriptor | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.value === value);
}

export function getTemplatesBySection(section: TemplateSection): TemplateDescriptor[] {
  return TEMPLATE_REGISTRY.filter((t) => t.section === section);
}

export function getTemplateData(value: string): Data {
  const t = getTemplateByValue(value);
  if (!t) return EMPTY_DATA;
  return t.generator();
}
