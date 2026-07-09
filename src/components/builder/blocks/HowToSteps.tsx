import React from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createMediaField, type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle, hasText, scaledFontSize } from '../TextField';
import { RichBody } from './RichBody';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';

interface Step {
  title: string;
  description: string | ReactNode;
  image?: string | MediaFieldValue;
}

interface HowToStepsProps {
  sectionTitle: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  steps?: Step[];
  backgroundColor?: string;
  showStepNumbers?: boolean;
  accentColor?: string;
}

// Pick a column count that never strands a single card on the last row.
function pickColumns(count: number): number {
  if (count <= 4) return Math.max(count, 1);
  if (count % 3 === 0) return 3;
  if (count % 4 === 0) return 4;
  return count % 3 >= 2 ? 3 : 4;
}

const resolveMediaSrc = (media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (!media) return '';
  if (typeof media === 'string') return media;
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
};

const shellStyle = (background: string): CSSProperties => ({ background });
const innerStyle: CSSProperties = { maxWidth: '1100px', margin: '0 auto' };
const headerStyle: CSSProperties = { textAlign: 'center', marginBottom: '60px' };
const subtitleExtra: CSSProperties = { maxWidth: '600px', margin: '0 auto' };
const cellStyle: CSSProperties = { textAlign: 'center' };

const figureStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '800/533',
  borderRadius: '16px',
  marginBottom: '24px',
  overflow: 'hidden',
  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
};

const badgeStyle = (accentColor?: string): CSSProperties => ({
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  background: accentColor || 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  color: 'white',
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: scaledFontSize(20),
  fontWeight: 'bold',
  boxShadow: accentColor ? '0 4px 14px rgba(0, 0, 0, 0.18)' : '0 4px 16px rgba(79, 70, 229, 0.3)',
});

const stepTitleStyle: CSSProperties = {
  fontSize: scaledFontSize(20),
  fontWeight: 'bold',
  marginBottom: '12px',
  color: '#1a1a1a',
};

const stepBodyStyle: CSSProperties = {
  color: '#64748b',
  lineHeight: 1.6,
  fontSize: scaledFontSize(15),
};

function StepCard({ step, index, numbered, accentColor, puck }: { step: Step; index: number; numbered: boolean; accentColor?: string; puck?: { isEditing?: boolean } }) {
  const src = resolveMediaSrc(step.image, puck);
  return (
    <div style={cellStyle}>
      {src && (
        <div style={figureStyle}>
          <img
            src={src}
            alt="Step image"
            style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(step.image) }}
          />
        </div>
      )}
      {numbered && <div style={badgeStyle(accentColor)}>{index + 1}</div>}
      <h3 style={stepTitleStyle}>{step.title}</h3>
      <RichBody value={step.description} style={stepBodyStyle} />
    </div>
  );
}

export function HowToSteps({
  sectionTitle,
  subtitle,
  steps = [],
  backgroundColor = '#ffffff',
  showStepNumbers = true,
  accentColor,
  puck,
}: HowToStepsProps & PuckRenderExtras) {
  const titleStyle = getTextStyle(sectionTitle, { color: '#1a1a1a', fontSize: 36 });
  const subText = getTextContent(subtitle);
  const subStyle = getTextStyle(subtitle, { color: '#64748b', fontSize: 18 });
  const columns = pickColumns(steps.length);

  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Usage Steps">
      <div className="lp-section-padding" style={shellStyle(backgroundColor)}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            {hasText(sectionTitle) && (
              <h2
                className="lp-section-title"
                style={{ ...titleStyle, fontWeight: 'bold', marginBottom: subText ? '16px' : '0' }}
              >
                {getTextContent(sectionTitle)}
              </h2>
            )}
            {subText && <p style={{ ...subStyle, ...subtitleExtra }}>{subText}</p>}
          </div>

          {steps.length > 0 && (
            <div
              className="lp-grid-auto-cols"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, rowGap: '48px' }}
            >
              {steps.map((step, i) => (
                <StepCard key={i} step={step} index={i} numbered={showStepNumbers} accentColor={accentColor} puck={puck} />
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionOverlay>
  );
}

export const HowToStepsConfig = {
  fields: {
    sectionTitle: createTextField({ label: 'Section Title', defaultColor: '#1a1a1a', defaultFontSize: 36 }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    accentColor: createColorField({ label: 'Step Number Color (empty = purple gradient)' }),
    subtitle: createTextField({ label: 'Subtitle', defaultColor: '#64748b', defaultFontSize: 18 }),
    showStepNumbers: {
      type: 'radio' as const,
      label: 'Show Step Numbers',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    steps: {
      type: 'array' as const,
      label: 'Steps',
      arrayFields: {
        title: { type: 'text' as const, label: 'Step Title', contentEditable: true },
        description: { type: 'richtext' as const, label: 'Step Description', contentEditable: true },
        image: createMediaField({ label: 'Step Image (800x533)', aspectRatio: '3:2', fieldName: 'stepImage' }),
      },
      getItemSummary: (item: any) => item?.title || 'Step',
    },
  },
  defaultProps: {
    sectionTitle: { text: 'How to Use', color: '#1a1a1a', fontSize: 36 },
    backgroundColor: '#ffffff',
    accentColor: '',
    subtitle: { text: 'Simple steps for best results', color: '#64748b', fontSize: 18 },
    showStepNumbers: true,
    steps: [],
  },
};
