import React from 'react';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createMediaField, type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue, getTextContent, getTextString, getTextStyle } from '../TextField';

interface FeatureItem {
  icon?: string | MediaFieldValue;
  title?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
}

export interface FeatureIconRowProps {
  id?: string;
  features?: FeatureItem[];
  backgroundColor?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
  padding?: number;
  iconSize?: number;
  iconWidth?: number;
  layout?: 'inline' | 'card';
  cardBackgroundColor?: string;
  headerLabel?: string;
  iconLayout?: 'icon-only' | 'icon-title' | 'icon-title-subtitle';
  itemSeparator?: boolean;
  columns?: number;
}

const HAIRLINE = '1px solid #e5e7eb';
const SHELL_WIDTH = '1280px';

const headerCss: React.CSSProperties = {
  maxWidth: SHELL_WIDTH,
  margin: '0 auto 24px',
  textAlign: 'center',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#475569',
};

const cardTileCss: React.CSSProperties = {
  borderRadius: '16px',
  padding: '32px 20px',
  textAlign: 'center',
  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
};

const inlineCellCss: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

function resolveIconSrc(icon: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string {
  if (!icon) return '';
  if (typeof icon === 'string') return icon;
  if (icon.url) return icon.url;
  return placeholderUrl(icon.prompt, puck);
}

export function FeatureIconRow({
  features = [],
  backgroundColor = '#f8fafc',
  borderTop = true,
  borderBottom = true,
  padding = 32,
  iconSize = 40,
  iconWidth = 0,
  layout = 'inline',
  cardBackgroundColor = '#ffffff',
  headerLabel,
  iconLayout = 'icon-title-subtitle',
  itemSeparator = false,
  columns = 0,
  puck,
}: FeatureIconRowProps & PuckRenderExtras) {
  const cardMode = layout === 'card';
  const columnCount = columns >= 1 ? Math.min(columns, 6) : Math.min(Math.max(features.length, 1), 4);
  const wantsTitle = iconLayout !== 'icon-only';
  const wantsSubtitle = iconLayout === 'icon-title-subtitle';

  const sectionStyle: React.CSSProperties = {
    backgroundColor,
    padding: `${padding}px 24px`,
    borderTop: borderTop ? HAIRLINE : 'none',
    borderBottom: borderBottom ? HAIRLINE : 'none',
  };

  const trackStyle: React.CSSProperties = cardMode
    ? {
        maxWidth: SHELL_WIDTH,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gap: '20px',
      }
    : iconLayout === 'icon-only'
      ? {
          maxWidth: SHELL_WIDTH,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px 56px',
        }
      : {
          maxWidth: SHELL_WIDTH,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '24px',
        };

  const renderItem = (feature: FeatureItem, index: number) => {
    const titleText = getTextContent(feature.title);
    const subtitleText = getTextContent(feature.subtitle);
    const titleStyle = getTextStyle(feature.title, { color: '#1e293b', fontSize: 15 });
    const subtitleStyle = getTextStyle(feature.subtitle, { color: '#64748b', fontSize: 13 });
    const iconSrc = resolveIconSrc(feature.icon, puck);
    const notLast = index !== features.length - 1;
    const dividerActive = itemSeparator && notLast;

    const iconAlt = getTextString(feature.title) || `Feature ${index + 1}`;
    const iconEl = iconSrc ? (
      <img
        src={iconSrc}
        alt={iconAlt}
        style={{
          width: `${iconWidth >= 1 ? iconWidth : iconSize}px`,
          height: `${iconSize}px`,
          objectFit: 'contain',
          ...(cardMode ? null : { flexShrink: 0 }),
          ...getMediaDisplayStyle(feature.icon),
        }}
      />
    ) : null;

    if (cardMode) {
      const tileStyle: React.CSSProperties = {
        ...cardTileCss,
        background: cardBackgroundColor,
        ...(dividerActive ? { borderRight: HAIRLINE } : null),
      };
      return (
        <div key={index} style={tileStyle}>
          {iconEl}
          {wantsTitle && titleText && (
            <div style={{ ...titleStyle, fontWeight: 700, lineHeight: 1.3 }}>{titleText}</div>
          )}
          {wantsSubtitle && subtitleText && (
            <div style={{ ...subtitleStyle, lineHeight: 1.5 }}>{subtitleText}</div>
          )}
        </div>
      );
    }

    const cellStyle: React.CSSProperties = {
      ...inlineCellCss,
      ...(wantsTitle || wantsSubtitle ? { minWidth: '200px' } : null),
      ...(dividerActive ? { borderRight: HAIRLINE, paddingRight: '24px' } : null),
    };
    return (
      <div key={index} style={cellStyle}>
        {iconEl}
        {(wantsTitle || wantsSubtitle) && (
          <div style={wantsSubtitle ? { maxWidth: '216px' } : undefined}>
            {wantsTitle && titleText && (
              <div style={{ ...titleStyle, fontWeight: 600, lineHeight: 1.3 }}>{titleText}</div>
            )}
            {wantsSubtitle && subtitleText && (
              <div style={{ ...subtitleStyle, lineHeight: 1.4, marginTop: '2px' }}>{subtitleText}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      style={sectionStyle}
      className={`feature-icons-bar${cardMode ? ' feature-icons-bar--card' : ''}`}
    >
      {headerLabel ? <div style={headerCss}>{headerLabel}</div> : null}
      <div style={trackStyle}>{features.map(renderItem)}</div>

      <style>{`
        @media (max-width: 768px) {
          .feature-icons-bar:not(.feature-icons-bar--card) > div {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center;
          }
          .feature-icons-bar:not(.feature-icons-bar--card) > div > div {
            flex-direction: column !important;
            align-items: center !important;
          }
          .feature-icons-bar--card > div {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </section>
  );
}

export const FeatureIconRowConfig = {
  label: 'Feature Icons Bar',
  fields: {
    features: {
      type: 'array' as const,
      label: 'Features',
      arrayFields: {
        icon: createMediaField({ label: 'Icon Image', aspectRatio: '1:1', fieldName: 'featureIcon' }),
        title: createTextField({ label: 'Title', defaultColor: '#1e293b', defaultFontSize: 15 }),
        subtitle: createTextField({ label: 'Subtitle', defaultColor: '#64748b', defaultFontSize: 13 }),
      },
      getItemSummary: (item: any) => {
        const title = item?.title;
        if (!title) return 'Feature';
        if (typeof title === 'string') return title || 'Feature';
        return title.text || 'Feature';
      },
      defaultItemProps: {
        icon: { url: '', prompt: '', mediaType: 'image' as const },
        title: { text: '', color: '#1e293b', fontSize: 15 },
        subtitle: { text: '', color: '#64748b', fontSize: 13 },
      },
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderTop: {
      type: 'radio' as const,
      label: 'Top Border',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    borderBottom: {
      type: 'radio' as const,
      label: 'Bottom Border',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    padding: {
      type: 'number' as const,
      label: 'Padding (px)',
      min: 8,
      max: 64,
    },
    iconSize: {
      type: 'number' as const,
      label: 'Icon Size (px)',
      min: 16,
      max: 128,
    },
    iconWidth: {
      type: 'number' as const,
      label: 'Icon Width (px, 0 = same as size — use for wide logos)',
      min: 0,
      max: 240,
    },
    columns: {
      type: 'number' as const,
      label: 'Columns (card layout, 0 = auto)',
      min: 0,
      max: 6,
    },
    layout: {
      type: 'radio' as const,
      label: 'Layout',
      options: [
        { label: 'Inline (icon + text side by side)', value: 'inline' },
        { label: 'Card (stacked in white tiles)', value: 'card' },
      ],
    },
    cardBackgroundColor: createColorField({ label: 'Card Background (card layout only)' }),
    headerLabel: { type: 'text' as const, label: 'Header Label (above icons)', contentEditable: true },
    iconLayout: {
      type: 'radio' as const,
      label: 'Icon Layout',
      options: [
        { label: 'Icon only', value: 'icon-only' },
        { label: 'Icon + Title', value: 'icon-title' },
        { label: 'Icon + Title + Subtitle', value: 'icon-title-subtitle' },
      ],
    },
    itemSeparator: {
      type: 'radio' as const,
      label: 'Item Separator',
      options: [
        { label: 'On', value: true },
        { label: 'Off', value: false },
      ],
    },
  },
  defaultProps: {
    features: [],
    backgroundColor: '#f8fafc',
    borderTop: true,
    borderBottom: true,
    padding: 32,
    iconSize: 40,
    iconWidth: 0,
    columns: 0,
    layout: 'inline',
    cardBackgroundColor: '#ffffff',
    iconLayout: 'icon-title-subtitle' as const,
    itemSeparator: false,
  },
};

export default FeatureIconRow;
