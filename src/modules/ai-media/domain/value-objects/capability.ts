export const CAPABILITIES = ['TEXT', 'IMAGE', 'VIDEO'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const MODES = ['SYNC', 'ASYNC'] as const;
export type Mode = (typeof MODES)[number];

export const JOB_STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const TERMINAL: ReadonlySet<JobStatus> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

export function isCapability(v: unknown): v is Capability {
  return typeof v === 'string' && (CAPABILITIES as readonly string[]).includes(v);
}

export function isMode(v: unknown): v is Mode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v);
}

export function isTerminalStatus(s: JobStatus): boolean {
  return TERMINAL.has(s);
}
