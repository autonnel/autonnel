import { describe, it, expect } from 'vitest';
import { applyTimelineEvent, timelineHasText, type AssistantTimeline } from './timeline';

const empty: AssistantTimeline = { segments: [] };

describe('timeline reducer', () => {
  it('appends text-delta to a new text segment', () => {
    const t = applyTimelineEvent(empty, { type: 'text-delta', delta: 'hello ' });
    expect(t.segments).toEqual([{ kind: 'text', text: 'hello ' }]);
  });

  it('coalesces consecutive text-deltas into one segment', () => {
    let t = applyTimelineEvent(empty, { type: 'text-delta', delta: 'hello ' });
    t = applyTimelineEvent(t, { type: 'text-delta', delta: 'world' });
    expect(t.segments).toEqual([{ kind: 'text', text: 'hello world' }]);
  });

  it('opens a tool segment on tool-call', () => {
    const t = applyTimelineEvent(empty, {
      type: 'tool-call',
      toolName: 'rewriteText',
      input: { aid: 'a1', text: 'New' },
      label: 'Rewriting #a1',
    });
    expect(t.segments).toEqual([
      { kind: 'tool', toolName: 'rewriteText', label: 'Rewriting #a1', status: 'running', input: { aid: 'a1', text: 'New' } },
    ]);
  });

  it('fills tool segment counts on matching tool-result', () => {
    let t = applyTimelineEvent(empty, {
      type: 'tool-call',
      toolName: 'rewriteText',
      input: {},
      label: 'Rewriting',
    });
    t = applyTimelineEvent(t, {
      type: 'tool-result',
      toolName: 'rewriteText',
      added: 42,
      removed: 12,
    });
    expect(t.segments[0]).toMatchObject({ kind: 'tool', status: 'done', added: 42, removed: 12 });
  });

  it('marks tool as errored on tool-error', () => {
    let t = applyTimelineEvent(empty, {
      type: 'tool-call',
      toolName: 'rewriteText',
      input: {},
      label: 'Rewriting',
    });
    t = applyTimelineEvent(t, {
      type: 'tool-error',
      toolName: 'rewriteText',
      error: 'aid not found',
    });
    expect(t.segments[0]).toMatchObject({ kind: 'tool', status: 'error', errorMessage: 'aid not found' });
  });

  it('starts a new text segment after a tool segment', () => {
    let t = applyTimelineEvent(empty, { type: 'text-delta', delta: 'first ' });
    t = applyTimelineEvent(t, {
      type: 'tool-call',
      toolName: 'x',
      input: {},
      label: 'x',
    });
    t = applyTimelineEvent(t, { type: 'text-delta', delta: 'second' });
    expect(t.segments).toHaveLength(3);
    expect(t.segments[2]).toEqual({ kind: 'text', text: 'second' });
  });

  it('timelineHasText reports whether any non-empty text segment exists', () => {
    expect(timelineHasText(undefined)).toBe(false);
    expect(timelineHasText({ segments: [] })).toBe(false);
    expect(timelineHasText({ segments: [{ kind: 'text', text: '   ' }] })).toBe(false);
    expect(
      timelineHasText({
        segments: [{ kind: 'tool', toolName: 'x', label: 'x', status: 'done' }],
      }),
    ).toBe(false);
    expect(timelineHasText({ segments: [{ kind: 'text', text: 'hi' }] })).toBe(true);
  });

  it('tool-result for unknown tool is ignored', () => {
    const t = applyTimelineEvent(empty, {
      type: 'tool-result',
      toolName: 'nobody',
    });
    expect(t.segments).toEqual([]);
  });
});
