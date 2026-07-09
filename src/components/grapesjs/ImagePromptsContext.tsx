import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface ImagePromptsApi {
  imagePrompts: Record<string, string>;
  mergeImagePrompts: (updates: Record<string, string>) => void;
  setPromptForPid: (pid: string, prompt: string) => void;
  removePromptsNotIn: (livePids: string[]) => void;
}

const ImagePromptsContext = createContext<ImagePromptsApi | null>(null);

interface ProviderProps {
  initial: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  children: ReactNode;
}

export function ImagePromptsProvider({ initial, onChange, children }: ProviderProps) {
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>(initial);

  const update = useCallback(
    (mutator: (cur: Record<string, string>) => Record<string, string>) => {
      setImagePrompts((cur) => {
        const next = mutator(cur);
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const mergeImagePrompts = useCallback(
    (updates: Record<string, string>) => {
      if (!updates || Object.keys(updates).length === 0) return;
      update((cur) => ({ ...cur, ...updates }));
    },
    [update],
  );

  const setPromptForPid = useCallback(
    (pid: string, prompt: string) => {
      update((cur) => ({ ...cur, [pid]: prompt }));
    },
    [update],
  );

  const removePromptsNotIn = useCallback(
    (livePids: string[]) => {
      const live = new Set(livePids);
      update((cur) => {
        const out: Record<string, string> = {};
        let changed = false;
        for (const [k, v] of Object.entries(cur)) {
          if (live.has(k)) out[k] = v;
          else changed = true;
        }
        return changed ? out : cur;
      });
    },
    [update],
  );

  const value = useMemo<ImagePromptsApi>(
    () => ({ imagePrompts, mergeImagePrompts, setPromptForPid, removePromptsNotIn }),
    [imagePrompts, mergeImagePrompts, setPromptForPid, removePromptsNotIn],
  );

  return <ImagePromptsContext.Provider value={value}>{children}</ImagePromptsContext.Provider>;
}

export function useImagePrompts(): ImagePromptsApi {
  const ctx = useContext(ImagePromptsContext);
  if (!ctx) {
    throw new Error('useImagePrompts must be used inside <ImagePromptsProvider>');
  }
  return ctx;
}
