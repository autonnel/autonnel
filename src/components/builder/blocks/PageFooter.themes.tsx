import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { RichBody } from './RichBody';
import { type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { getURLString } from '../URLField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { getTextContent, getTextString, getTextStyle, scaledFontSize } from '../TextField';
import type { PageFooterProps } from './PageFooter';

const getMediaUrl = (media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
};

const getContrastColor = (bgColor: string): { text: string; textMuted: string; border: string } => {
  const lightTheme = { text: '#ffffff', textMuted: 'rgba(255,255,255,0.8)', border: 'rgba(255,255,255,0.1)' };
  const darkTheme = { text: '#1e293b', textMuted: 'rgba(30,41,59,0.7)', border: 'rgba(30,41,59,0.15)' };

  if (!bgColor) return lightTheme;

  let hex = bgColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? darkTheme : lightTheme;
    }
    return lightTheme;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? darkTheme : lightTheme;
};

export function SiteFooterFull({
  logoImage,
  tagline = '',
  links = [],
  aboutTitle = '',
  aboutText = '',
  copyright = '',
  backgroundColor = '#1e293b',
  fullWidth = false,
  showNav = true,
  showAbout = true,
  showLogo = true,
  showCopyright = true,
  showSocial = false,
  puck,
}: Omit<PageFooterProps, 'theme'> & PuckRenderExtras) {
  const logoUrl = getMediaUrl(logoImage, puck);
  const taglineText = getTextContent(tagline);
  const taglineStyle = getTextStyle(tagline, { color: '#ffffff', fontSize: 14 });
  const aboutTitleText = getTextContent(aboutTitle);
  const aboutTitleStyle = getTextStyle(aboutTitle, { color: '#ffffff', fontSize: 20 });
  const copyrightText = getTextContent(copyright);
  const copyrightStyle = getTextStyle(copyright, { color: 'rgba(255,255,255,0.8)', fontSize: 13 });

  const showOverlay = shouldShowOverlay({});
  const colors = getContrastColor(backgroundColor);

  return (
    <SectionOverlay show={showOverlay} sectionName="Footer">
      <footer className={fullWidth ? 'puck-full-width' : ''} style={{
        background: backgroundColor,
        color: colors.text,
        paddingBottom: '100px',
      }}>
        <div className={fullWidth ? 'puck-full-width-inner' : undefined}>
          <div style={{
            padding: '60px 24px 40px',
            textAlign: 'center',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            {showLogo && logoUrl && (
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={logoUrl}
                  alt="Logo"
                  style={{
                    height: '80px',
                    width: 'auto',
                    objectFit: 'contain',
                    ...getMediaDisplayStyle(logoImage),
                  }}
                />
              </div>
            )}

            {taglineText && (
              <div style={{
                marginBottom: '20px',
                ...taglineStyle,
                color: colors.textMuted,
              }}>
                {taglineText}
              </div>
            )}

            {showNav && links.length > 0 && (
              <nav style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '40px',
                flexWrap: 'wrap' as const,
              }}>
                {links.map((link, i) => {
                  const linkLabelText = getTextContent(link.label);
                  const linkLabelStyle = getTextStyle(link.label, { color: colors.text, fontSize: 14 });
                  return (
                    <a
                      key={i}
                      href={getURLString(link.url) || '#'}
                      suppressHydrationWarning
                      style={{
                        ...linkLabelStyle,
                        textDecoration: 'none',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        opacity: 0.9,
                      }}
                    >
                      {linkLabelText}
                    </a>
                  );
                })}
              </nav>
            )}

            {showSocial && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  marginTop: '24px',
                }}
              >
                {['F', 'T', 'I'].map((label) => (
                  <span
                    key={label}
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: colors.border,
                      color: colors.text,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {showAbout && (aboutTitleText || aboutText) && (
            <div style={{
              padding: '40px 24px',
              maxWidth: '900px',
              margin: '0 auto',
              textAlign: 'center',
            }}>
              {aboutTitleText && (
                <h3 style={{
                  fontSize: scaledFontSize(20),
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  color: colors.text,
                  ...aboutTitleStyle,
                }}>
                  {aboutTitleText}
                </h3>
              )}
              {aboutText && (
                <RichBody
                  value={aboutText}
                  style={{
                    fontSize: scaledFontSize(14),
                    lineHeight: 1.8,
                    color: colors.textMuted,
                  }}
                />
              )}
            </div>
          )}

          {showCopyright && copyrightText && (
            <div style={{
              padding: '20px 24px',
              textAlign: 'center',
              ...copyrightStyle,
            }}>
              {copyrightText}
            </div>
          )}
        </div>
      </footer>
    </SectionOverlay>
  );
}

export function SiteFooterCompact({
  brandName = '',
  brandLogo,
  links = [],
  backgroundColor = '#1e293b',
  padding = 40,
  fullWidth = false,
  showNav = true,
  showLogo = true,
  showCopyright = true,
  showSocial = false,
  copyright = '',
  puck,
}: Omit<PageFooterProps, 'theme'> & PuckRenderExtras) {
  const logoUrl = getMediaUrl(brandLogo, puck);
  const brandNameText = getTextContent(brandName);
  const brandNameStyle = getTextStyle(brandName, { color: '#ffffff', fontSize: 28 });
  const hoverColor = brandNameStyle.color as string || '#ffffff';

  return (
    <footer
      style={{
        background: backgroundColor,
        padding: `${padding}px 24px`,
        textAlign: 'center',
      }}
      className={`old-checkout-footer${fullWidth ? ' puck-full-width' : ''}`}
    >
      <div className={fullWidth ? 'puck-full-width-inner' : undefined}>
        {showLogo && (logoUrl || brandNameText) && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={getTextString(brandName)}
                style={{
                  maxHeight: '48px',
                  width: 'auto',
                  display: 'block',
                  ...getMediaDisplayStyle(brandLogo),
                }}
              />
            ) : (
              <h3
                style={{
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: 'Georgia, serif',
                  ...brandNameStyle,
                }}
              >
                {brandNameText}
              </h3>
            )}
          </div>
        )}

        {showNav && links.length > 0 && (
          <nav
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px 24px',
            }}
          >
            {links.map((link, index) => {
              const linkLabelText = getTextContent(link.label);
              const linkLabelStyle = getTextStyle(link.label, { color: '#94a3b8', fontSize: 14 });
              const linkBaseColor = linkLabelStyle.color as string || '#94a3b8';

              return (
                <a
                  key={index}
                  href={getURLString(link.url) || '#'}
                  suppressHydrationWarning
                  style={{
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                    ...linkLabelStyle,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = hoverColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = linkBaseColor;
                  }}
                >
                  {linkLabelText}
                </a>
              );
            })}
          </nav>
        )}

        {showSocial && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            {['F', 'T', 'I'].map((label) => (
              <span
                key={label}
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {showCopyright && getTextContent(copyright) && (
          <div
            style={{
              marginTop: '16px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {getTextContent(copyright)}
          </div>
        )}
      </div>
    </footer>
  );
}
