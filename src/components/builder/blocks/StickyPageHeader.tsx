import React, { useEffect, useRef, useState } from 'react';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';
import { createColorField } from '../ColorField';
import {
  createMediaField,
  getMediaDisplayStyle,
  type MediaFieldValue,
} from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

const COLLAPSE_AT = 80;
const REVEAL_AT = 20;
const RESET_SECONDS = 900;
const DAY_BASE = 80;

interface StickyPageHeaderProps {
  countdownLabel?: string | TextFieldValue;
  hours?: number;
  minutes?: number;
  seconds?: number;
  countdownBgColor?: string;
  countdownTimerColor?: string;
  logoImage?: string | MediaFieldValue;
  logoHeight?: number;
  logoBgColor?: string;
  progressBarColor?: string;
  progressBarHeight?: number;
  fullWidth?: boolean;
}

interface ClockTime {
  hours: number;
  minutes: number;
  seconds: number;
}

const SCROLL_GETTER = `window.scrollY || document.documentElement.scrollTop`;
const PCT_EXPR = `(function(){var d=document.documentElement.scrollHeight-document.documentElement.clientHeight;return d>0?Math.min(100,Math.max(0,(p/d)*100)):0;})()`;

const STICKY_HEADER_SCRIPT = [
  '(function(){',
  "var root=document.querySelector('[data-countdown]');",
  'if(!root)return;',
  "var logoArea=root.querySelector('[data-logo-area]');",
  "var bar=root.querySelector('[data-scroll-progress]');",
  'var hidden=false;',
  'var onScroll=function(){',
  'var p=' + SCROLL_GETTER + ';',
  'if(bar){bar.style.width=' + PCT_EXPR + "+'%';}",
  'if(logoArea){',
  'var shouldHide=hidden?p>' + REVEAL_AT + ':p>' + COLLAPSE_AT + ';',
  'if(shouldHide!==hidden){',
  'hidden=shouldHide;',
  "logoArea.style.maxHeight=shouldHide?'0px':'" + DAY_BASE + "px';",
  "logoArea.style.paddingTop=shouldHide?'0px':'8px';",
  "logoArea.style.paddingBottom=shouldHide?'0px':'8px';",
  "logoArea.style.opacity=shouldHide?'0':'1';",
  '}}',
  '};',
  "window.addEventListener('scroll',onScroll,{passive:true});",
  'onScroll();',
  "var timerEl=root.querySelector('[data-countdown-value]');",
  'if(!timerEl)return;',
  "var cells=timerEl.querySelectorAll('.lp-timer-digit');",
  'if(cells.length<4)return;',
  "var acc=parseInt(root.getAttribute('data-hours')||'0',10)*3600",
  "+parseInt(root.getAttribute('data-minutes')||'0',10)*60",
  "+parseInt(root.getAttribute('data-seconds')||'0',10);",
  "var fmt=function(v){return v<10?'0'+v:''+v;};",
  'setInterval(function(){',
  'if(acc<=0)acc=' + RESET_SECONDS + ';',
  'acc--;',
  'var totalH=Math.floor(acc/3600);',
  'cells[0].textContent=fmt(Math.floor(totalH/24));',
  'cells[1].textContent=fmt(totalH%24);',
  'cells[2].textContent=fmt(Math.floor((acc%3600)/60));',
  'cells[3].textContent=fmt(acc%60);',
  '},1000);',
  '})();',
].join('\n');

const two = (n: number): string => String(n).padStart(2, '0');

const splitDays = (t: ClockTime) => ({
  days: Math.floor(t.hours / 24),
  displayHours: t.hours % 24,
});

const resolveLogoSrc = (m: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (!m) return '';
  if (typeof m === 'string') return m;
  if (m.url) return m.url;
  return placeholderUrl(m.prompt, puck);
};

