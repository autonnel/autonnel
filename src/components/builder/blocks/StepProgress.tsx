import React from 'react';
import { createMediaField, type MediaFieldValue } from '../MediaField';
import { createColorField } from '../ColorField';

type StepStatus = 'completed' | 'current' | 'upcoming';

interface Step {
  label: string;
  status?: StepStatus | '';
}

export interface StepProgressProps {
  steps?: Step[];
  currentStep: number;
  orientation: 'horizontal' | 'vertical';
  stepStyle: 'numbered' | 'dot' | 'icon';
  connectorStyle: 'solid' | 'dashed';
  accentColor: string;
  inactiveColor: string;
  stepIcon?: MediaFieldValue;
}

const computeStatus = (idx: number, currentStep: number, override?: StepStatus | ''): StepStatus => {
  if (override) return override;
  if (idx < currentStep) return 'completed';
  if (idx === currentStep) return 'current';
  return 'upcoming';
};

export function StepProgress({
  steps = [],
  currentStep = 1,
  orientation = 'horizontal',
  stepStyle = 'numbered',
  connectorStyle = 'solid',
  accentColor = '#14532d',
  inactiveColor = '#d1d5db',
  stepIcon,
}: StepProgressProps) {
  const isHorizontal = orientation === 'horizontal';
  return (
    <section style={{ padding: '24px 16px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {steps.map((step, idx) => {
          const status = computeStatus(idx, currentStep, step.status);
          const color = status === 'upcoming' ? inactiveColor : accentColor;
          const isLast = idx === steps.length - 1;
          return (
            <React.Fragment key={idx}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 80,
                }}
              >
                <div style={{ fontSize: 12, color, marginBottom: 4 }}>{step.label}</div>
                <div
                  style={{
                    width: stepStyle === 'dot' ? 12 : 28,
                    height: stepStyle === 'dot' ? 12 : 28,
                    borderRadius: '50%',
                    backgroundColor: status === 'completed' ? color : '#ffffff',
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: status === 'completed' ? '#ffffff' : color,
                    fontWeight: 700,
                  }}
                >
                  {stepStyle === 'numbered' && idx + 1}
                  {stepStyle === 'icon' && stepIcon && (
                    <div style={{ width: 16, height: 16, backgroundImage: `url(${stepIcon.url})`, backgroundSize: 'cover' }} />
                  )}
                </div>
              </div>
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: isHorizontal ? 2 : 32,
                    width: isHorizontal ? undefined : 2,
                    borderTop: isHorizontal ? `2px ${connectorStyle} ${inactiveColor}` : undefined,
                    borderLeft: !isHorizontal ? `2px ${connectorStyle} ${inactiveColor}` : undefined,
                    margin: isHorizontal ? '0 8px' : '0',
                    minWidth: isHorizontal ? 32 : undefined,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

export const StepProgressConfig = {
  fields: {
    steps: {
      type: 'array' as const,
      label: 'Steps',
      arrayFields: {
        label: { type: 'text' as const, label: 'Label', contentEditable: true },
        status: {
          type: 'select' as const,
          label: 'Status (override, optional)',
          options: [
            { label: '(auto from currentStep)', value: '' },
            { label: 'Completed', value: 'completed' },
            { label: 'Current', value: 'current' },
            { label: 'Upcoming', value: 'upcoming' },
          ],
        },
      },
    },
    currentStep: { type: 'number' as const, label: 'Current Step (0-indexed)', min: 0, max: 20 },
    orientation: {
      type: 'radio' as const,
      label: 'Orientation',
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical', value: 'vertical' },
      ],
    },
    stepStyle: {
      type: 'radio' as const,
      label: 'Step Style',
      options: [
        { label: 'Numbered', value: 'numbered' },
        { label: 'Dot', value: 'dot' },
        { label: 'Icon', value: 'icon' },
      ],
    },
    connectorStyle: {
      type: 'radio' as const,
      label: 'Connector Style',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Dashed', value: 'dashed' },
      ],
    },
    accentColor: createColorField({ label: 'Accent Color' }),
    inactiveColor: createColorField({ label: 'Inactive Color' }),
    stepIcon: createMediaField({ label: 'Step Icon (icon style)', aspectRatio: '1:1', fieldName: 'stepIcon' }),
  },
  defaultProps: {
    currentStep: 1,
    orientation: 'horizontal',
    stepStyle: 'numbered',
    connectorStyle: 'solid',
    accentColor: '#14532d',
    inactiveColor: '#d1d5db',
    steps: [
      { label: 'Order Submitted' },
      { label: 'Special Offer' },
      { label: 'Order Receipt' },
    ],
  },
};

export default StepProgress;
