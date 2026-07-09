import React from 'react';

interface SectionOverlayProps {
  show: boolean;
  sectionName: string;
  children: React.ReactNode;
}

function hasGenerateTheme(generateConfig: unknown): boolean {
  if (typeof generateConfig === 'string') {
    return generateConfig.trim() !== '';
  }
  if (generateConfig && typeof generateConfig === 'object' && 'theme' in generateConfig) {
    const theme = (generateConfig as { theme: unknown }).theme;
    return typeof theme === 'string' && theme.trim() !== '';
  }
  return false;
}

export function shouldShowOverlay(props: { _generated?: boolean; _generate?: unknown }): boolean {
  if (props._generated === true) {
    return false;
  }
  return hasGenerateTheme(props._generate);
}

export function SectionOverlay({ show, sectionName, children }: SectionOverlayProps): JSX.Element {
  return (
    <div data-autonnel-puck="section-overlay-host" style={{ position: 'relative' }}>
      {children}
      {show && (
        <div
          aria-label={`${sectionName} is ready to generate`}
          style={{
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            background: 'rgba(15, 23, 42, 0.8)',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            inset: 0,
            justifyContent: 'center',
            position: 'absolute',
            zIndex: 10,
          }}
        >
          <div
            aria-hidden
            style={{
              alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.3), rgba(124, 58, 237, 0.3))',
              border: '2px solid rgba(129, 140, 248, 0.5)',
              borderRadius: '50%',
              display: 'flex',
              height: 56,
              justifyContent: 'center',
              width: 56,
            }}
          >
            <svg
              fill="none"
              height={24}
              stroke="rgba(165, 180, 252, 0.9)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              width={24}
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3
            style={{
              color: '#f1f5f9',
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            Ready to Generate
          </h3>
          <p style={{ color: '#a5b4fc', fontSize: 13, margin: 0 }}>
            Click to generate in right panel
          </p>
        </div>
      )}
    </div>
  );
}

export default SectionOverlay;
