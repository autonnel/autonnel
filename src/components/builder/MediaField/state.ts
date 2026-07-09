export const PERSIST_KEY = 'autonnel:mediaJobs';

export const MAX_POLL_MS: Record<'image' | 'video', number> = {
  image: 10 * 60_000,
  video: 20 * 60_000,
};
export const MAX_CONSECUTIVE_ERRORS = 5;
const POLL_INTERVAL_MS = 3000;

export interface MediaGenerationState {
  generating: boolean;
  generatingType: 'image' | 'video' | null;
  mediaId: string | null;
  error: string;
  autoGenerateTriggered: boolean;
  completedUrl?: string;
}

export interface PollingTask {
  mediaId: string;
  fieldId: string;
  type: 'image' | 'video';
  startedAt: number;
  consecutiveErrors: number;
}

interface PersistedJob {
  mediaId: string;
  type: 'image' | 'video';
  startedAt: number;
}

const DEFAULT_STATE: MediaGenerationState = {
  generating: false,
  generatingType: null,
  mediaId: null,
  error: '',
  autoGenerateTriggered: false,
};

function getStore(): Map<string, MediaGenerationState> {
  if (typeof window === 'undefined') return new Map();
  const w = window as unknown as { __mediaGenerationStateStore?: Map<string, MediaGenerationState> };
  if (!w.__mediaGenerationStateStore) w.__mediaGenerationStateStore = new Map();
  return w.__mediaGenerationStateStore;
}

function getListeners(): Map<string, Set<() => void>> {
  if (typeof window === 'undefined') return new Map();
  const w = window as unknown as { __mediaGenerationStateListeners?: Map<string, Set<() => void>> };
  if (!w.__mediaGenerationStateListeners) w.__mediaGenerationStateListeners = new Map();
  return w.__mediaGenerationStateListeners;
}

export function getMediaState(fieldId: string): MediaGenerationState {
  return getStore().get(fieldId) || { ...DEFAULT_STATE };
}

export function setMediaState(fieldId: string, patch: Partial<MediaGenerationState>): void {
  const store = getStore();
  store.set(fieldId, { ...getMediaState(fieldId), ...patch });
  const listeners = getListeners().get(fieldId);
  listeners?.forEach((fn) => fn());
}

export function subscribeToMediaState(fieldId: string, listener: () => void): () => void {
  const listeners = getListeners();
  if (!listeners.has(fieldId)) listeners.set(fieldId, new Set());
  listeners.get(fieldId)!.add(listener);
  return () => listeners.get(fieldId)?.delete(listener);
}

export function readPersistedJobs(): Record<string, PersistedJob> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PERSIST_KEY) || '{}');
  } catch {
    return {};
  }
}

export function persistJob(fieldId: string, entry: PersistedJob | null): void {
  if (typeof window === 'undefined') return;
  const all = readPersistedJobs();
  if (entry) all[fieldId] = entry;
  else delete all[fieldId];
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(all));
  } catch {
  }
}

function getPollingMap(): Map<string, PollingTask> {
  if (typeof window === 'undefined') return new Map();
  const w = window as unknown as { __mediaPollingTasks?: Map<string, PollingTask> };
  if (!w.__mediaPollingTasks) w.__mediaPollingTasks = new Map();
  return w.__mediaPollingTasks;
}

let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

function tickOnce(tasks: Map<string, PollingTask>): Promise<void[]> {
  return Promise.all(
    Array.from(tasks.entries()).map(async ([fieldId, task]) => {
      if (Date.now() - task.startedAt > MAX_POLL_MS[task.type]) {
        setMediaState(fieldId, {
          generating: false,
          generatingType: null,
          mediaId: null,
          error: `${task.type === 'video' ? 'Video' : 'Image'} generation timed out`,
        });
        tasks.delete(fieldId);
        persistJob(fieldId, null);
        return;
      }
      try {
        const response = await fetch(`/api/media/generate?id=${task.mediaId}`);
        if (!response.ok) {
          task.consecutiveErrors += 1;
          if (task.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setMediaState(fieldId, {
              generating: false,
              generatingType: null,
              mediaId: null,
              error: `${task.type === 'video' ? 'Video' : 'Image'} generation failed`,
            });
            tasks.delete(fieldId);
            persistJob(fieldId, null);
          }
          return;
        }
        task.consecutiveErrors = 0;
        const data = (await response.json()) as { status: string; url?: string };
        if (data.status === 'COMPLETED' && data.url) {
          setMediaState(fieldId, {
            generating: false,
            generatingType: null,
            mediaId: null,
            completedUrl: data.url,
          });
          tasks.delete(fieldId);
          persistJob(fieldId, null);
        } else if (data.status === 'ERROR') {
          setMediaState(fieldId, {
            generating: false,
            generatingType: null,
            mediaId: null,
            error: `${task.type === 'video' ? 'Video' : 'Image'} generation failed`,
          });
          tasks.delete(fieldId);
          persistJob(fieldId, null);
        }
      } catch {
        task.consecutiveErrors += 1;
        if (task.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setMediaState(fieldId, {
            generating: false,
            generatingType: null,
            mediaId: null,
            error: 'Network error during generation',
          });
          tasks.delete(fieldId);
          persistJob(fieldId, null);
        }
      }
    })
  );
}

function startGlobalPolling(): void {
  if (pollingIntervalId) return;
  pollingIntervalId = setInterval(() => {
    const tasks = getPollingMap();
    if (tasks.size === 0) {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
      return;
    }
    void tickOnce(tasks);
  }, POLL_INTERVAL_MS);
}

export function addPollingTask(task: PollingTask): void {
  getPollingMap().set(task.fieldId, task);
  startGlobalPolling();
}

export function removePollingTask(fieldId: string): void {
  getPollingMap().delete(fieldId);
}
