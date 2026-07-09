import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast, toastStore, MAX_TOASTS, DEFAULT_DURATION_MS } from '@/components/primitives/ds/ToastProvider';

beforeEach(() => {
  toastStore.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  toastStore.clear();
  vi.useRealTimers();
});

describe('ToastStore basic API', () => {
  it('starts empty', () => {
    expect(toastStore.getSnapshot()).toEqual([]);
  });

  it('adds an item via show()', () => {
    const id = toast.success('Saved');
    const items = toastStore.getSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(id);
    expect(items[0].tone).toBe('success');
    expect(items[0].message).toBe('Saved');
  });

  it('exposes convenience helpers for all four tones', () => {
    toast.success('a');
    toast.info('b');
    toast.warn('c');
    toast.error('d');
    const tones = toastStore.getSnapshot().map((i) => i.tone);
    expect(tones).toEqual(['success', 'info', 'warn', 'error']);
  });

  it('clear() removes all items', () => {
    toast.success('a');
    toast.success('b');
    expect(toastStore.getSnapshot()).toHaveLength(2);
    toastStore.clear();
    expect(toastStore.getSnapshot()).toEqual([]);
  });
});

describe('ToastStore queue cap', () => {
  it('keeps at most MAX_TOASTS items, dropping the oldest', () => {
    for (let i = 0; i < MAX_TOASTS + 3; i++) {
      toast.info(`msg-${i}`);
    }
    const items = toastStore.getSnapshot();
    expect(items).toHaveLength(MAX_TOASTS);
    expect(items[0].message).toBe(`msg-3`);
    expect(items[items.length - 1].message).toBe(`msg-${MAX_TOASTS + 2}`);
  });
});

describe('ToastStore auto-dismiss', () => {
  it('non-error toasts auto-dismiss after the default duration', () => {
    const id = toast.success('Saved');
    expect(toastStore.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(DEFAULT_DURATION_MS - 1);
    expect(toastStore.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(toastStore.getSnapshot()).toHaveLength(0);
    expect(toastStore.getSnapshot().some((i) => i.id === id)).toBe(false);
  });

  it('error toasts stay until manually dismissed', () => {
    const id = toast.error('Boom');
    vi.advanceTimersByTime(DEFAULT_DURATION_MS * 10);
    expect(toastStore.getSnapshot()).toHaveLength(1);
    toast.dismiss(id);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it('respects an explicit durationMs override', () => {
    toast.info('quick', { durationMs: 100 });
    vi.advanceTimersByTime(99);
    expect(toastStore.getSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it('treats durationMs <= 0 as sticky', () => {
    toast.info('sticky', { durationMs: 0 });
    vi.advanceTimersByTime(60_000);
    expect(toastStore.getSnapshot()).toHaveLength(1);
  });

  it('error toasts ignore a positive durationMs override only when it is undefined', () => {
    // when caller explicitly passes durationMs > 0, even errors auto-dismiss
    toast.error('boom', { durationMs: 50 });
    vi.advanceTimersByTime(60);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });
});

describe('ToastStore subscription', () => {
  it('notifies subscribers on add and dismiss', () => {
    const calls: number[] = [];
    const unsubscribe = toastStore.subscribe((items) => calls.push(items.length));
    const id = toast.success('a');
    toast.dismiss(id);
    expect(calls).toEqual([1, 0]);
    unsubscribe();
  });

  it('unsubscribes cleanly', () => {
    const spy = vi.fn();
    const unsubscribe = toastStore.subscribe(spy);
    unsubscribe();
    toast.success('a');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('ToastStore dismissible flag', () => {
  it('defaults to dismissible: true', () => {
    toast.info('a');
    expect(toastStore.getSnapshot()[0].dismissible).toBe(true);
  });
  it('can be turned off', () => {
    toast.info('a', { dismissible: false });
    expect(toastStore.getSnapshot()[0].dismissible).toBe(false);
  });
});
