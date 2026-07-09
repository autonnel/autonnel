import React, { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, getTextContent, getTextString, getTextStyle, hasText, scaledFontSize, type TextFieldValue } from '../TextField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';

interface SlideItem {
  image?: string | MediaFieldValue;
  title?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  ctaText?: string | TextFieldValue;
  ctaLink?: string | URLFieldValue;
  ctaColor?: string;
  overlayOpacity?: number;
}

export interface HeroCarouselProps {
  id?: string;
  slides?: SlideItem[];
  height?: number;
  autoplay?: boolean;
  interval?: number;
  showDots?: boolean;
  showArrows?: boolean;
}

const DEFAULT_CTA_COLOR = '#3b82f6';
const DEFAULT_HEIGHT = 500;


function mediaUrl(media: SlideItem['image'], puck?: { isEditing?: boolean }): string {
  if (!media) return '';
  return typeof media === 'string'
    ? media
    : media.url || placeholderUrl(media.prompt, puck);
}

function useSlideIndex(total: number, autoplay: boolean, interval: number) {
  const [index, setIndex] = useState(0);
  const next = useCallback(() => setIndex(value => (value + 1) % total), [total]);
  const previous = useCallback(() => setIndex(value => (value - 1 + total) % total), [total]);

  useEffect(() => {
    if (!autoplay || total < 2) return;
    const timer = window.setInterval(next, interval);
    return () => window.clearInterval(timer);
  }, [autoplay, interval, next, total]);

  return { index, setIndex, next, previous };
}

const shellStyle = (height: number): CSSProperties => ({
  position: 'relative',
  width: '100%',
  height,
  overflow: 'hidden',
  backgroundColor: '#e2e8f0',
});

const layerStyle = (active: boolean): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  opacity: active ? 1 : 0,
  transition: 'opacity 0.6s ease-in-out',
  pointerEvents: active ? 'auto' : 'none',
});

function SlideMedia({ slide, position, puck }: { slide: SlideItem; position: number; puck?: { isEditing?: boolean } }) {
  const url = mediaUrl(slide.image, puck);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={getTextString(slide.title) || `Slide ${position + 1}`}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...getMediaDisplayStyle(slide.image),
      }}
    />
  );
}

function SlideShade({ opacity = 40 }: { opacity?: number }) {
  const alpha = opacity / 100;
  if (alpha <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: `rgba(0, 0, 0, ${alpha})`,
      }}
    />
  );
}

function SlideCopy({ slide }: { slide: SlideItem }) {
  const title = getTextContent(slide.title);
  const subtitle = getTextContent(slide.subtitle);
  const cta = getTextContent(slide.ctaText);

  if (!hasText(slide.title) && !hasText(slide.subtitle) && !hasText(slide.ctaText)) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {title && (
        <h2
          style={{
            ...getTextStyle(slide.title, { color: '#ffffff', fontSize: 42 }),
            fontWeight: 700,
            marginBottom: 12,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: 800,
          }}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p
          style={{
            ...getTextStyle(slide.subtitle, { color: '#ffffff', fontSize: 18 }),
            marginBottom: 24,
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
            maxWidth: 600,
          }}
        >
          {subtitle}
        </p>
      )}
      {cta && (
        <a
          href={getURLString(slide.ctaLink) || '#'}
          suppressHydrationWarning
          style={{
            display: 'inline-block',
            backgroundColor: slide.ctaColor || DEFAULT_CTA_COLOR,
            ...getTextStyle(slide.ctaText, { color: '#ffffff', fontSize: 16 }),
            padding: '14px 36px',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {cta}
        </a>
      )}
    </div>
  );
}

function SlideLayer({ slide, active, position, puck }: { slide: SlideItem; active: boolean; position: number; puck?: { isEditing?: boolean } }) {
  return (
    <div style={layerStyle(active)}>
      <SlideMedia slide={slide} position={position} puck={puck} />
      <SlideShade opacity={slide.overlayOpacity} />
      <SlideCopy slide={slide} />
    </div>
  );
}

function SliderButton({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
}) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'previous' ? 'Previous slide' : 'Next slide'}
      style={{
        position: 'absolute',
        [direction === 'previous' ? 'left' : 'right']: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 44,
        height: 44,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.8)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1e293b',
        zIndex: 2,
      }}
    >
      <Icon size={scaledFontSize(20)} aria-hidden="true" />
    </button>
  );
}

