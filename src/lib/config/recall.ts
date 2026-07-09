
import { getConfig, setConfig } from './get-config';

export const RECALL_KV_KEY = 'recall.config';

export interface RecallInterval {
  hours: number;
  emailTemplateType: string;
  couponId?: string | null;
}

export const DEFAULT_RECALL_INTERVALS: RecallInterval[] = [
  { hours: 24, emailTemplateType: 'RECALL_1' },
  { hours: 72, emailTemplateType: 'RECALL_2' },
  { hours: 168, emailTemplateType: 'RECALL_3' },
];

export interface RecallKvEntry {
  id: string;
  isEnabled: boolean;
  intervals: RecallInterval[];
  createdAt: string;
  updatedAt: string;
}

export interface RecallConfigPublic {
  id: string;
  isEnabled: boolean;
  intervals: RecallInterval[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertRecallConfigInput {
  isEnabled: boolean;
  intervals: RecallInterval[];
}

function newId(): string {
  return `rc_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`;
}

function toPublic(entry: RecallKvEntry): RecallConfigPublic {
  return {
    id: entry.id,
    isEnabled: entry.isEnabled,
    intervals: entry.intervals,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}

export async function getRecallKvConfig(): Promise<RecallConfigPublic | null> {
  const stored = await getConfig<RecallKvEntry>(RECALL_KV_KEY);
  if (!stored || typeof stored !== 'object' || typeof stored.id !== 'string') return null;
  return toPublic(stored);
}

export async function upsertRecallKvConfig(
  input: UpsertRecallConfigInput,
): Promise<RecallConfigPublic> {
  const existing = await getConfig<RecallKvEntry>(RECALL_KV_KEY);
  const now = new Date().toISOString();
  const next: RecallKvEntry = {
    id: existing?.id ?? newId(),
    isEnabled: input.isEnabled,
    intervals: input.intervals,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await setConfig(RECALL_KV_KEY, next);
  return toPublic(next);
}
