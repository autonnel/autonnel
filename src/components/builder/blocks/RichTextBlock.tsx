import React from 'react';
import type { ReactNode } from 'react';
import { createMediaField, type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle, hasText } from '../TextField';
import { useTranslation } from '../LanguageContext';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

type Align = 'left' | 'center' | 'right';

interface RichTextBlockProps {
  title?: string | TextFieldValue;
  content?: string | ReactNode;
  backgroundColor?: string;
  backgroundImage?: string | MediaFieldValue;
  backgroundOverlay?: number;
  textColor?: string;
  contentFontSize?: number;
  contentAlignment?: Align;
  maxWidth?: string;
  padding?: string;
  titleAlignment?: Align;
  lastUpdated?: string | TextFieldValue;
}

const RT_CONTENT_CSS =
  '.rt-content { line-height: 1.8; }\n.rt-content > * + * { margin-top: 1em; }\n.rt-content ul, .rt-content ol { padding-left: 1.5em; }\n.rt-content li + li { margin-top: 0.35em; }';

function resolveMediaSrc(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string {
  if (!media) return '';
  if (typeof media === 'string') return media;
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function RichTextBlock(props: RichTextBlockProps & PuckRenderExtras) {
  const {
    title,
    content = '',
    backgroundColor = '#ffffff',
    backgroundImage,
    backgroundOverlay = 0,
    textColor = '#374151',
    contentFontSize = 16,
    contentAlignment = 'left',
    maxWidth = '800px',
    padding = '48px 24px',
    titleAlignment = 'center',
    lastUpdated,
  } = props;

  const t = useTranslation();

  const heading = getTextContent(title, '');
  const stamp = getTextContent(lastUpdated, '');

  const mediaSrc = resolveMediaSrc(backgroundImage, props.puck);
  const hasMedia = mediaSrc.length > 0;
  const fitContain = hasMedia && getMediaDisplayStyle(backgroundImage)?.objectFit === 'contain';
  const overlay = clampPercent(backgroundOverlay) / 100;
  const showScrim = hasMedia && overlay > 0;

  const sectionStyle: React.CSSProperties = {
    position: 'relative',
    background: backgroundColor,
    padding,
  };
  if (hasMedia) {
    sectionStyle.backgroundImage = `url(${mediaSrc})`;
    sectionStyle.backgroundSize = fitContain ? 'contain' : 'cover';
    sectionStyle.backgroundPosition = 'center';
    sectionStyle.backgroundRepeat = 'no-repeat';
  }

  return (
    <div className="lp-section-padding rich-text-section" style={sectionStyle}>
      {showScrim && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(0, 0, 0, ${overlay})`,
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ position: 'relative', maxWidth, margin: '0 auto', color: textColor }}>
        {hasText(title) && (
          <h1
            className="rt-title"
            style={{
              ...getTextStyle(title, { color: '#111827', fontSize: 40 }),
              fontWeight: 'bold',
              marginBottom: '16px',
              textAlign: titleAlignment,
            }}
          >
            {heading}
          </h1>
        )}

        {hasText(lastUpdated) && (
          <p
            style={{
              ...getTextStyle(lastUpdated, { color: '#6b7280', fontSize: 14 }),
              marginBottom: '32px',
              textAlign: titleAlignment,
            }}
          >
            {t('richText.lastUpdated')} {stamp}
          </p>
        )}

        <div
          className="rt-content"
          style={{ fontSize: `${contentFontSize}px`, textAlign: contentAlignment }}
        >
          {typeof content === 'string' ? (
            <span dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            content
          )}
        </div>
      </div>

      <style>{RT_CONTENT_CSS}</style>
    </div>
  );
}

const ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const WIDTH_OPTIONS = [
  { label: '600px (Narrow)', value: '600px' },
  { label: '700px (Medium)', value: '700px' },
  { label: '800px (Default)', value: '800px' },
  { label: '900px (Wide)', value: '900px' },
  { label: '100% (Full)', value: '100%' },
];

export const RichTextBlockConfig = {
  fields: {
    title: createTextField({ label: 'Page Title (leave blank to hide)', defaultColor: '#111827', defaultFontSize: 40 }),
    titleAlignment: {
      type: 'select' as const,
      label: 'Title Alignment',
      options: ALIGN_OPTIONS,
    },
    lastUpdated: createTextField({ label: 'Last Updated Date', defaultColor: '#6b7280', defaultFontSize: 14 }),
    content: { type: 'richtext' as const, label: 'Content', contentEditable: true },
    contentFontSize: {
      type: 'number' as const,
      label: 'Content Font Size (px)',
      min: 10,
      max: 80,
    },
    contentAlignment: {
      type: 'select' as const,
      label: 'Content Alignment',
      options: ALIGN_OPTIONS,
    },
    maxWidth: {
      type: 'select' as const,
      label: 'Content Width',
      options: WIDTH_OPTIONS,
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    backgroundImage: createMediaField({ label: 'Background Image (optional)', aspectRatio: '16:9', fieldName: 'richTextBackground' }),
    backgroundOverlay: {
      type: 'number' as const,
      label: 'Background Overlay (% — darkens image)',
      min: 0,
      max: 100,
    },
    textColor: {
      type: 'text' as const,
      label: 'Text Color',
    },
    padding: {
      type: 'text' as const,
      label: 'Padding (CSS)',
    },
  },
  defaultProps: {
    title: { text: '', color: '#111827', fontSize: 40 },
    titleAlignment: 'center' as const,
    lastUpdated: { text: '', color: '#6b7280', fontSize: 14 },
    content: '',
    contentFontSize: 16,
    contentAlignment: 'left' as const,
    maxWidth: '800px',
    backgroundColor: '#ffffff',
    backgroundImage: { url: '', prompt: '', mediaType: 'image' as const },
    backgroundOverlay: 0,
    textColor: '#374151',
    padding: '48px 24px',
  },
};
