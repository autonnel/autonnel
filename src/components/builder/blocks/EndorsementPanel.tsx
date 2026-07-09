import React, { type ReactNode } from 'react';

import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { RichBody } from './RichBody';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { createColorField } from '../ColorField';
import { createMediaField, type MediaFieldValue } from '../MediaField';
import {
  createTextField,
  type TextFieldValue,
  getTextContent,
  getTextStyle,
  scaledFontSize,
} from '../TextField';

type Credential = string | { value: string | TextFieldValue };

interface EndorsementPanelProps {
  sectionTitle?: string | TextFieldValue;
  expertName: string | TextFieldValue;
  expertTitle: string | TextFieldValue;
  expertImage?: string | MediaFieldValue;
  quote: string | ReactNode;
  credentials?: Credential[];
  backgroundColor?: string;
  compact?: boolean;
}

function getMediaUrl(value: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.url || placeholderUrl(value.prompt, puck);
}

function getCredentialTextValue(credential: Credential): string {
  if (typeof credential === 'string') return credential;
  if (credential && typeof credential === 'object' && 'value' in credential) {
    return String(getTextContent(credential.value));
  }
  return '';
}

function getCredentialFieldValue(
  credential: Credential,
): string | TextFieldValue | undefined {
  if (typeof credential === 'string') return credential;
  if (credential && typeof credential === 'object' && 'value' in credential) {
    return credential.value;
  }
  return undefined;
}

