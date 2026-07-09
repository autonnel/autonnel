export interface TextSegment {
  kind: 'text';
  text: string;
}

export interface ToolSegment {
  kind: 'tool';
  toolName: string;
  label: string;
  status: 'running' | 'done' | 'error';
  input?: unknown;
  added?: number;
  removed?: number;
  unit?: string;
  errorMessage?: string;
}

export type Segment = TextSegment | ToolSegment;

export interface AssistantTimeline {
  segments: Segment[];
}

export type TimelineEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; toolName: string; input: unknown; label: string }
  | { type: 'tool-result'; toolName: string; added?: number; removed?: number; unit?: string }
  | { type: 'tool-error'; toolName: string; error: string };

export function applyTimelineEvent(
  prev: AssistantTimeline,
  event: TimelineEvent,
): AssistantTimeline {
  if (event.type === 'text-delta') {
    const last = prev.segments[prev.segments.length - 1];
    if (last && last.kind === 'text') {
      const next = prev.segments.slice(0, -1);
      next.push({ kind: 'text', text: last.text + event.delta });
      return { segments: next };
    }
    return { segments: [...prev.segments, { kind: 'text', text: event.delta }] };
  }
  if (event.type === 'tool-call') {
    return {
      segments: [
        ...prev.segments,
        {
          kind: 'tool',
          toolName: event.toolName,
          label: event.label,
          status: 'running',
          input: event.input,
        },
      ],
    };
  }
  if (event.type === 'tool-result' || event.type === 'tool-error') {
    const idx = findLastRunningToolIndex(prev.segments, event.toolName);
    if (idx === -1) return prev;
    const next = prev.segments.slice();
    const cur = next[idx] as ToolSegment;
    if (event.type === 'tool-result') {
      next[idx] = {
        ...cur,
        status: 'done',
        added: event.added,
        removed: event.removed,
        unit: event.unit,
      };
    } else {
      next[idx] = {
        ...cur,
        status: 'error',
        errorMessage: event.error,
      };
    }
    return { segments: next };
  }
  return prev;
}

export function timelineHasText(timeline?: AssistantTimeline): boolean {
  return timeline?.segments.some((s) => s.kind === 'text' && s.text.trim().length > 0) ?? false;
}

function findLastRunningToolIndex(segments: Segment[], toolName: string): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.kind === 'tool' && s.toolName === toolName && s.status === 'running') return i;
  }
  return -1;
}
