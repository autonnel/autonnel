import React from 'react';
import type { ReactNode } from 'react';
import { RichBody } from './RichBody';
import type { ComponentConfig } from '@puckeditor/core';
import { createColorField } from '../ColorField';
import { scaledFontSize } from '../TextField';

type BenefitItem = { text: string | ReactNode; isHighlighted?: boolean };

export interface BenefitListProps {
  benefits?: BenefitItem[];
  checkColor?: string;
  textColor?: string;
  highlightColor?: string;
  backgroundColor?: string;
  padding?: number;
  mobileOrder?: number;
}

const SEED_ITEMS: BenefitItem[] = [
  { text: 'Uniquely Formulated To Help Restore Hearing, Strengthen Brain Function And Improve Memory.', isHighlighted: false },
  { text: 'FDA Certification , Beneficial For Anyone Of Any Age.', isHighlighted: false },
  { text: 'BEWARE Of Others Who Sell Cheap Imitations. Please Buy From Our Store!', isHighlighted: false },
  { text: '30-Day No-Hassle Money Back Guarantee & 24/7 Customer Service FOR YOU.', isHighlighted: true },
];

const PALETTE = {
  check: '#22c55e',
  text: '#374151',
  highlight: 'rgb(0, 159, 0)',
  surface: '#ffffff',
} as const;

const ROOT_CLASS = 'old-benefits-list';
const BODY_CLASS = 'benefits-text';
const TICK_PATH = 'M20.0616 0.5L8.86518 11.6534L3.93839 6.74456L0 10.6688L8.86518 19.5L24 4.42328L20.0616 0.5Z';

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
};

const tickStyle: React.CSSProperties = { minWidth: 24, flexShrink: 0 };

function buildCss(order?: number): string {
  const base = `.${ROOT_CLASS} .${BODY_CLASS} p {\n          margin: 0;\n        }`;
  if (order === undefined) return base;
  return `${base}\n        @media (max-width: 768px) {\n          .${ROOT_CLASS}-order-${order} {\n            order: ${order};\n          }\n        }`;
}

export function BenefitList(props: BenefitListProps) {
  const {
    benefits = SEED_ITEMS,
    checkColor = PALETTE.check,
    textColor = PALETTE.text,
    highlightColor = PALETTE.highlight,
    backgroundColor = PALETTE.surface,
    padding = 24,
    mobileOrder,
  } = props;

  const hasOrder = mobileOrder !== undefined;
  const orderClass = hasOrder ? `${ROOT_CLASS}-order-${mobileOrder}` : '';
  const wrapperClass = [ROOT_CLASS, orderClass].filter(Boolean).join(' ');

  const renderRow = (item: BenefitItem, idx: number) => {
    const fill = item.isHighlighted ? highlightColor : textColor;
    return (
      <li key={idx} style={rowStyle}>
        <svg
          width="24"
          height="20"
          viewBox="0 0 24 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={tickStyle}
        >
          <path d={TICK_PATH} fill={checkColor} />
        </svg>
        <RichBody
          className={BODY_CLASS}
          value={item.text}
          style={{ fontSize: scaledFontSize(14), lineHeight: 1.5, color: fill }}
        />
      </li>
    );
  };

  return (
    <div className={wrapperClass} style={{ background: backgroundColor, padding }}>
      <style>{`
        ${buildCss(mobileOrder)}
      `}</style>
      <ul style={listStyle}>{benefits.map(renderRow)}</ul>
    </div>
  );
}

function summarize(item: any): string {
  return typeof item?.text === 'string' ? item.text.substring(0, 40) + '...' : 'Benefit';
}

export const BenefitListConfig: ComponentConfig<BenefitListProps> = {
  label: 'Old Benefits List',
  fields: {
    benefits: {
      type: 'array',
      label: 'Benefits',
      arrayFields: {
        text: { type: 'richtext' as const, label: 'Benefit Text', contentEditable: true },
        isHighlighted: {
          type: 'radio',
          label: 'Highlighted',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      getItemSummary: summarize,
    },
    checkColor: createColorField({ label: 'Check Icon Color' }),
    textColor: createColorField({ label: 'Text Color' }),
    highlightColor: createColorField({ label: 'Highlight Color' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    padding: {
      type: 'number',
      label: 'Padding',
      min: 0,
      max: 64,
    },
    mobileOrder: {
      type: 'number',
      label: 'Mobile Order (768px↓)',
      min: -100,
      max: 100,
    },
  },
  defaultProps: {
    benefits: SEED_ITEMS,
    checkColor: PALETTE.check,
    textColor: PALETTE.text,
    highlightColor: PALETTE.highlight,
    backgroundColor: PALETTE.surface,
    padding: 24,
  },
  render: BenefitList,
};

export default BenefitList;
