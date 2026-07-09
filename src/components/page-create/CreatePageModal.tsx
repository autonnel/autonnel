import React, { useState } from 'react';
import { Modal } from '../primitives';
import type { EditorChoice } from './shared';
import ComponentPagePanel from './ComponentPagePanel';
import HtmlPagePanel from './HtmlPagePanel';

interface CreatePageModalProps {
  onClose: () => void;
  onCreated: (page: any) => void;
  defaultPageType?: string;
  redirectAfterCreate?: boolean;
}

function ComponentPreview() {
  return (
    <svg
      viewBox="0 0 280 80"
      className="block w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="280" height="80" rx="6" fill="#f3f4f6" />
      <rect x="12" y="10" width="40" height="4" rx="1.5" fill="#9ca3af" />
      <rect x="220" y="11" width="48" height="3" rx="1.5" fill="#d1d5db" />
      <rect
        x="12"
        y="20"
        width="256"
        height="22"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <rect x="18" y="26" width="90" height="4" rx="1" fill="#3b82f6" />
      <rect x="18" y="34" width="56" height="3" rx="1" fill="#93c5fd" />
      <rect
        x="12"
        y="46"
        width="78"
        height="20"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <rect
        x="101"
        y="46"
        width="78"
        height="20"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <rect
        x="190"
        y="46"
        width="78"
        height="20"
        rx="3"
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <rect x="12" y="70" width="256" height="4" rx="1" fill="#e5e7eb" />
    </svg>
  );
}

function HtmlPreview() {
  return (
    <svg
      viewBox="0 0 280 80"
      className="block w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="280" height="80" rx="6" fill="#f3f4f6" />
      <circle cx="14" cy="12" r="3" fill="#ef4444" />
      <circle cx="26" cy="12" r="3" fill="#f59e0b" />
      <circle cx="38" cy="12" r="3" fill="#10b981" />
      <rect x="14" y="24" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="19" y="24" width="14" height="3" rx="1" fill="#a855f7" />
      <rect x="35" y="24" width="20" height="3" rx="1" fill="#3b82f6" />
      <rect x="57" y="24" width="2" height="3" rx="1" fill="#6b7280" />
      <rect x="60" y="24" width="36" height="3" rx="1" fill="#10b981" />
      <rect x="98" y="24" width="8" height="3" rx="1" fill="#3b82f6" />
      <rect x="108" y="24" width="2" height="3" rx="1" fill="#6b7280" />
      <rect x="111" y="24" width="28" height="3" rx="1" fill="#10b981" />
      <rect x="141" y="24" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="22" y="34" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="27" y="34" width="8" height="3" rx="1" fill="#a855f7" />
      <rect x="37" y="34" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="42" y="34" width="64" height="3" rx="1" fill="#374151" />
      <rect x="108" y="34" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="113" y="34" width="10" height="3" rx="1" fill="#a855f7" />
      <rect x="125" y="34" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="22" y="44" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="27" y="44" width="4" height="3" rx="1" fill="#a855f7" />
      <rect x="33" y="44" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="38" y="44" width="118" height="3" rx="1" fill="#9ca3af" />
      <rect x="158" y="44" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="163" y="44" width="6" height="3" rx="1" fill="#a855f7" />
      <rect x="171" y="44" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="22" y="54" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="27" y="54" width="4" height="3" rx="1" fill="#a855f7" />
      <rect x="33" y="54" width="14" height="3" rx="1" fill="#3b82f6" />
      <rect x="49" y="54" width="2" height="3" rx="1" fill="#6b7280" />
      <rect x="52" y="54" width="50" height="3" rx="1" fill="#10b981" />
      <rect x="104" y="54" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="109" y="54" width="32" height="3" rx="1" fill="#374151" />
      <rect x="143" y="54" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="148" y="54" width="4" height="3" rx="1" fill="#a855f7" />
      <rect x="154" y="54" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="14" y="64" width="3" height="3" rx="1" fill="#6b7280" />
      <rect x="19" y="64" width="14" height="3" rx="1" fill="#a855f7" />
      <rect x="35" y="64" width="3" height="3" rx="1" fill="#6b7280" />
    </svg>
  );
}

const EDITOR_CARDS: {
  value: EditorChoice;
  preview: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
}[] = [
  {
    value: 'PUCK',
    preview: <ComponentPreview />,
    title: 'Component-based page',
    subtitle: 'Stable styling, fast loading, full template library',
    bullets: [
      'All page types: landing / checkout / upsell / thankyou / error',
      'Curated templates for every step of a funnel',
      'Built-in components with consistent SSR and Island hydration',
    ],
  },
  {
    value: 'HTML',
    preview: <HtmlPreview />,
    title: 'Free HTML page',
    subtitle: 'For landing pages only',
    bullets: [
      'Landing pages only — checkout / thankyou / upsell not supported',
      'Paste raw HTML or import any URL (assets auto-migrate to your CDN)',
      'Best for AI-driven page replication and ad LP cloning',
    ],
  },
];

export default function CreatePageModal({
  onClose,
  onCreated,
  defaultPageType,
  redirectAfterCreate = true,
}: CreatePageModalProps) {
  const [choice, setChoice] = useState<EditorChoice | null>(null);

  const renderChooser = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {EDITOR_CARDS.map((card) => (
          <button
            key={card.value}
            type="button"
            data-testid={`editor-card-${card.value}`}
            onClick={() => setChoice(card.value)}
            className="text-left p-4 rounded-[10px] border border-ds-line bg-ds-card hover:border-ds-slate hover:bg-[#F9FAFB] transition-colors cursor-pointer"
          >
            <div className="mb-3 w-full" style={{ aspectRatio: '7 / 2' }}>
              {card.preview}
            </div>
            <div className="text-[13.5px] font-semibold text-ds-ink mb-0.5">{card.title}</div>
            <div className="text-[11.5px] text-ds-muted mb-2.5">{card.subtitle}</div>
            <ul className="space-y-1">
              {card.bullets.map((b) => (
                <li
                  key={b}
                  className="text-[11.5px] text-ds-muted flex items-start gap-2 leading-relaxed"
                >
                  <span className="text-ds-ink mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
        >
          Cancel
        </button>
      </div>
    </>
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="Create New Page" maxWidth="4xl">
      {choice === null && renderChooser()}
      {choice === 'PUCK' && (
        <ComponentPagePanel
          onCancel={onClose}
          onBack={() => setChoice(null)}
          onCreated={onCreated}
          redirectAfterCreate={redirectAfterCreate}
          defaultPageType={defaultPageType}
        />
      )}
      {choice === 'HTML' && (
        <HtmlPagePanel
          onCancel={onClose}
          onBack={() => setChoice(null)}
          onCreated={onCreated}
          redirectAfterCreate={redirectAfterCreate}
        />
      )}
    </Modal>
  );
}
