import type { MediaFieldValue } from './index';

export function resolveGenerationParams(
  value: MediaFieldValue,
  fallbackAspectRatio: string,
): { effectiveAspectRatio: string; updatedValue: MediaFieldValue } {
  const effectiveAspectRatio = value.generationAspectRatio || fallbackAspectRatio;
  const updatedValue: MediaFieldValue = { ...value };

  if (value.displaySizeMode === 'custom') {
    return { effectiveAspectRatio, updatedValue };
  }

  updatedValue.displayRatio = effectiveAspectRatio;
  if (!value.displaySizeMode || value.displaySizeMode === 'ratio') {
    updatedValue.displaySizeMode = 'ratio';
  }

  return { effectiveAspectRatio, updatedValue };
}
