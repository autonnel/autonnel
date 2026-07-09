import type { SaveStatus } from './types';

export function SaveStatusIndicator({ saveStatus, saveErrorMsg, onRetry }: {
  saveStatus: SaveStatus;
  saveErrorMsg: string;
  onRetry: () => void;
}) {
  if (saveStatus === 'saving') {
    return (
      <div
        className="inline-flex items-center h-7 px-3 rounded-[7px] bg-ds-warnBg border border-ds-warnBorder text-ds-warnText"
        aria-live="polite"
        aria-label="Saving"
        title="Saving…"
      >
        <svg width="26" height="8" viewBox="0 0 26 8" aria-hidden="true">
          <circle cx="4" cy="4" fill="currentColor">
            <animate attributeName="r" values="1.5;3;1.5" dur="1.1s" begin="0s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" begin="0s" repeatCount="indefinite" />
          </circle>
          <circle cx="13" cy="4" fill="currentColor">
            <animate attributeName="r" values="1.5;3;1.5" dur="1.1s" begin="0.18s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" begin="0.18s" repeatCount="indefinite" />
          </circle>
          <circle cx="22" cy="4" fill="currentColor">
            <animate attributeName="r" values="1.5;3;1.5" dur="1.1s" begin="0.36s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" begin="0.36s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    );
  }
  if (saveStatus === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={saveErrorMsg || 'Save failed — click to retry'}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[12px] font-medium border bg-ds-badBg border-ds-badBorder text-ds-badText hover:bg-[#FEE2E2]"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {saveErrorMsg || 'Save failed'}
      </button>
    );
  }
  return null;
}
