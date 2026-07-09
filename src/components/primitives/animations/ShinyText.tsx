

interface ShinyTextProps {

  text: string;

  className?: string;

  shineColor?: string;

  duration?: number;

  repeatDelay?: number;
}

function staticShineLabel(text: string): string {
  return text;
}

export function ShinyText({
  text,
  className = '',
  shineColor: _shineColor,
  duration: _duration,
  repeatDelay: _repeatDelay,
}: ShinyTextProps) {
  return (
    <span className={className} data-autonnel-animation="shiny-text">
      {staticShineLabel(text)}
    </span>
  );
}

export default ShinyText;
