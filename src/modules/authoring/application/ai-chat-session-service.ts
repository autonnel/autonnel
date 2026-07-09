export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
}

export interface ChatSession {
  id: string;
  pageId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiChatSessionRepositoryPort {
  listForPage(pageId: string): Promise<ChatSessionSummary[]>;
  findById(id: string): Promise<ChatSession | null>;
  create(input: { pageId: string; title: string; messages: ChatMessage[] }): Promise<ChatSession>;
  update(id: string, patch: { title?: string; messages?: ChatMessage[] }): Promise<ChatSession | null>;
  delete(id: string): Promise<boolean>;
}

const MAX_TITLE_LEN = 80;

export class AiChatSessionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export class AiChatSessionService {
  constructor(private readonly deps: { sessions: AiChatSessionRepositoryPort }) {}

  list(pageId: string): Promise<ChatSessionSummary[]> {
    return this.deps.sessions.listForPage(pageId);
  }

  async get(pageId: string, sessionId: string): Promise<ChatSession> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session || session.pageId !== pageId) throw new AiChatSessionError(404, 'Session not found');
    return session;
  }

  create(pageId: string, input: { title?: string; messages?: ChatMessage[] }): Promise<ChatSession> {
    const title = (input.title ?? '').trim().slice(0, MAX_TITLE_LEN) || 'New chat';
    return this.deps.sessions.create({ pageId, title, messages: input.messages ?? [] });
  }

  async update(
    pageId: string,
    sessionId: string,
    input: { title?: string; messages?: ChatMessage[] },
  ): Promise<ChatSession> {
    const existing = await this.deps.sessions.findById(sessionId);
    if (!existing || existing.pageId !== pageId) throw new AiChatSessionError(404, 'Session not found');
    const patch: { title?: string; messages?: ChatMessage[] } = {};
    if (typeof input.title === 'string') {
      const t = input.title.trim().slice(0, MAX_TITLE_LEN);
      if (t) patch.title = t;
    }
    if (Array.isArray(input.messages)) patch.messages = input.messages;
    const updated = await this.deps.sessions.update(sessionId, patch);
    if (!updated) throw new AiChatSessionError(404, 'Session not found');
    return updated;
  }

  async delete(pageId: string, sessionId: string): Promise<void> {
    const existing = await this.deps.sessions.findById(sessionId);
    if (!existing || existing.pageId !== pageId) throw new AiChatSessionError(404, 'Session not found');
    await this.deps.sessions.delete(sessionId);
  }
}
