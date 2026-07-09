import React from 'react';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import {
  createMediaField,
  getMediaDisplayStyle,
  type MediaFieldValue,
} from '../MediaField';
import { scaledFontSize } from '../TextField';

export interface ImageBlockProps {
  image?: string | MediaFieldValue;
  alt?: string;
  maxWidth?: number | string;
  maxHeight?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  fillHeight?: boolean;
}

const JUSTIFY: Record<NonNullable<ImageBlockProps['alignment']>, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

function getMediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string {
  if (!media) return '';
  if (typeof media === 'string') return media;
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
}

export function ImageBlock({
  image,
  alt = 'Image',
  maxWidth = '100%',
  maxHeight,
  objectFit = 'contain',
  alignment = 'center',
  backgroundColor = 'transparent',
  padding = 16,
  borderRadius = 0,
  fillHeight = false,
  puck,
}: ImageBlockProps & PuckRenderExtras) {
  const url = getMediaUrl(image, puck);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: JUSTIFY[alignment],
    ...(fillHeight ? { alignItems: 'stretch' } : {}),
    background: backgroundColor,
    padding: `${padding}px`,
    borderRadius,
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...(fillHeight ? { height: '100%' } : {}),
    width: '100%',
  };

  return (
    <div style={containerStyle} className="simple-image">
      {url ? (
        <img
          src={url}
          alt={alt}
          style={{
            maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
            width: '100%',
            ...(fillHeight ? { height: '100%' } : {}),
            ...(maxHeight ? { maxHeight: `${maxHeight}px` } : {}),
            objectFit,
            borderRadius,
            ...getMediaDisplayStyle(image),
          }}
        />
      ) : (
        <div
          style={{
            width: typeof maxWidth === 'number' ? maxWidth : 200,
            height: maxHeight || 100,
            background: '#f3f4f6',
            borderRadius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: scaledFontSize(14),
          }}
        >
          Upload an image
        </div>
      )}
    </div>
  );
}

export const ImageBlockConfig = {
  label: 'Simple Image',
  fields: {
    image: createMediaField({
      label: 'Image',
      aspectRatio: '16:9',
      fieldName: 'simpleImage',
    }),
    alt: { type: 'text', label: 'Alt Text' },
    maxWidth: { type: 'text', label: 'Max Width (px or %)' },
    maxHeight: { type: 'number', label: 'Max Height (px)', min: 0 },
    objectFit: {
      type: 'select',
      label: 'Object Fit',
      options: [
        { label: 'Contain', value: 'contain' },
        { label: 'Cover', value: 'cover' },
        { label: 'Fill', value: 'fill' },
        { label: 'None', value: 'none' },
      ],
    },
    alignment: {
      type: 'select',
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    backgroundColor: { type: 'text', label: 'Background Color' },
    padding: { type: 'number', label: 'Padding (px)', min: 0, max: 100 },
    borderRadius: { type: 'number', label: 'Border Radius (px)', min: 0, max: 50 },
  },
  defaultProps: {
    image: { url: '', prompt: '', mediaType: 'image' },
    alt: 'Image',
    maxWidth: '100%',
    maxHeight: undefined,
    objectFit: 'contain',
    alignment: 'center',
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 0,
  },
};

export default ImageBlock;
