import type { ReactNode } from 'react';
import { createMediaField, type MediaFieldValue } from '../MediaField';
import { createURLField, type URLFieldValue } from '../URLField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue, getTextContent } from '../TextField';
import { type PuckRenderExtras } from '../media-placeholder';
import { SiteFooterFull, SiteFooterCompact } from './PageFooter.themes';

export interface PageFooterProps {
  theme: 'full' | 'compact';

  links?: { label: string | TextFieldValue; url: string | URLFieldValue }[];
  backgroundColor?: string;
  fullWidth?: boolean;

  logoImage?: string | MediaFieldValue;
  tagline?: string | TextFieldValue;
  aboutTitle?: string | TextFieldValue;
  aboutText?: string | ReactNode;
  copyright?: string | TextFieldValue;

  brandName?: string | TextFieldValue;
  brandLogo?: string | MediaFieldValue;
  padding?: number;

  showNav?: boolean;
  showAbout?: boolean;
  showLogo?: boolean;
  showCopyright?: boolean;
  showSocial?: boolean;
}

export function PageFooter(props: PageFooterProps & PuckRenderExtras) {
  if (props.theme === 'compact') {
    return <SiteFooterCompact {...props} />;
  }
  return <SiteFooterFull {...props} />;
}

export const PageFooterConfig = {
  fields: {
    theme: {
      type: 'radio' as const,
      label: 'Theme',
      options: [
        { label: 'Full (logo + tagline + about + copyright)', value: 'full' },
        { label: 'Compact (brand + flat links)', value: 'compact' },
      ],
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    links: {
      type: 'array' as const,
      label: 'Navigation Links',
      arrayFields: {
        label: createTextField({ label: 'Link Text', defaultColor: '#ffffff', defaultFontSize: 14 }),
        url: createURLField({ label: 'URL', placeholder: 'Enter URL or select funnel step' }),
      },
      getItemSummary: (item: any) => getTextContent(item?.label) || 'Link',
    },
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width (break out of container)',
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
    },
    logoImage: createMediaField({ label: 'Logo Image (Full)', aspectRatio: '1:1', fieldName: 'footerLogo' }),
    tagline: createTextField({ label: 'Tagline (Full)', defaultColor: '#ffffff', defaultFontSize: 14 }),
    aboutTitle: createTextField({ label: 'About Section Title (Full)', defaultColor: '#ffffff', defaultFontSize: 20 }),
    aboutText: { type: 'richtext' as const, label: 'About Text (Full)', contentEditable: true },
    copyright: createTextField({ label: 'Copyright Text (Full)', defaultColor: 'rgba(255,255,255,0.8)', defaultFontSize: 13 }),
    brandName: createTextField({ label: 'Brand Name (Compact)', defaultColor: '#ffffff', defaultFontSize: 28 }),
    brandLogo: createMediaField({ label: 'Brand Logo (Compact)', aspectRatio: '16:9', fieldName: 'oldCheckoutFooterLogo' }),
    padding: {
      type: 'number' as const,
      label: 'Padding (Compact)',
      min: 0,
      max: 80,
    },
    showNav: {
      type: 'radio' as const,
      label: 'Show Navigation Links',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showAbout: {
      type: 'radio' as const,
      label: 'Show About Section',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showLogo: {
      type: 'radio' as const,
      label: 'Show Logo / Brand',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showCopyright: {
      type: 'radio' as const,
      label: 'Show Copyright',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showSocial: {
      type: 'radio' as const,
      label: 'Show Social Icons',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    theme: 'full' as const,
    backgroundColor: '#1e293b',
    links: [],
    fullWidth: false,
    logoImage: { url: '', prompt: '', mediaType: 'image' as const },
    tagline: { text: 'Your trusted partner', color: '#ffffff', fontSize: 14 },
    aboutTitle: { text: 'About This Site', color: '#ffffff', fontSize: 20 },
    aboutText: '',
    copyright: { text: '', color: 'rgba(255,255,255,0.8)', fontSize: 13 },
    brandName: { text: '', color: '#ffffff', fontSize: 28 },
    brandLogo: { url: '', prompt: '', mediaType: 'image' as const },
    padding: 40,
    showNav: true,
    showAbout: true,
    showLogo: true,
    showCopyright: true,
    showSocial: false,
  },
};

export default PageFooter;
