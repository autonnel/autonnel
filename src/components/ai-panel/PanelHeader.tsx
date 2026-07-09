import { iconButtonHover, iconButtonLeave, iconButtonStyle } from './panel-helpers';

interface PanelHeaderProps {
  inHistoryView: boolean;
  currentSessionTitle: string;
  onNewChat: () => void;
  onToggleHistory: () => void;
}

export function PanelHeader({
  inHistoryView,
  currentSessionTitle,
  onNewChat,
  onToggleHistory,
}: PanelHeaderProps) {
  return (
    <div
      className="autonnel-puck-ai-panel__header"
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <div
        className="autonnel-puck-ai-panel__title"
        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {inHistoryView ? 'Chat history' : currentSessionTitle}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          style={iconButtonStyle}
          onMouseEnter={iconButtonHover}
          onMouseLeave={iconButtonLeave}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToggleHistory}
          aria-label={inHistoryView ? 'Back to chat' : 'View history'}
          title={inHistoryView ? 'Back to chat' : 'View history'}
          style={{
            ...iconButtonStyle,
            ...(inHistoryView ? { background: '#eef2ff', color: '#3730a3' } : {}),
          }}
          onMouseEnter={iconButtonHover}
          onMouseLeave={(e) => {
            if (!inHistoryView) iconButtonLeave(e);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
