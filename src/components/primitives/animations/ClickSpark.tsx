
import type { ReactNode } from 'react';

interface ClickSparkProps {
  children: ReactNode;
  sparkColor?: string;
  sparkCount?: number;
  sparkSize?: number;
  sparkDistance?: number;
}

const inlineSparkWrapperStyle = { display: 'inline-block' } as const;

export function ClickSpark({
  children,
  sparkColor: _sparkColor,
  sparkCount: _sparkCount,
  sparkSize: _sparkSize,
  sparkDistance: _sparkDistance,
}: ClickSparkProps) {
  return (
    <div style={inlineSparkWrapperStyle} data-autonnel-animation="click-spark">
      {children}
    </div>
  );
}

export default ClickSpark;
