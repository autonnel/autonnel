// NOT in this registry: the NDJSON-streaming AI editor endpoints
// (POST /api/page/ai-chat, POST /api/page/grapes-ai-chat) and the multipart upload endpoints
// (upload-asset, upload-folder, ai-upload, import-html). defineRoute/apiCall model a single
// JSON request/response; those routes stay raw APIRoute with their request bodies typed locally.

export type PageStatusDto = 'DRAFT' | 'PUBLISHED';
export type PageEditorTypeDto = 'PUCK' | 'HTML' | 'GRAPESJS';
export type PageTypeInput = 'checkout' | 'thankyou' | 'upsell' | 'error' | 'custom';

export interface PageListItemDto {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  editorType: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageFunnelBindingDto {
  pageId: string;
  funnelId: string;
  funnelName: string;
}

export interface PageListDto {
  pages: PageListItemDto[];
  bindings: PageFunnelBindingDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PageDetailDto {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  editorType: string;
  templateName: string | null;
  draftData: unknown;
  publishedData: unknown;
  htmlContent: string | null;
  draftHtml: string | null;
  draftSettings: unknown;
  settings: unknown;
  meta: unknown;
  planContent: unknown;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageInputDto {
  name: string;
  slug: string;
  type: PageTypeInput;
  editorType?: PageEditorTypeDto;
  templateName?: string;
}

export interface CopyPageInputDto {
  sourcePageId: string;
  name?: string;
  slug?: string;
  targetPageId?: string;
}

export interface UpdatePageInputDto {
  name?: string;
  slug?: string;
  status?: PageStatusDto;
  draftData?: unknown;
  publishedData?: unknown;
  htmlContent?: string;
  draftHtml?: string;
  draftSettings?: unknown;
  settings?: unknown;
  meta?: unknown;
  planContent?: unknown;
}

export interface AiModelDto {
  name: string;
  provider: string;
  isDefault: boolean;
}

export interface ChatSessionSummaryDto {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDto {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
}

export interface ChatSessionDto {
  id: string;
  title: string;
  messages: ChatMessageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PageAssetDto {
  src: string;
  size: number;
  key: string;
}

export interface FunnelNextStepDto {
  nextStepUrl: string | null;
  funnelId: string | null;
  funnelName: string | null;
  currentPageType: string | null;
}

export interface PagesContracts {
  'GET /api/page': { input: null; output: PageListDto };
  'POST /api/page': { input: CreatePageInputDto; output: PageDetailDto };
  'GET /api/page/:pageId': { input: null; output: PageDetailDto };
  'PUT /api/page/:pageId': { input: UpdatePageInputDto; output: PageDetailDto };
  'PATCH /api/page/:pageId': { input: { document: unknown; bindings?: unknown }; output: { ok: true } };
  'DELETE /api/page/:pageId': { input: null; output: { success: true } };
  'POST /api/page/:pageId/publish': { input: null; output: { ok: true } };
  'POST /api/page/copy': { input: CopyPageInputDto; output: PageDetailDto };
  'GET /api/page/:pageId/funnel-next-step': { input: null; output: FunnelNextStepDto };
  'GET /api/page/ai-models': { input: null; output: { models: AiModelDto[] } };
  'GET /api/page/:pageId/chat-sessions': { input: null; output: { sessions: ChatSessionSummaryDto[] } };
  'POST /api/page/:pageId/chat-sessions': {
    input: { title?: string; messages?: ChatMessageDto[] };
    output: { session: ChatSessionDto };
  };
  'GET /api/page/:pageId/chat-sessions/:sessionId': { input: null; output: { session: ChatSessionDto } };
  'PUT /api/page/:pageId/chat-sessions/:sessionId': {
    input: { title?: string; messages?: ChatMessageDto[] };
    output: { session: ChatSessionDto };
  };
  'DELETE /api/page/:pageId/chat-sessions/:sessionId': { input: null; output: { ok: true } };
  'GET /api/page/:pageId/assets': { input: null; output: { assets: PageAssetDto[] } };
  // assetId passed via ?assetId= (DELETE has no body).
  'DELETE /api/page/:pageId/assets': { input: null; output: { success: true } };
}
