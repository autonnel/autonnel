
import { Children, type ReactNode } from 'react';

interface AnimatedListProps {
  children: ReactNode;

  delay?: number;

  staggerDelay?: number;

  className?: string;
}

function keyedStaticChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children);
}

export function AnimatedList({
  children,
  delay: _delay,
  staggerDelay: _staggerDelay,
  className = '',
}: AnimatedListProps) {
  const childrenArray = keyedStaticChildren(children);

  return (
    <div className={className} data-autonnel-animation="list">
      {childrenArray.map((child, index) => (
        <div key={index} data-autonnel-animation-item="">
          {child}
        </div>
      ))}
    </div>
  );
}

export default AnimatedList;
