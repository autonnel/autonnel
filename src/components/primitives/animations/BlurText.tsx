

interface BlurTextProps {

  text: string;

  delay?: number;

  duration?: number;

  className?: string;

  animateWords?: boolean;

  staggerDelay?: number;
}

function renderStaticText(text: string) {
  return text;
}

export function BlurText({
  text,
  delay: _delay,
  duration: _duration,
  className = '',
  animateWords: _animateWords,
  staggerDelay: _staggerDelay,
}: BlurTextProps) {
  return (
    <span className={className} data-autonnel-animation="blur-text">
      {renderStaticText(text)}
    </span>
  );
}

export default BlurText;
