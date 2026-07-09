import React from 'react';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  type TextFieldValue,
} from '../TextField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';
import { createColorField } from '../ColorField';

const defaultAnnouncementText = 'Free Shipping on Orders Over $50';

export interface NoticeBarProps {
  id?: string;
  text?: string | TextFieldValue;
  link?: string | URLFieldValue;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
  fullWidth?: boolean;
}

function AnnouncementContent({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} suppressHydrationWarning style={{ textDecoration: 'none', color: 'inherit' }}>
      {children}
    </a>
  );
}

export function NoticeBar({
  text = defaultAnnouncementText,
  link,
  backgroundColor = '#1e293b',
  textColor = '#ffffff',
  fontSize = 14,
  padding = 10,
  fullWidth = false,
}: NoticeBarProps) {
  const textContent = getTextContent(text, defaultAnnouncementText);
  const textStyle = getTextStyle(text, { color: textColor, fontSize });
  const linkUrl = getURLString(link);

  return (
    <div
      data-autonnel-puck="announcement-bar"
      style={{ backgroundColor, padding: `${padding}px 16px`, textAlign: 'center' }}
      className={'announcement-bar' + (fullWidth ? ' puck-full-width' : '')}
    >
      <div className={fullWidth ? 'puck-full-width-inner' : undefined}>
        <AnnouncementContent href={linkUrl}>
          <span style={{ ...textStyle, fontWeight: 500, letterSpacing: '0.5px' }}>
            {textContent}
          </span>
        </AnnouncementContent>
      </div>
    </div>
  );
}

export const NoticeBarConfig = {
  label: 'Announcement Bar',
  fields: {
    text: createTextField({
      label: 'Announcement Text',
      defaultColor: '#ffffff',
      defaultFontSize: 14,
    }),
    link: createURLField({ label: 'Link (optional)', placeholder: 'Enter URL' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    padding: { type: 'number', label: 'Padding (px)', min: 4, max: 24 },
    fullWidth: {
      type: 'radio',
      label: 'Full Width',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    text: { text: 'Free Shipping on Orders Over $50', color: '#ffffff', fontSize: 14 },
    link: { type: 'custom', url: '' },
    backgroundColor: '#1e293b',
    padding: 10,
    fullWidth: false,
  },
};

export default NoticeBar;