function VerifiedBadge() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: 4,
      }}
    >
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path
        d="M9 12L11 14L15 10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FullLayout(props: EndorsementPanelProps & PuckRenderExtras) {
  const { sectionTitle, expertName, expertTitle, expertImage, quote, credentials = [] } = props;
  const bg = props.backgroundColor || '#ffffff';
  const imageUrl = getMediaUrl(expertImage, props.puck);

  const titleText = getTextContent(sectionTitle);
  const nameText = getTextContent(expertName);
  const expertTitleText = getTextContent(expertTitle);

  const chips = credentials
    .map((c) => ({ text: getCredentialTextValue(c), field: getCredentialFieldValue(c) }))
    .filter((c) => c.text);

  return (
    <div className="lp-section-padding" style={{ background: bg }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {titleText && (
          <h3
            style={{
              ...getTextStyle(sectionTitle, { color: '#666', fontSize: 14 }),
              textAlign: 'center',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: 48,
            }}
          >
            {titleText}
          </h3>
        )}

        <div
          className="lp-grid-expert"
          style={{
            background: 'white',
            borderRadius: 20,
            padding: 40,
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="expert-image"
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: imageUrl
                ? `url(${imageUrl}) center/cover`
                : 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: scaledFontSize(80),
              border: '4px solid #dcfce7',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {!imageUrl && '👨‍⚕️'}
          </div>

          <div>
            {nameText && (
              <h3
                style={{
                  ...getTextStyle(expertName, { color: '#1a1a1a', fontSize: 24 }),
                  fontWeight: 'bold',
                  marginBottom: 4,
                }}
              >
                {nameText}
              </h3>
            )}

            {expertTitleText && (
              <p
                style={{
                  ...getTextStyle(expertTitle, { color: '#16a34a', fontSize: 15 }),
                  marginBottom: 20,
                  fontWeight: 500,
                }}
              >
                {expertTitleText}
              </p>
            )}

            <blockquote
              style={{
                fontSize: scaledFontSize(18),
                fontStyle: 'italic',
                lineHeight: 1.7,
                color: '#374151',
                borderLeft: '4px solid #16a34a',
                paddingLeft: 20,
                margin: '0 0 20px 0',
              }}
            >
              <RichBody value={quote} />
            </blockquote>

            {chips.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {chips.map((chip, i) => (
                  <span
                    key={i}
                    style={{
                      ...getTextStyle(chip.field, { color: '#166534', fontSize: 13 }),
                      background: '#dcfce7',
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontWeight: 500,
                    }}
                  >
                    {chip.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const VERIFIED_SUFFIX_RE = /\s*[•·]\s*verified\s*(buyer|author|reviewer)?/i;
const VERIFIED_PREFIX_RE = /verified\s*(buyer|author|reviewer)?\s*[•·]?\s*/i;

function CompactLayout(props: EndorsementPanelProps & PuckRenderExtras) {
  const { expertName, expertTitle, expertImage, credentials = [] } = props;
  const bg = props.backgroundColor || '#f9fafb';
  const imageUrl = getMediaUrl(expertImage, props.puck);

  const nameText = getTextContent(expertName);
  const titleText = String(getTextContent(expertTitle));
  const isVerified = titleText.toLowerCase().includes('verified');
  const displayTitle = titleText
    .replace(VERIFIED_SUFFIX_RE, '')
    .replace(VERIFIED_PREFIX_RE, '')
    .trim();

  const chips = credentials
    .map((c) => ({ text: getCredentialTextValue(c), field: getCredentialFieldValue(c) }))
    .filter((c) => c.text);

  return (
    <div style={{ padding: '16px 24px', background: bg }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: imageUrl
              ? `url(${imageUrl}) center/cover`
              : 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
            flexShrink: 0,
            border: '2px solid #e5e7eb',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          {!imageUrl && '👤'}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
            {nameText && (
              <span
                style={{
                  ...getTextStyle(expertName, { color: '#1a1a1a', fontSize: 16 }),
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {nameText}
              </span>
            )}
            {isVerified && <VerifiedBadge />}
          </div>

          {displayTitle && (
            <div
              style={{
                ...getTextStyle(expertTitle, { color: '#6b7280', fontSize: 13 }),
                lineHeight: 1.4,
              }}
            >
              {displayTitle}
            </div>
          )}

          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {chips.map((chip, i) => (
                <span
                  key={i}
                  style={{
                    ...getTextStyle(chip.field, { color: '#6b7280', fontSize: 12 }),
                    background: '#f3f4f6',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chip.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EndorsementPanel(props: EndorsementPanelProps & PuckRenderExtras) {
  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Expert Endorsement">
      {props.compact ? <CompactLayout {...props} /> : <FullLayout {...props} />}
    </SectionOverlay>
  );
}

export const EndorsementPanelConfig = {
  fields: {
    compact: {
      type: 'radio',
      label: 'Layout',
      options: [
        { label: 'Full', value: false },
        { label: 'Compact', value: true },
      ],
    },
    sectionTitle: createTextField({
      label: 'Section Title',
      defaultColor: '#666',
      defaultFontSize: 14,
    }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    expertName: createTextField({
      label: 'Expert Name',
      defaultColor: '#1a1a1a',
      defaultFontSize: 24,
    }),
    expertTitle: createTextField({
      label: 'Expert Title',
      defaultColor: '#16a34a',
      defaultFontSize: 15,
      inlineEditable: false,
    }),
    expertImage: createMediaField({
      label: 'Expert Photo (205x205)',
      aspectRatio: '1:1',
      fieldName: 'expertImage',
    }),
    quote: { type: 'richtext', label: 'Quote', contentEditable: true },
    credentials: {
      type: 'array',
      label: 'Credentials',
      arrayFields: {
        value: createTextField({
          label: 'Credential',
          defaultColor: '#166534',
          defaultFontSize: 13,
        }),
      },
      getItemSummary: (item: Credential) =>
        typeof item === 'string'
          ? item
          : item?.value
            ? String(getTextContent(item.value)) || 'Credential'
            : 'Credential',
      defaultItemProps: {
        value: { text: '', color: '#166534', fontSize: 13 },
      },
    },
  },
  defaultProps: {
    compact: false,
    sectionTitle: { text: 'Say Hello To The Experts', color: '#666', fontSize: 14 },
    backgroundColor: '#ffffff',
    expertName: { text: 'Dr. Sarah Parker, M.D.', color: '#1a1a1a', fontSize: 24 },
    expertTitle: { text: 'Board Certified Specialist', color: '#16a34a', fontSize: 15 },
    expertImage: { url: '', prompt: '', mediaType: 'image' },
    quote:
      "After years of research, I can confidently say this is one of the most effective solutions I've seen. The science behind it is solid, and the results speak for themselves.",
    credentials: [],
  },
};
