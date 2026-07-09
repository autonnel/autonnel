import React from 'react';
import type { ComponentData } from '@puckeditor/core';
import { createColorField } from '../ColorField';
import { createMediaField, type MediaFieldValue } from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

type SlotRender = React.FC<{
  className?: string;
  style?: React.CSSProperties;
}>;

type ContentAlignment = 'left' | 'center' | 'right';

export interface UpsellHeaderProps {
  backgroundImage?: string | MediaFieldValue;
  backgroundColor?: string;
  contentAlign?: ContentAlignment;
  contentMaxWidth?: number;
  padding?: number;
  minHeight?: number;
  fullWidth?: boolean;
  content?: ComponentData[] | SlotRender;
}

const CONTENT_JUSTIFY: Record<ContentAlignment, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

const ALIGNMENT_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
] as const;

function mediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
}

function heroBackground(color: string, imageUrl: string) {
  return imageUrl ? `${color} url(${imageUrl}) center/cover no-repeat` : color;
}

function shellStyle(props: Required<Pick<UpsellHeaderProps, 'backgroundColor' | 'padding' | 'minHeight'>> & {
  imageUrl: string;
}): React.CSSProperties {
  return {
    background: heroBackground(props.backgroundColor, props.imageUrl),
    padding: `${props.padding}px 16px`,
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    minHeight: props.minHeight > 0 ? props.minHeight : undefined,
    alignItems: 'center',
  };
}

function ContentFrame({
  align,
  maxWidth,
  fullWidth,
  Content,
}: {
  align: ContentAlignment;
  maxWidth: number;
  fullWidth: boolean;
  Content?: ComponentData[] | SlotRender;
}) {
  const RenderSlot = typeof Content === 'function' ? Content : null;

  return (
    <div
      className={fullWidth ? 'puck-full-width-inner' : undefined}
      style={{ width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: CONTENT_JUSTIFY[align] }}
    >
      <div style={{ width: '100%', maxWidth }}>
        {RenderSlot && <RenderSlot />}
      </div>
    </div>
  );
}

function responsiveCss() {
  return (
    <style>{`
      @media (max-width: 768px) {
        .upsell-hero-section {
          justify-content: center !important;
        }
      }
    `}</style>
  );
}

export function UpsellHeader({
  backgroundImage,
  backgroundColor = '#0a3d4c',
  contentAlign = 'center',
  contentMaxWidth = 600,
  padding = 40,
  minHeight = 0,
  fullWidth = false,
  content: Content,
  puck,
}: UpsellHeaderProps & PuckRenderExtras) {
  return (
    <div
      className={`upsell-hero-section${fullWidth ? ' puck-full-width' : ''}`}
      style={shellStyle({ backgroundColor, padding, minHeight, imageUrl: mediaUrl(backgroundImage, puck) })}
    >
      <ContentFrame
        align={contentAlign}
        maxWidth={contentMaxWidth}
        fullWidth={fullWidth}
        Content={Content}
      />
      {responsiveCss()}
    </div>
  );
}

export const UpsellHeaderConfig = {
  label: 'Upsell Hero Section',
  fields: {
    backgroundImage: createMediaField({ label: 'Background Image', aspectRatio: '16:9', fieldName: 'upsellHeroBg' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    contentAlign: {
      type: 'radio' as const,
      label: 'Content Alignment',
      options: ALIGNMENT_OPTIONS,
    },
    contentMaxWidth: {
      type: 'number' as const,
      label: 'Content Max Width (px)',
      min: 200,
      max: 1200,
    },
    padding: {
      type: 'number' as const,
      label: 'Padding (px)',
      min: 0,
      max: 100,
    },
    minHeight: {
      type: 'number' as const,
      label: 'Min Height (px, 0 = auto)',
      min: 0,
      max: 1200,
    },
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width (break out of container)',
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
    },
    content: {
      type: 'slot' as const,
      label: 'Nested Content',
    },
  },
  defaultProps: {
    backgroundImage: { url: '', prompt: '', mediaType: 'image' as const },
    backgroundColor: '#0a3d4c',
    contentAlign: 'center',
    contentMaxWidth: 600,
    padding: 40,
    minHeight: 0,
    fullWidth: false,
    content: [],
  },
  render: UpsellHeader,
};

export default UpsellHeader;
