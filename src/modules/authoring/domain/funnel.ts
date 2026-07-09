import type { DomainEvent } from './page';
import type { Transition } from './value-objects/routing-rule';
import type { PublishState } from './value-objects/publish-state';
import type { PinnedPage } from './services/publication-assembler';

interface Step { stepSlug: string; pageId: string; }

interface FunnelState {
  id: string;
  name: string;
  steps: Step[];
  transitions: Transition[];
  publishState: PublishState;
  publishedPinnedPages: PinnedPage[];
  publishedVersion: number | null;
}

export class Funnel {
  private constructor(private state: FunnelState) {}

  static create(input: { id: string; name: string }): Funnel {
    return new Funnel({
      id: input.id,
      name: input.name,
      steps: [],
      transitions: [],
      publishState: 'draft',
      publishedPinnedPages: [],
      publishedVersion: null,
    });
  }

  static rehydrate(state: FunnelState): Funnel {
    return new Funnel(state);
  }

  get id() { return this.state.id; }
  get entryStepSlug() { return this.state.steps[0]?.stepSlug ?? null; }
  get steps(): readonly Step[] { return this.state.steps; }
  get transitions(): readonly Transition[] { return this.state.transitions; }
  get publishState() { return this.state.publishState; }
  get publishedPinnedPages() { return this.state.publishedPinnedPages; }

  addStep(step: Step): DomainEvent[] {
    if (this.state.steps.some((s) => s.stepSlug === step.stepSlug)) {
      throw new Error(`stepSlug must be unique within funnel: "${step.stepSlug}"`);
    }
    this.state.steps.push(step);
    return this.markStructureChanged();
  }

  // Steps are identified by the page they reference (unique within a funnel). An orphaned step
  // whose page was deleted still carries that pageId, so it stays removable/replaceable here.
  removeStep(pageId: string): DomainEvent[] {
    const remaining = this.state.steps.filter((s) => s.pageId !== pageId);
    if (remaining.length === this.state.steps.length) {
      throw new Error(`No step references page: ${pageId}`);
    }
    this.state.steps = remaining;
    return this.markStructureChanged();
  }

  replaceStepPage(input: { fromPageId: string; toPageId: string }): DomainEvent[] {
    const step = this.state.steps.find((s) => s.pageId === input.fromPageId);
    if (!step) throw new Error(`No step references page: ${input.fromPageId}`);
    step.pageId = input.toPageId;
    return this.markStructureChanged();
  }

  setStepSlug(input: { pageId: string; stepSlug: string }): DomainEvent[] {
    const step = this.state.steps.find((s) => s.pageId === input.pageId);
    if (!step) throw new Error(`No step references page: ${input.pageId}`);
    if (this.state.steps.some((s) => s !== step && s.stepSlug === input.stepSlug)) {
      throw new Error(`stepSlug must be unique within funnel: "${input.stepSlug}"`);
    }
    step.stepSlug = input.stepSlug;
    return this.markStructureChanged();
  }

  private markStructureChanged(): DomainEvent[] {
    if (this.state.publishState === 'published') this.state.publishState = 'draft_ahead';
    return [{ type: 'FunnelStructureChanged', payload: { funnelId: this.id } }];
  }
}
