export type { AssistantTimeline, Segment, TextSegment, ToolSegment } from './timeline';
import type { PendingMediaItem } from './media-autogen';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  error?: boolean;
  timeline?: import('./timeline').AssistantTimeline;
}

export interface SelectionHint {
  description: string;
}

export interface SelectionLabel {
  label: string;
  sublabel?: string;
}

export interface DonePayload {
  explanation: string;
  content?: Array<{ type: string; props?: Record<string, unknown> }>;
  root?: { props?: Record<string, unknown> };
  html?: string;
  css?: string;
  imagePromptUpdates?: Record<string, string>;
  autoGenerateImages?: boolean;
}

export interface ToolCallEvent {
  toolName: string;
  input: unknown;
}

export interface AdapterCapabilities {
  supportsImageGeneration?: boolean;
}

export interface AiPanelAdapter {
  endpoint: string;
  welcomeMessage: string;
  placeholder: string;

  beforeSend(): void;
  getState(): unknown;
  getStateField(): 'currentData' | 'currentPage';
  getSelectionHint(): SelectionHint | null;
  getSelectionLabel?(): SelectionLabel | null;
  clearSelection?(): void;

  getCapabilities?(): AdapterCapabilities;

  applyTool(event: ToolCallEvent): void;
  applyDone(payload: DonePayload): void;

  // Post-turn media generation (Puck): scan the freshly applied page data for
  // media slots that carry a prompt but no url, and patch urls back in as
  // generation completes. Adapters without these hooks (GrapesJS) handle
  // image generation inside applyDone instead.
  getPendingMedia?(): PendingMediaItem[];
  applyGeneratedMedia?(item: PendingMediaItem, url: string): void;

  formatToolLabel(toolName: string, input: unknown): string;
  isMutatingTool(toolName: string): boolean;
}
