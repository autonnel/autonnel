import React from 'react';
import { createColorField } from '../ColorField';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createTextField, getTextContent, getTextString, getTextStyle, hasText, type TextFieldValue } from '../TextField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';

type NavLinkItem = { label: string | TextFieldValue; url: string | URLFieldValue };

interface NavIconItem {
  icon?: string | MediaFieldValue;
  link?: string | URLFieldValue;
  alt?: string;
}

export interface StoreHeaderProps {
  id?: string;
  logo?: string | MediaFieldValue;
  brandName?: string | TextFieldValue;
  links?: NavLinkItem[];
  rightIcons?: NavIconItem[];
  backgroundColor?: string;
  textColor?: string;
}


function mediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
}

function navShellStyle(backgroundColor: string): React.CSSProperties {
  return {
    backgroundColor,
    padding: '12px 24px',
    borderBottom: '1px solid #e5e7eb',
  };
}

function BrandBlock({
  logo,
  brandName,
  textColor,
  puck,
}: Pick<StoreHeaderProps, 'logo' | 'brandName'> & { textColor: string; puck?: { isEditing?: boolean } }) {
  const logoUrl = mediaUrl(logo, puck);
  const brandText = getTextContent(brandName);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={getTextString(brandName) || 'Logo'}
          style={{ height: '40px', width: 'auto', maxWidth: '200px', objectFit: 'contain', ...getMediaDisplayStyle(logo) }}
        />
      )}
      {brandText && (
        <span style={{ ...getTextStyle(brandName, { color: textColor, fontSize: 22 }), fontWeight: 700, whiteSpace: 'nowrap' }}>
          {brandText}
        </span>
      )}
    </div>
  );
}

function StoreLink({ item, textColor }: { item: NavLinkItem; textColor: string }) {
  if (!hasText(item.label)) return null;
  return (
    <a
      href={getURLString(item.url) || '#'}
      suppressHydrationWarning
      style={{ ...getTextStyle(item.label, { color: textColor, fontSize: 15 }), textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
    >
      {getTextContent(item.label)}
    </a>
  );
}

function StoreLinks({ links, textColor }: { links: NavLinkItem[]; textColor: string }) {
  return (
    <div className="store-navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 0', minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {links.map((link, index) => (
        <StoreLink key={index} item={link} textColor={textColor} />
      ))}
    </div>
  );
}

function NavIcon({ item, puck }: { item: NavIconItem; puck?: { isEditing?: boolean } }) {
  const iconUrl = mediaUrl(item.icon, puck);
  if (!iconUrl) return null;

  return (
    <a href={getURLString(item.link) || '#'} suppressHydrationWarning style={{ display: 'flex', alignItems: 'center' }}>
      <img
        src={iconUrl}
        alt={item.alt || ''}
        style={{ width: '22px', height: '22px', objectFit: 'contain', ...getMediaDisplayStyle(item.icon) }}
      />
    </a>
  );
}

function RightIconRail({ icons, puck }: { icons: NavIconItem[]; puck?: { isEditing?: boolean } }) {
  if (icons.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
      {icons.map((item, index) => <NavIcon key={index} item={item} puck={puck} />)}
    </div>
  );
}

function mobileNavCss() {
  return (
    <style>{`
      @media (max-width: 768px) {
        .store-navbar-row {
          flex-wrap: wrap !important;
          justify-content: center !important;
        }
        .store-navbar-links {
          order: 3 !important;
          flex-basis: 100% !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          overflow-x: visible !important;
          padding-top: 8px;
          gap: 10px 16px !important;
        }
      }
    `}</style>
  );
}

export function StoreHeader({
  logo,
  brandName,
  links = [],
  rightIcons = [],
  backgroundColor = '#ffffff',
  textColor = '#1e293b',
  puck,
}: StoreHeaderProps & PuckRenderExtras) {
  return (
    <nav style={navShellStyle(backgroundColor)} className="store-navbar">
      <div className="store-navbar-row" style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <BrandBlock logo={logo} brandName={brandName} textColor={textColor} puck={puck} />
        {links.length > 0 && <StoreLinks links={links} textColor={textColor} />}
        <RightIconRail icons={rightIcons} puck={puck} />
      </div>
      {mobileNavCss()}
    </nav>
  );
}

export const StoreHeaderConfig = {
  label: 'Store Nav Bar',
  fields: {
    logo: createMediaField({ label: 'Logo', aspectRatio: '1:1', fieldName: 'navLogo' }),
    brandName: createTextField({ label: 'Brand Name', defaultColor: '#1e293b', defaultFontSize: 22 }),
    links: {
      type: 'array' as const,
      label: 'Navigation Links',
      arrayFields: {
        label: createTextField({ label: 'Link Text', defaultColor: '#1e293b', defaultFontSize: 15 }),
        url: createURLField({ label: 'URL', placeholder: 'Enter URL' }),
      },
      getItemSummary: (item: any) => getTextString(item?.label, 'Link'),
    },
    rightIcons: {
      type: 'array' as const,
      label: 'Right Icons',
      arrayFields: {
        icon: createMediaField({ label: 'Icon Image', aspectRatio: '1:1', fieldName: 'navIcon' }),
        link: createURLField({ label: 'Link', placeholder: 'Enter URL' }),
        alt: { type: 'text' as const, label: 'Alt Text' },
      },
      getItemSummary: (item: any) => item?.alt || 'Icon',
      defaultItemProps: {
        icon: { url: '', prompt: '', mediaType: 'image' as const },
        link: { type: 'custom' as const, url: '' },
        alt: '',
      },
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    textColor: createColorField({ label: 'Text Color' }),
  },
  defaultProps: {
    logo: { url: '', prompt: '', mediaType: 'image' as const },
    brandName: { text: 'Store', color: '#1e293b', fontSize: 22 },
    links: [],
    rightIcons: [],
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
  },
};

export default StoreHeader;
