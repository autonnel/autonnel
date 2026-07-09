import type { FunnelRepositoryPort, PageExistencePort, DomainEventPort } from './ports';

interface Deps {
  funnels: FunnelRepositoryPort;
  pages: PageExistencePort;
  events: DomainEventPort;
}

export class FunnelComposingService {
  constructor(private readonly deps: Deps) {}

  async addStep(input: { funnelId: string; stepSlug: string; pageId: string }): Promise<void> {
    const funnel = await this.deps.funnels.load(input.funnelId);
    if (!funnel) throw new Error(`Funnel not found: ${input.funnelId}`);
    if (!(await this.deps.pages.exists(input.pageId))) throw new Error(`Referenced page not found: ${input.pageId}`);
    const events = funnel.addStep({ stepSlug: input.stepSlug, pageId: input.pageId });
    await this.deps.funnels.save(funnel);
    await this.deps.events.publish(events);
  }

  async removeStep(input: { funnelId: string; pageId: string }): Promise<void> {
    const funnel = await this.deps.funnels.load(input.funnelId);
    if (!funnel) throw new Error(`Funnel not found: ${input.funnelId}`);
    const events = funnel.removeStep(input.pageId);
    await this.deps.funnels.save(funnel);
    await this.deps.events.publish(events);
  }

  // The new page must exist; the old one may already be deleted (replacing an orphaned step).
  async replaceStep(input: { funnelId: string; fromPageId: string; toPageId: string }): Promise<void> {
    const funnel = await this.deps.funnels.load(input.funnelId);
    if (!funnel) throw new Error(`Funnel not found: ${input.funnelId}`);
    if (!(await this.deps.pages.exists(input.toPageId))) throw new Error(`Referenced page not found: ${input.toPageId}`);
    const events = funnel.replaceStepPage({ fromPageId: input.fromPageId, toPageId: input.toPageId });
    await this.deps.funnels.save(funnel);
    await this.deps.events.publish(events);
  }

  async setStepSlug(input: { funnelId: string; pageId: string; stepSlug: string }): Promise<void> {
    const funnel = await this.deps.funnels.load(input.funnelId);
    if (!funnel) throw new Error(`Funnel not found: ${input.funnelId}`);
    const events = funnel.setStepSlug({ pageId: input.pageId, stepSlug: input.stepSlug });
    await this.deps.funnels.save(funnel);
    await this.deps.events.publish(events);
  }
}
