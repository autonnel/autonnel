import { AnimatedNumber } from './AnimatedNumber';
import type { ToolSegment } from './timeline';

interface Props {
  segment: ToolSegment;
}

export function ToolEntry({ segment }: Props) {
  const { status, label, added, removed, unit, errorMessage } = segment;

  const color =
    status === 'error' ? '#dc2626' :
    status === 'done' ? '#374151' :
    '#6b7280';

  const dot =
    status === 'error' ? '#dc2626' :
    status === 'done' ? '#10b981' :
    '#f59e0b';

  return (
    <div
      className="autonnel-puck-ai-panel__tool-entry"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        fontSize: 12,
        color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          minWidth: 8,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
          animation: status === 'running' ? 'autonnelToolDotPulse 1.2s ease-in-out infinite' : undefined,
        }}
      />
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {status === 'error' && errorMessage && (
        <span style={{ flexShrink: 0, color: '#dc2626' }}>{errorMessage}</span>
      )}
      {status !== 'error' && (added !== undefined || removed !== undefined) && (
        <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
          {(added ?? 0) > 0 && (
            <span style={{ color: '#16a34a' }}>
              +<AnimatedNumber value={added!} />{unit ? ` ${unit}` : ''}
            </span>
          )}
          {(removed ?? 0) > 0 && (
            <span style={{ color: '#dc2626' }}>
              -<AnimatedNumber value={removed!} />{unit ? ` ${unit}` : ''}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
