
import { useMemo } from 'react';

interface CountUpProps {

  end: number;

  start?: number;

  duration?: number;

  className?: string;

  prefix?: string;

  suffix?: string;

  decimals?: number;

  delay?: number;
}

function formatCountValue(value: number | null | undefined, decimals: number): string {
  return (value ?? 0).toFixed(decimals);
}

export function CountUp({
  end = 0,
  start: _start,
  duration: _duration,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
  delay: _delay,
}: CountUpProps) {
  const formattedValue = useMemo(() => formatCountValue(end, decimals), [end, decimals]);

  return (
    <span className={className} data-autonnel-animation="count-up">
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

export default CountUp;
