import React from 'react';
import type { TextFieldValue } from './TextField';
import { getTextContent, getTextStyle, scaledFontSize } from './TextField';

const titleIconEntries = [
  ['none', ''],
  ['checkmark', '✓'],
  ['shipping', '📦'],
  ['address', '📍'],
  ['payment', '💳'],
  ['cart', '🛒'],
  ['clipboard', '📋'],
  ['lock', '🔒'],
  ['star', '⭐'],
  ['user', '👤'],
  ['gift', '🎁'],
  ['tag', '🏷️'],
] as const;

export const TITLE_ICONS = Object.fromEntries(titleIconEntries) as Record<(typeof titleIconEntries)[number][0], string>;

export type TitleIconType = keyof typeof TITLE_ICONS;

export interface SectionTitleProps {
  title: string | TextFieldValue;
  titleIcon?: TitleIconType;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  gap?: number;
  marginBottom?: number;
  as?: 'div' | 'h3' | 'h2' | 'span';
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const titleIconOptions = titleIconEntries.map(([key, icon]) => ({
  label: key === 'none' ? 'None' : `${icon} ${titleCase(key)}`,
  value: key,
}));

export const titleIconField = {
  type: 'select' as const,
  label: 'Title Icon',
  options: titleIconOptions,
};

function renderTitleIcon(icon: string, kind: TitleIconType) {
  if (!icon) return null;
  if (kind !== 'checkmark') {
    return <span style={{ flexShrink: 0, fontSize: 20, lineHeight: 1 }}>{icon}</span>;
  }

  return (
    <span
      aria-hidden
      style={{
        alignItems: 'center',
        background: '#1e3a5f',
        borderRadius: 4,
        color: '#ffffff',
        display: 'inline-flex',
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 700,
        height: 24,
        justifyContent: 'center',
        width: 24,
      }}
    >
      {icon}
    </span>
  );
}

export function SectionTitle({
  title,
  titleIcon = 'none',
  fontSize = 16,
  fontWeight = 700,
  color = '#1a1a1a',
  gap = 8,
  marginBottom = 20,
  as: Tag = 'div',
}: SectionTitleProps) {
  const text = getTextContent(title);
  if (!text) return null;

  const style = getTextStyle(title, { color, fontSize });
  const resolvedFontSize = style.fontSize || scaledFontSize(fontSize);
  const icon = TITLE_ICONS[titleIcon] || '';

  return (
    <Tag
      data-autonnel-puck="section-title"
      style={{
        alignItems: 'center',
        color: style.color || color,
        display: 'flex',
        fontSize: resolvedFontSize,
        fontWeight,
        gap,
        marginBottom,
      }}
    >
      {renderTitleIcon(icon, titleIcon)}
      <span>{text}</span>
    </Tag>
  );
}

export default SectionTitle;