function useCountdownClock(initial: ClockTime): ClockTime {
  const [time, setTime] = useState<ClockTime>(initial);

  useEffect(() => {
    const tick = () =>
      setTime((prev) => {
        const remaining = prev.hours * 3600 + prev.minutes * 60 + prev.seconds;
        if (remaining <= 0) return { hours: 0, minutes: 15, seconds: 0 };
        const after = remaining - 1;
        return {
          hours: Math.floor(after / 3600),
          minutes: Math.floor((after % 3600) / 60),
          seconds: after % 60,
        };
      });
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

function useStickyScrollState(): { scrollProgress: number; logoHidden: boolean } {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [logoHidden, setLogoHidden] = useState(false);
  const collapsedRef = useRef(false);

  useEffect(() => {
    const measure = () => {
      const offset = window.scrollY || document.documentElement.scrollTop;
      const span =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress(span > 0 ? Math.min(100, Math.max(0, (offset / span) * 100)) : 0);

      const want = collapsedRef.current ? offset > REVEAL_AT : offset > COLLAPSE_AT;
      if (want !== collapsedRef.current) {
        collapsedRef.current = want;
        setLogoHidden(want);
      }
    };

    window.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => window.removeEventListener('scroll', measure);
  }, []);

  return { scrollProgress, logoHidden };
}

const breakoutStyle = (fullWidth: boolean): React.CSSProperties =>
  fullWidth
    ? { width: '100vw', marginLeft: 'calc(-50vw + 50%)' }
    : { width: '100%' };

const shellStyle = (fullWidth: boolean): React.CSSProperties => ({
  position: 'sticky',
  top: 0,
  zIndex: 100,
  ...breakoutStyle(fullWidth),
});

const colonStyle = (color: string): React.CSSProperties => ({
  color,
  fontWeight: 700,
  fontSize: scaledFontSize(14),
  alignSelf: 'flex-start',
  marginTop: 5,
});

const collapseTransition = 'max-height 0.3s ease, padding 0.3s ease, opacity 0.2s ease';

const logoBandStyle = (bgColor: string, hidden: boolean): React.CSSProperties => {
  const vertPad = hidden ? '0px' : '8px';
  return {
    background: bgColor,
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: hidden ? '0px' : '80px',
    paddingTop: vertPad,
    paddingBottom: vertPad,
    opacity: hidden ? 0 : 1,
    overflow: 'hidden',
    transition: collapseTransition,
  };
};

const trackWrapStyle = (bgColor: string): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'center',
  padding: '6px 16px 10px',
  background: bgColor,
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
});

const innerClass = (fullWidth: boolean) =>
  fullWidth ? 'puck-full-width-inner' : undefined;

function TimerUnit({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  const cellStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.25)',
    color,
    padding: '4px 8px',
    borderRadius: 3,
    fontSize: scaledFontSize(15),
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 34,
    textAlign: 'center',
    display: 'inline-block',
    lineHeight: 1.3,
  };
  const captionStyle: React.CSSProperties = {
    color,
    fontSize: scaledFontSize(8),
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.85,
  };
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
    >
      <span className="lp-timer-digit" style={cellStyle}>
        {value}
      </span>
      <span style={captionStyle}>{label}</span>
    </div>
  );
}

