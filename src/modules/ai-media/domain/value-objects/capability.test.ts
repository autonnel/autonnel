import { describe, it, expect } from 'vitest';
import {
  CAPABILITIES,
  MODES,
  JOB_STATUSES,
  isCapability,
  isMode,
  isTerminalStatus,
} from './capability';

describe('capability value objects', () => {
  it('exposes the three capabilities', () => {
    expect(CAPABILITIES).toEqual(['TEXT', 'IMAGE', 'VIDEO']);
  });

  it('exposes the two modes', () => {
    expect(MODES).toEqual(['SYNC', 'ASYNC']);
  });

  it('exposes the five job statuses', () => {
    expect(JOB_STATUSES).toEqual(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
  });

  it('isCapability guards membership', () => {
    expect(isCapability('IMAGE')).toBe(true);
    expect(isCapability('audio')).toBe(false);
  });

  it('isMode guards membership', () => {
    expect(isMode('ASYNC')).toBe(true);
    expect(isMode('batch')).toBe(false);
  });

  it('isTerminalStatus is true only for SUCCEEDED/FAILED/CANCELLED', () => {
    expect(isTerminalStatus('SUCCEEDED')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('RUNNING')).toBe(false);
    expect(isTerminalStatus('PENDING')).toBe(false);
  });
});
