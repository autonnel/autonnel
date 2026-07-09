import React from 'react';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';
import { createColorField } from '../ColorField';

export interface ReferralCardProps {
  heading?: string | TextFieldValue;
  description?: string | TextFieldValue;
  code?: string;
  buttonText?: string;
  copiedText?: string;
  accentColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
}

// Copy is wired by a self-contained inline script (delegated click) so it works on
// SSR-only pages (the thank-you page is intentionally not hydrated as an island).
// Uses backtick string literals only: React text-escaping rewrites & < > " ' but
// not backticks, so the JSX <script> body survives intact (no dangerouslySetInnerHTML).
const COPY_SCRIPT = [
  '(function(){',
  'if(window.__autonnelReferralCopy)return;',
  'window.__autonnelReferralCopy=1;',
  'document.addEventListener(`click`,function(e){',
  'var t=e.target;if(!t)return;',
  'var b=t.closest?t.closest(`[data-referral-copy]`):null;if(!b)return;',
  'var code=b.getAttribute(`data-code`)||``;',
  'try{if(navigator.clipboard){navigator.clipboard.writeText(code);}}catch(_){}',
  'var done=b.getAttribute(`data-copied`)||`Copied`;',
  'var orig=b.getAttribute(`data-label`)||b.textContent;',
  'b.textContent=done;setTimeout(function(){b.textContent=orig;},2000);',
  '});})();',
].join('');

export function ReferralCard({
  heading = { text: 'Give $15, get $15', color: '#26211c', fontSize: 19 },
  description = {
    text: 'Share your link — your friend gets $15 off, and you earn $15 toward your next order.',
    color: '#6f685e',
    fontSize: 13,
  },
  code = 'glow.co/r/yourname',
  buttonText = 'Copy',
  copiedText = 'Copied',
  accentColor = '#C2603D',
  backgroundColor = '#ffffff',
  borderColor = '#eaddcd',
  borderRadius = 14,
  padding = 20,
}: ReferralCardProps) {
  const headingStyle = getTextStyle(heading, { color: '#26211c', fontSize: 19 });
  const descStyle = getTextStyle(description, { color: '#6f685e', fontSize: 13 });

  return (
    <div
      data-autonnel-puck="referral-card"
      style={{ background: backgroundColor, border: `1px solid ${borderColor}`, borderRadius, padding }}
    >
      {hasText(heading) ? (
        <div style={{ fontWeight: 800, color: headingStyle.color, fontSize: headingStyle.fontSize, marginBottom: 6 }}>
          {getTextContent(heading)}
        </div>
      ) : null}
      {hasText(description) ? (
        <div style={{ color: descStyle.color, fontSize: descStyle.fontSize, lineHeight: 1.5, marginBottom: 14 }}>
          {getTextContent(description)}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            border: `1px dashed ${accentColor}`,
            borderRadius: 9,
            background: `${accentColor}10`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            color: accentColor,
            fontWeight: 700,
            fontSize: scaledFontSize(13),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {code}
        </div>
        <button
          type="button"
          data-referral-copy=""
          data-code={code}
          data-copied={copiedText}
          data-label={buttonText}
          style={{
            height: 44,
            padding: '0 18px',
            border: 'none',
            borderRadius: 9,
            background: '#26211c',
            color: '#fff',
            fontWeight: 700,
            fontSize: scaledFontSize(13),
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {buttonText}
        </button>
      </div>
      <script>{COPY_SCRIPT}</script>
    </div>
  );
}

export const ReferralCardConfig = {
  label: 'Referral Card',
  fields: {
    heading: createTextField({ label: 'Heading', defaultColor: '#26211c', defaultFontSize: 19 }),
    description: createTextField({ label: 'Description', defaultColor: '#6f685e', defaultFontSize: 13 }),
    code: { type: 'text' as const, label: 'Referral Code / Link' },
    buttonText: { type: 'text' as const, label: 'Button Text' },
    copiedText: { type: 'text' as const, label: 'Copied Text' },
    accentColor: createColorField({ label: 'Accent Color' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderColor: createColorField({ label: 'Border Color' }),
    borderRadius: { type: 'number' as const, label: 'Border Radius', min: 0, max: 32 },
    padding: { type: 'number' as const, label: 'Padding', min: 0, max: 48 },
  },
  defaultProps: {
    heading: { text: 'Give $15, get $15', color: '#26211c', fontSize: 19 },
    description: {
      text: 'Share your link — your friend gets $15 off, and you earn $15 toward your next order.',
      color: '#6f685e',
      fontSize: 13,
    },
    code: 'glow.co/r/yourname',
    buttonText: 'Copy',
    copiedText: 'Copied',
    accentColor: '#C2603D',
    backgroundColor: '#ffffff',
    borderColor: '#eaddcd',
    borderRadius: 14,
    padding: 20,
  },
  render: ReferralCard,
};

export default ReferralCard;
