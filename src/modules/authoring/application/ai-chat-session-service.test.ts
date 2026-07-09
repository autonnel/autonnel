import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiChatSessionService,
  AiChatSessionError,
  type AiChatSessionRepositoryPort,
  type ChatMessage,
  type ChatSession,
  type ChatSessionSummary,
} from './ai-chat-session-service';

class FakeRepo implements AiChatSessionRepositoryPort {
  rows = new Map<string, ChatSession>();
  seq = 0;
  async listForPage(pageId: string): Promise<ChatSessionSummary[]> {
    return [...this.rows.values()]
      .filter((s) => s.pageId === pageId)
      .map((s) => ({ id: s.id, title: s.title, messageCount: s.messages.length, createdAt: s.createdAt, updatedAt: s.updatedAt }));
  }
  async findById(id: string): Promise<ChatSession | null> {
    return this.rows.get(id) ?? null;
  }
  async create(input: { pageId: string; title: string; messages: ChatMessage[] }): Promise<ChatSession> {
    const now = new Date();
    const s: ChatSession = { id: `s${++this.seq}`, pageId: input.pageId, title: input.title, messages: input.messages, createdAt: now, updatedAt: now };
    this.rows.set(s.id, s);
    return s;
  }
  async update(id: string, patch: { title?: string; messages?: ChatMessage[] }): Promise<ChatSession | null> {
    const s = this.rows.get(id);
    if (!s) return null;
    const next = { ...s, ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.messages !== undefined ? { messages: patch.messages } : {}) };
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}

describe('AiChatSessionService', () => {
  let repo: FakeRepo;
  let svc: AiChatSessionService;
  beforeEach(() => {
    repo = new FakeRepo();
    svc = new AiChatSessionService({ sessions: repo });
  });

  it('creates with default title when blank', async () => {
    const s = await svc.create('page1', { messages: [] });
    expect(s.title).toBe('New chat');
  });

  it('truncates long titles to 80 chars', async () => {
    const s = await svc.create('page1', { title: 'x'.repeat(200) });
    expect(s.title).toHaveLength(80);
  });

  it('lists sessions for a page', async () => {
    await svc.create('page1', { title: 'A', messages: [{ role: 'user', text: 'hi' }] });
    await svc.create('page2', { title: 'B' });
    const list = await svc.list('page1');
    expect(list).toHaveLength(1);
    expect(list[0].messageCount).toBe(1);
  });

  it('404s get for wrong page', async () => {
    const s = await svc.create('page1', { title: 'A' });
    await expect(svc.get('other', s.id)).rejects.toBeInstanceOf(AiChatSessionError);
  });

  it('updates title and messages', async () => {
    const s = await svc.create('page1', { title: 'A' });
    const u = await svc.update('page1', s.id, { title: 'B', messages: [{ role: 'assistant', text: 'ok' }] });
    expect(u.title).toBe('B');
    expect(u.messages).toHaveLength(1);
  });

  it('deletes a session', async () => {
    const s = await svc.create('page1', { title: 'A' });
    await svc.delete('page1', s.id);
    await expect(svc.get('page1', s.id)).rejects.toBeInstanceOf(AiChatSessionError);
  });
});