export function StickyPageHeader(props: StickyPageHeaderProps & PuckRenderExtras) {
  const {
    countdownLabel,
    hours = 0,
    minutes = 15,
    seconds = 0,
    countdownBgColor = '#6b1520',
    countdownTimerColor = '#ffffff',
    logoImage,
    logoHeight = 48,
    logoBgColor = '#ffffff',
    progressBarColor = '#1a5c3a',
    progressBarHeight = 3,
    fullWidth = false,
  } = props;

  const time = useCountdownClock({ hours, minutes, seconds });
  const { scrollProgress, logoHidden } = useStickyScrollState();

  const { days, displayHours } = splitDays(time);
  const logoUrl = resolveLogoSrc(logoImage, props.puck);
  const colon = colonStyle(countdownTimerColor);
  const wrapClass = innerClass(fullWidth);

  const labelNode = hasText(countdownLabel) ? (
    <span
      style={{
        ...getTextStyle(countdownLabel, { color: '#ffffff', fontSize: 12 }),
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {'\u{1F525} '}
      {getTextContent(countdownLabel)}
    </span>
  ) : null;

  const timerRow = (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}
      data-countdown-value="timer"
    >
      <TimerUnit value={two(days)} label="DAYS" color={countdownTimerColor} />
      <span style={colon}>:</span>
      <TimerUnit value={two(displayHours)} label="HRS" color={countdownTimerColor} />
      <span style={colon}>:</span>
      <TimerUnit value={two(time.minutes)} label="MIN" color={countdownTimerColor} />
      <span style={colon}>:</span>
      <TimerUnit value={two(time.seconds)} label="SEC" color={countdownTimerColor} />
    </div>
  );

  const logoNode = logoUrl ? (
    <img
      src={logoUrl}
      alt="Logo"
      style={{
        height: logoHeight,
        maxWidth: 200,
        objectFit: 'contain',
        ...getMediaDisplayStyle(logoImage),
      }}
    />
  ) : null;

  return (
    <div
      style={shellStyle(fullWidth)}
      data-countdown="true"
      data-hours={hours}
      data-minutes={minutes}
      data-seconds={seconds}
    >
      <div
        style={{
          background: countdownBgColor,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className={wrapClass}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {labelNode}
          {timerRow}
        </div>
      </div>

      <div data-logo-area="true" style={logoBandStyle(logoBgColor, logoHidden)}>
        <div
          className={wrapClass}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {logoNode}
        </div>
      </div>

      <div style={trackWrapStyle(logoBgColor)}>
        <div
          className={wrapClass}
          style={{
            background: `${progressBarColor}20`,
            borderRadius: 6,
            padding: '5px 8px',
            width: '100%',
          }}
        >
          <div
            style={{
              height: progressBarHeight,
              background: '#e5e7eb',
              width: '100%',
              borderRadius: progressBarHeight,
              overflow: 'hidden',
            }}
          >
            <div
              data-scroll-progress="true"
              style={{
                height: '100%',
                background: progressBarColor,
                width: `${scrollProgress}%`,
                transition: 'width 0.15s ease-out',
                borderRadius: progressBarHeight,
              }}
            />
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: STICKY_HEADER_SCRIPT }} />
    </div>
  );
}

export const StickyPageHeaderConfig = {
  fields: {
    countdownLabel: createTextField({ label: 'Countdown Label' }),
    hours: { type: 'number', label: 'Starting Hours', min: 0 },
    minutes: { type: 'number', label: 'Starting Minutes', min: 0, max: 59 },
    seconds: { type: 'number', label: 'Starting Seconds', min: 0, max: 59 },
    countdownBgColor: createColorField({ label: 'Countdown Background' }),
    countdownTimerColor: createColorField({ label: 'Timer Color' }),
    logoImage: createMediaField({ label: 'Logo', aspectRatio: '16:4', fieldName: 'logoImage' }),
    logoHeight: { type: 'number', label: 'Logo Height (px)', min: 20, max: 120 },
    logoBgColor: createColorField({ label: 'Logo Background' }),
    progressBarColor: createColorField({ label: 'Progress Bar Color' }),
    progressBarHeight: { type: 'number', label: 'Progress Bar Height (px)', min: 1, max: 8 },
    fullWidth: {
      type: 'radio',
      label: 'Full Width (break out of container)',
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
    },
  },
  defaultProps: {
    countdownLabel: { text: 'HURRY! OFFER EXPIRES IN', color: '#ffffff', fontSize: 12 },
    hours: 0,
    minutes: 15,
    seconds: 0,
    countdownBgColor: '#6b1520',
    countdownTimerColor: '#ffffff',
    logoImage: { url: '', prompt: '', mediaType: 'image' },
    logoHeight: 48,
    logoBgColor: '#ffffff',
    progressBarColor: '#1a5c3a',
    progressBarHeight: 3,
    fullWidth: false,
  },
} as const;
