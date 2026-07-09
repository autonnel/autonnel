import React, { type ReactNode } from 'react';
import { RichBody } from './RichBody';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import {
  type TextFieldValue,
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
} from '../TextField';
import { createColorField } from '../ColorField';

interface FAQ {
  question: string | TextFieldValue;
  answer: string | ReactNode;
}

interface FaqAccordionProps {
  title?: string | TextFieldValue;
  faqs?: FAQ[];
  backgroundColor?: string;
}

const INK = '#1a1a1a';
const MUTED = '#64748b';
const SIGN = '#94a3b8';

const wrapStyle: React.CSSProperties = { maxWidth: '700px', margin: '0 auto' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };

const headingStyle = {
  fontWeight: 'bold' as const,
  textAlign: 'center' as const,
  marginBottom: '48px',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  cursor: 'pointer',
};

const triggerStyle = {
  fontWeight: 'bold' as const,
  listStyle: 'none' as const,
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
};

const bodyStyle: React.CSSProperties = { marginTop: '16px', color: MUTED, lineHeight: 1.8 };

function Heading({ value }: { value?: string | TextFieldValue }) {
  if (!hasText(value)) return null;
  const merged = { ...getTextStyle(value, { color: INK, fontSize: 32 }), ...headingStyle };
  return (
    <h2 className="lp-large-title" style={merged}>
      {getTextContent(value)}
    </h2>
  );
}

function Row({ entry }: { entry: FAQ }) {
  const promptStyle = { ...getTextStyle(entry.question, { color: INK, fontSize: 18 }), ...triggerStyle };
  return (
    <details style={cardStyle}>
      <summary style={promptStyle}>
        {getTextContent(entry.question)}
        <span style={{ fontSize: scaledFontSize(20), color: SIGN }}>+</span>
      </summary>
      <RichBody value={entry.answer} style={bodyStyle} />
    </details>
  );
}

export function FaqAccordion(props: FaqAccordionProps) {
  const { title } = props;
  const items = props.faqs ?? [];
  const bg = props.backgroundColor ?? '#ffffff';
  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="FAQ">
      <div className="lp-section-padding" style={{ background: bg }}>
        <div style={wrapStyle}>
          <Heading value={title} />
          <div style={listStyle}>
            {items.map((entry, idx) => (
              <Row key={idx} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </SectionOverlay>
  );
}

function summarize(item?: FAQ): string {
  const q = item?.question;
  if (typeof q === 'string') return q || 'FAQ';
  return q?.text || 'FAQ';
}

export const FaqAccordionConfig = {
  fields: {
    title: createTextField({ label: 'Title', defaultColor: '#1a1a1a', defaultFontSize: 32 }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    faqs: {
      type: 'array',
      arrayFields: {
        question: createTextField({ label: 'Question', defaultColor: '#1a1a1a', defaultFontSize: 18 }),
        answer: { type: 'richtext', label: 'Answer', contentEditable: true },
      },
      getItemSummary: summarize,
    },
  },
  defaultProps: {
    title: { text: 'Frequently Asked Questions', color: '#1a1a1a', fontSize: 32 },
    backgroundColor: '#ffffff',
    faqs: [],
  },
};
