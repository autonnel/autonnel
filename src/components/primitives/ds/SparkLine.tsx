import * as React from 'react';

export interface SparkLineProps {
  points: number[];
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

const SparkLine: React.FC<SparkLineProps> = ({
  points,
  color = '#2563EB',
  height = 30,
  width = 120,
  className,
}) => {
  if (!points.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default SparkLine;
