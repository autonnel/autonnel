import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getMediaState,
  setMediaState,
  subscribeToMediaState,
  readPersistedJobs,
  persistJob,
  PERSIST_KEY,
} from '@/components/builder/MediaField/state';

beforeEach(() => {
  window.localStorage.clear();
  (window as unknown as { __mediaGenerationStateStore?: Map<string, unknown> }).__mediaGenerationStateStore = new Map();
  (window as unknown as { __mediaGenerationStateListeners?: Map<string, Set<() => void>> }).__mediaGenerationStateListeners = new Map();
});

describe('state store', () => {
  it('returns a default state for an unknown fieldId', () => {
    const s = getMediaState('unknown');
    expect(s.generating).toBe(false);
    expect(s.mediaId).toBeNull();
    expect(s.error).toBe('');
  });

  it('merges partial updates', () => {
    setMediaState('f1', { generating: true, generatingType: 'image' });
    setMediaState('f1', { mediaId: 'm1' });
    const s = getMediaState('f1');
    expect(s.generating).toBe(true);
    expect(s.generatingType).toBe('image');
    expect(s.mediaId).toBe('m1');
  });

  it('notifies subscribers on every setMediaState call', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeToMediaState('f1', cb);
    setMediaState('f1', { generating: true });
    setMediaState('f1', { error: 'x' });
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
    setMediaState('f1', { error: 'y' });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('persistence', () => {
  it('PERSIST_KEY matches the legacy localStorage slot', () => {
    expect(PERSIST_KEY).toBe('autonnel:mediaJobs');
  });

  it('reads an empty object when nothing is stored', () => {
    expect(readPersistedJobs()).toEqual({});
  });

  it('round-trips a single field entry', () => {
    persistJob('f1', { mediaId: 'm1', type: 'image', startedAt: 100 });
    expect(readPersistedJobs()).toEqual({ f1: { mediaId: 'm1', type: 'image', startedAt: 100 } });
  });

  it('null entry removes the field', () => {
    persistJob('f1', { mediaId: 'm1', type: 'image', startedAt: 100 });
    persistJob('f1', null);
    expect(readPersistedJobs()).toEqual({});
  });

  it('survives JSON parse errors', () => {
    window.localStorage.setItem('autonnel:mediaJobs', 'not-json');
    expect(readPersistedJobs()).toEqual({});
  });
});
