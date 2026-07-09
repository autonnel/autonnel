import { describe, it, expect, vi, beforeEach } from 'vitest';

const streamTextMock = vi.fn();

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: (...args: unknown[]) => streamTextMock(...args) };
});

vi.mock('./skill-loader', () => ({
  loadSkillCatalog: () => [],
  buildSkillPrompt: () => '',
  createLoadSkillTool: () => ({}),
}));

import { runAnalystAgent, type AgentEvent } from './agent';

function fakeStream(parts: unknown[], finals: { text: string; finishReason: string }) {
  return {
    fullStream: (async function* () {
      for (const p of parts) yield p;
    })(),
    text: Promise.resolve(finals.text),
    steps: Promise.resolve([]),
    finishReason: Promise.resolve(finals.finishReason),
    usage: Promise.resolve({ totalTokens: 5 }),
  };
}

describe('runAnalystAgent', () => {
  beforeEach(() => streamTextMock.mockReset());

  it('streams text deltas and returns the final text with no tools', async () => {
    streamTextMock.mockReturnValue(
      fakeStream(
        [
          { type: 'start-step' },
          { type: 'text-delta', text: 'Hello ' },
          { type: 'text-delta', text: 'world' },
        ],
        { text: 'Hello world', finishReason: 'stop' },
      ),
    );

    const events: AgentEvent[] = [];
    const res = await runAnalystAgent({
      model: 'm' as never,
      system: 'sys',
      messages: [],
      onEvent: (e) => events.push(e),
    });

    expect(res.text).toBe('Hello world');
    expect(res.finishReason).toBe('stop');
    expect(events).toContainEqual({ type: 'text-delta', delta: 'Hello ' });
    expect(events).toContainEqual({ type: 'step-start', step: 1 });
    // No tools given -> streamText called without a tools key.
    expect(streamTextMock.mock.calls[0][0]).not.toHaveProperty('tools');
  });

  it('forwards tool-call / tool-result events when tools are provided', async () => {
    streamTextMock.mockReturnValue(
      fakeStream(
        [
          { type: 'start-step' },
          { type: 'tool-call', toolName: 'getFunnelList', input: {} },
          { type: 'tool-result', toolName: 'getFunnelList', output: { added: 3, unit: 'rows' } },
        ],
        { text: 'done', finishReason: 'stop' },
      ),
    );

    const events: AgentEvent[] = [];
    await runAnalystAgent({
      model: 'm' as never,
      system: 'sys',
      messages: [],
      tools: { getFunnelList: {} },
      onEvent: (e) => events.push(e),
    });

    expect(events).toContainEqual({ type: 'tool-call', toolName: 'getFunnelList', input: {} });
    expect(events).toContainEqual({ type: 'tool-result', toolName: 'getFunnelList', added: 3, removed: undefined, unit: 'rows' });
    expect(streamTextMock.mock.calls[0][0]).toHaveProperty('tools');
  });

  it('defaults maxSteps to 12', async () => {
    streamTextMock.mockReturnValue(fakeStream([], { text: '', finishReason: 'stop' }));
    await runAnalystAgent({ model: 'm' as never, system: 's', messages: [] });
    expect(streamTextMock.mock.calls[0][0]).toHaveProperty('stopWhen');
  });
});
