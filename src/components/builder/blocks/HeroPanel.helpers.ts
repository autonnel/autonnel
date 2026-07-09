import type { ReactNode } from 'react';
import React from 'react';
import { placeholderUrl } from '../media-placeholder';
import type { MediaFieldValue } from '../MediaField';
import type { URLFieldValue } from '../URLField';
import { type TextFieldValue, getTextContent, getTextStyle } from '../TextField';

export interface HeroPanelProps {

  logoImage?: string | MediaFieldValue;
  logoHeight?: number;
  tagline?: string | TextFieldValue;
  headline?: string | TextFieldValue;
  subheadline: string | ReactNode;
  benefits?: (string | { value: string | TextFieldValue; icon?: string })[];
  benefitIconColor?: string;
  ctaText?: string | TextFieldValue;
  ctaLink?: string | URLFieldValue;
  ctaColor?: string;
  trustBadges?: (string | { value: string | TextFieldValue })[];
  backgroundImage?: string | MediaFieldValue;
  productImage?: string | MediaFieldValue;
  backgroundBlur?: number;
  backgroundOverlay?: number;
  fullWidth?: boolean;
  imagePosition?: 'left' | 'right' | 'top' | 'bottom' | 'background';
  contentAlign?: 'left' | 'center' | 'right';
  overlayColor?: string;
  padding?: number;
  maxWidth?: number;
}

export const getItemTextContent = (item: string | { value: string | TextFieldValue } | any): React.ReactNode => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'value' in item) {
    return getTextContent(item.value);
  }
  return '';
};


export const getItemTextStyle = (
  item: string | { value: string | TextFieldValue } | any,
  defaults?: { color?: string; fontSize?: number },
): React.CSSProperties => {
  if (typeof item === 'string') return getTextStyle(item, defaults);
  if (item && typeof item === 'object' && 'value' in item) {
    return getTextStyle(item.value, defaults);
  }
  return getTextStyle(undefined, defaults);
};


export const getMediaUrl = (media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
};


export const isVideoUrl = (url: string): boolean => {
  return url.includes('.mp4') || url.includes('.webm');
};


export const parseColor = (value: string): { r: number; g: number; b: number; a: number } | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: 1,
    };
  }
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }
  return null;
};