function SliderDots({
  total,
  current,
  onSelect,
}: {
  total: number;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        zIndex: 2,
      }}
    >
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Go to slide ${index + 1}`}
          style={{
            width: index === current ? 24 : 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: index === current ? '#ffffff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

const yesNoOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export function HeroCarousel({
  slides = [],
  height = DEFAULT_HEIGHT,
  autoplay = true,
  interval = 5000,
  showDots = true,
  showArrows = true,
  puck,
}: HeroCarouselProps & PuckRenderExtras) {
  const { index, setIndex, next, previous } = useSlideIndex(slides.length, autoplay, interval);
  const hasChoices = slides.length > 1;

  return (
    <div style={shellStyle(height)} className="hero-slider">
      {slides.map((slide, position) => (
        <SlideLayer key={position} slide={slide} position={position} active={position === index} puck={puck} />
      ))}
      {showArrows && hasChoices && (
        <>
          <SliderButton direction="previous" onClick={previous} />
          <SliderButton direction="next" onClick={next} />
        </>
      )}
      {showDots && hasChoices && (
        <SliderDots total={slides.length} current={index} onSelect={setIndex} />
      )}
    </div>
  );
}

export const HeroCarouselConfig = {
  label: 'Hero Slider',
  fields: {
    slides: {
      type: 'array' as const,
      label: 'Slides',
      arrayFields: {
        image: createMediaField({ label: 'Slide Image', aspectRatio: '16:9', fieldName: 'slideImage' }),
        title: createTextField({ label: 'Title', defaultColor: '#ffffff', defaultFontSize: 42 }),
        subtitle: createTextField({ label: 'Subtitle', defaultColor: '#ffffff', defaultFontSize: 18 }),
        ctaText: createTextField({ label: 'Button Text', defaultColor: '#ffffff', defaultFontSize: 16 }),
        ctaLink: createURLField({ label: 'Button Link', placeholder: 'Enter URL' }),
        ctaColor: createColorField({ label: 'Button Color' }),
        overlayOpacity: {
          type: 'number' as const,
          label: 'Overlay Opacity (0-80%)',
          min: 0,
          max: 80,
        },
      },
      getItemSummary: (item: any) => {
        const title = item?.title;
        if (!title) return 'Slide';
        return typeof title === 'string' ? title || 'Slide' : title.text || 'Slide';
      },
      defaultItemProps: {
        image: { url: '', prompt: '', mediaType: 'image' as const },
        title: { text: '', color: '#ffffff', fontSize: 42 },
        subtitle: { text: '', color: '#ffffff', fontSize: 18 },
        ctaText: { text: 'Shop Now', color: '#ffffff', fontSize: 16 },
        ctaLink: { type: 'custom' as const, url: '' },
        ctaColor: DEFAULT_CTA_COLOR,
        overlayOpacity: 40,
      },
    },
    height: {
      type: 'number' as const,
      label: 'Height (px)',
      min: 200,
      max: 800,
    },
    autoplay: {
      type: 'radio' as const,
      label: 'Autoplay',
      options: yesNoOptions,
    },
    interval: {
      type: 'number' as const,
      label: 'Interval (ms)',
      min: 1000,
      max: 15000,
    },
    showDots: {
      type: 'radio' as const,
      label: 'Show Dots',
      options: yesNoOptions,
    },
    showArrows: {
      type: 'radio' as const,
      label: 'Show Arrows',
      options: yesNoOptions,
    },
  },
  defaultProps: {
    slides: [],
    height: DEFAULT_HEIGHT,
    autoplay: true,
    interval: 5000,
    showDots: true,
    showArrows: true,
  },
};

export default HeroCarousel;
