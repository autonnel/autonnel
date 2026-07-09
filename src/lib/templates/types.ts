import type { Data } from '@puckeditor/core';

export type TemplateSection = 'funnel' | 'store' | 'utility';

export type TemplatePageType =
  | 'CUSTOM'
  | 'CHECKOUT'
  | 'UPSELL'
  | 'THANKYOU'
  | 'ERROR';

export interface TemplateDescriptor {
  value: string;
  label: string;
  subtitle: string;
  section: TemplateSection;
  thumbnail: string | null;
  defaultPageType: TemplatePageType;
  defaultSlug?: string;
  generator: () => Data;
}
