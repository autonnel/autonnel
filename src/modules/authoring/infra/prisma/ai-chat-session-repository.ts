import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  AiChatSessionRepositoryPort,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
} from '../../application/ai-chat-session-service';

interface Row {
  id: string;
  pageId: string;
  title: string;
  messages: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function toSession(row: Row): ChatSession {
  return {
    id: row.id,
    pageId: row.pageId,
    title: row.title,
    messages: Array.isArray(row.messages) ? (row.messages as ChatMessage[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAiChatSessionRepository implements AiChatSessionRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async listForPage(pageId: string): Promise<ChatSessionSummary[]> {
    const rows = await this.db.aiChatSession.findMany({
      where: { pageId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true, messages: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      messageCount: Array.isArray(r.messages) ? r.messages.length : 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string): Promise<ChatSession | null> {
    const row = (await this.db.aiChatSession.findFirst({ where: { id } })) as Row | null;
    return row ? toSession(row) : null;
  }

  async create(input: { pageId: string; title: string; messages: ChatMessage[] }): Promise<ChatSession> {
    const row = await this.db.aiChatSession.create({
      data: {
        pageId: input.pageId,
        title: input.title,
        messages: input.messages as unknown as Prisma.InputJsonValue,
      } as never,
    });
    return toSession(row as unknown as Row);
  }

  async update(
    id: string,
    patch: { title?: string; messages?: ChatMessage[] },
  ): Promise<ChatSession | null> {
    const existing = await this.db.aiChatSession.findFirst({ where: { id } });
    if (!existing) return null;
    const row = await this.db.aiChatSession.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.messages !== undefined
          ? { messages: patch.messages as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toSession(row as unknown as Row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.aiChatSession.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
