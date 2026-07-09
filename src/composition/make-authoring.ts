import type { PrismaClient } from '@prisma/client';
import { PrismaPageDashboardRepository } from '@/modules/authoring/infra/prisma/page-dashboard-repository';
import { PrismaAiChatSessionRepository } from '@/modules/authoring/infra/prisma/ai-chat-session-repository';
import { PageDashboardService } from '@/modules/authoring/application/page-dashboard-service';
import { AiChatSessionService } from '@/modules/authoring/application/ai-chat-session-service';
import { PrismaFunnelRepository } from '@/modules/authoring/infra/prisma/funnel-repository';
import { FunnelComposingService } from '@/modules/authoring/application/funnel-composing-service';

interface MakeAuthoringDeps {
  db: PrismaClient;
  events: { publish(events: unknown[]): Promise<void> };
  tenantId: string;
  invalidatePageCache: (tenantId: string, pageId: string, slug: string) => Promise<void>;
}

export function makeAuthoring(deps: MakeAuthoringDeps) {
  const funnels = new PrismaFunnelRepository(deps.db);
  const pageDashboardRepo = new PrismaPageDashboardRepository(deps.db, deps.tenantId, deps.invalidatePageCache);
  const chatSessionRepo = new PrismaAiChatSessionRepository(deps.db);
  const events = deps.events as never;
  const pages = {
    async exists(pageId: string): Promise<boolean> {
      return (await deps.db.page.findUnique({ where: { id: pageId }, select: { id: true } })) !== null;
    },
  };

  return {
    funnelComposing: new FunnelComposingService({ funnels, pages, events }),
    pageDashboard: new PageDashboardService({ pages: pageDashboardRepo }),
    aiChatSessions: new AiChatSessionService({ sessions: chatSessionRepo }),
  };
}
