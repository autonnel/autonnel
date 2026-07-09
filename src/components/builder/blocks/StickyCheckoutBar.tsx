import React from 'react';
import {
  getMediaDisplayStyle,
  createMediaField,
  type MediaFieldValue,
} from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';
import { createColorField } from '../ColorField';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';

export interface StickyCheckoutBarProps {
  id?: string;
  logoImage?: string | MediaFieldValue;
  tagline?: string | TextFieldValue;
  ctaText?: string | TextFieldValue;
  ctaUrl?: string | URLFieldValue;
  backgroundColor?: string;
  ctaColor?: string;
  hideAfterScrollPercent?: number;
}

const composeBarId = (rawId: string | undefined): string =>
  `floating-order-bar-${rawId || 'default'}`;

const resolveLogoSrc = (source: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (typeof source === 'string') return source;
  if (!source) return '';
  if (source.url) return source.url;
  return placeholderUrl(source.prompt, puck);
};

const buildShellStyle = (tint: string): React.CSSProperties => {
  const shell: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    padding: '12px 24px',
    background: tint,
    transform: 'translateY(0)',
    transition: 'transform 0.3s ease',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
  };
  return shell;
};

const buildAutoHideSnippet = (domId: string, rawPercent: number): string | null => {
  const ratio = Math.min(Math.max(rawPercent, 0), 100) / 100;
  if (!(ratio > 0 && ratio < 1)) return null;
  const lines = [
    `(function(){`,
    `var bar=document.getElementById("${domId}");`,
    `if(!bar)return;`,
    `var t=${ratio};`,
    `function check(){`,
    `var viewportEnd=(window.scrollY||window.pageYOffset||0)+window.innerHeight;`,
    `var pageSpan=document.documentElement.scrollHeight||document.body.scrollHeight||1;`,
    `var hide=viewportEnd/pageSpan>=t;`,
    `bar.style.transform=hide?'translateY(110%)':'translateY(0)';`,
    `bar.style.pointerEvents=hide?'none':'auto';`,
    `}`,
    `window.addEventListener('scroll',check,{passive:true});`,
    `window.addEventListener('resize',check);`,
    `check();`,
    `})();`,
  ];
  return lines.join('');
};

export function StickyCheckoutBar({
  id,
  logoImage,
  tagline = 'Stop Snoring & Sleep Better Than Ever',
  ctaText = 'ORDER NOW',
  ctaUrl = '#',
  backgroundColor = '#e8f4fc',
  ctaColor = '#22c55e',
  hideAfterScrollPercent = 0,
  puck,
}: StickyCheckoutBarProps & PuckRenderExtras) {
  const domId = composeBarId(id);
  const logoSrc = resolveLogoSrc(logoImage, puck);
  const autoHideSnippet = buildAutoHideSnippet(domId, hideAfterScrollPercent);
  const taglineVisible = hasText(tagline);
  const ctaVisible = hasText(ctaText);

  return (
    <div id={domId} style={buildShellStyle(backgroundColor)}>
      {autoHideSnippet !== null && (
        <script dangerouslySetInnerHTML={{ __html: autoHideSnippet }} />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Logo"
              style={{
                width: 50,
                height: 50,
                flexShrink: 0,
                borderRadius: '50%',
                objectFit: 'contain',
                ...getMediaDisplayStyle(logoImage),
              }}
            />
          ) : (
            <div
              style={{
                width: 50,
                height: 50,
                flexShrink: 0,
                borderRadius: '50%',
                background: '#1e3a5f',
                color: 'white',
                fontSize: scaledFontSize(10),
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              LOGO
            </div>
          )}
          {taglineVisible && (
            <span
              className="lp-hide-mobile"
              style={{
                ...getTextStyle(tagline, { color: '#1e293b', fontSize: 16 }),
                fontWeight: 500,
              }}
            >
              {getTextContent(tagline)}
            </span>
          )}
        </div>
        {ctaVisible && (
          <a
            href={getURLString(ctaUrl) || '#'}
            className="lp-floating-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '14px 32px',
              borderRadius: 8,
              background: ctaColor,
              ...getTextStyle(ctaText, { color: 'white', fontSize: 16 }),
              fontWeight: 'bold',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              boxShadow: `0 4px 16px ${ctaColor}66`,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            {getTextContent(ctaText)}
          </a>
        )}
      </div>
    </div>
  );
}

export const StickyCheckoutBarConfig = {
  fields: {
    logoImage: createMediaField({
      label: 'Logo Image (50x50)',
      aspectRatio: '1:1',
      fieldName: 'floatingBarLogo',
    }),
    tagline: createTextField({ label: 'Tagline', defaultColor: '#1e293b', defaultFontSize: 16 }),
    ctaText: createTextField({ label: 'Button Text', defaultColor: 'white', defaultFontSize: 16 }),
    ctaUrl: createURLField({ label: 'Button URL', placeholder: 'Enter URL or select funnel step' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    ctaColor: createColorField({ label: 'Button Color' }),
    hideAfterScrollPercent: {
      type: 'number' as const,
      label: 'Hide After Scroll % (0 = always visible)',
      min: 0,
      max: 100,
    },
  },
  defaultProps: {
    logoImage: { url: '', prompt: '', mediaType: 'image' as const },
    tagline: { text: 'Stop Snoring & Sleep Better Than Ever', color: '#1e293b', fontSize: 16 },
    ctaText: { text: 'ORDER NOW', color: 'white', fontSize: 16 },
    ctaUrl: { type: 'custom' as const, url: '#' },
    backgroundColor: '#e8f4fc',
    ctaColor: '#22c55e',
    hideAfterScrollPercent: 0,
  },
};
