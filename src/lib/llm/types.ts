import type { LlmModel } from '@/lib/config/llm-models-types';

export type TextMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

export interface TextInput {
  messages: TextMessage[];
  modelId: string;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
  reasoning_effort?: string;
  maxTokens?: number;
  userId?: string;
}

export interface TextOutput {
  content: string;
  raw?: unknown;
}

export interface ImageInput {
  prompt: string;
  inputImageUrl?: string;
  inputImageBase64?: string;
  inputImageMimeType?: string;
  aspectRatio?: string;
}

export type ImageOutput =
  | { type: 'base64'; data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }
  | { type: 'url'; url: string };

export interface VideoInput {
  prompt: string;
  image?: string;
  firstFrame?: string;
  lastFrame?: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | '9:21' | string;
  resolution?: string;
  negativePrompt?: string;
  seed?: number;
  callbackUrl?: string;
}

export type VideoStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface VideoJob {
  id: string;
  status: VideoStatus;
  progress?: number;
  outputUrl?: string;
  outputBytes?: { data: string; mimeType: string };
  error?: string;
  raw?: unknown;
}

export interface TextProvider {
  id: string;
  generateText(input: TextInput, model: LlmModel): Promise<TextOutput>;
}

export interface ImageProvider {
  id: string;
  generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]>;
}

export interface VideoProvider {
  id: string;
  createJob(input: VideoInput, model: LlmModel): Promise<{ id: string; raw?: unknown }>;
  getJob(id: string, model: LlmModel): Promise<VideoJob>;
  cancelJob?(id: string, model: LlmModel): Promise<void>;
}
