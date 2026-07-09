export type LlmModelType = 'text' | 'image' | 'video';

export interface LlmModel {
  type: LlmModelType;
  provider: string;
  name: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  options?: Record<string, unknown>;
  isDefault?: boolean;
}

export const LLM_MODEL_TYPES: readonly LlmModelType[] = ['text', 'image', 'video'] as const;
