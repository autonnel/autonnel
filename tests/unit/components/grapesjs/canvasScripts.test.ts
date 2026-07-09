// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getInitialScriptsOn, persistScriptsOn, SCRIPTS_ON_KEY } from '@/components/grapesjs/canvasScripts';

describe('canvasScripts persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getInitialScriptsOn returns false when nothing stored', () => {
    expect(getInitialScriptsOn('page-1')).toBe(false);
  });

  it('persistScriptsOn writes per-page key', () => {
    persistScriptsOn('page-1', true);
    expect(localStorage.getItem(`${SCRIPTS_ON_KEY}:page-1`)).toBe('1');
  });

  it('round-trips true', () => {
    persistScriptsOn('page-2', true);
    expect(getInitialScriptsOn('page-2')).toBe(true);
  });

  it('round-trips false', () => {
    persistScriptsOn('page-3', true);
    persistScriptsOn('page-3', false);
    expect(getInitialScriptsOn('page-3')).toBe(false);
  });

  it('isolated per pageId', () => {
    persistScriptsOn('a', true);
    expect(getInitialScriptsOn('b')).toBe(false);
  });
});
