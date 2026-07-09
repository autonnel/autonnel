import type { PuckDocument } from './value-objects/puck-document';
import type { Binding } from './value-objects/binding';
import type { SeoMeta } from './value-objects/seo-meta';
import type { PublishState } from './value-objects/publish-state';
import type { ValidationResult } from './services/page-validator';
import { PageValidationError } from './errors';

// The application layer enriches this into a DomainEventEnvelope (eventId/tenantId/occurredAt/correlation) at the seam.
export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
}

export type PageType = 'checkout' | 'thankyou' | 'upsell' | 'error' | 'custom';

interface PageState {
  id: string;
  slug: string;
  type: PageType;
  draftDocument: PuckDocument | null;
  draftBindings: Binding[];
  seo: SeoMeta;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  publishState: PublishState;
}

export class Page {
  private constructor(private state: PageState) {}

  static create(input: { id: string; slug: string; type: PageType }): Page {
    return new Page({
      id: input.id,
      slug: input.slug,
      type: input.type,
      draftDocument: null,
      draftBindings: [],
      seo: {},
      draftRevisionId: null,
      publishedRevisionId: null,
      publishState: 'draft',
    });
  }

  static rehydrate(state: PageState): Page {
    return new Page(state);
  }

  get id() { return this.state.id; }
  get slug() { return this.state.slug; }
  get type() { return this.state.type; }
  get publishState() { return this.state.publishState; }
  get publishedRevisionId() { return this.state.publishedRevisionId; }
  get draftRevisionId() { return this.state.draftRevisionId; }
  get draftDocument() { return this.state.draftDocument; }
  get draftBindings() { return this.state.draftBindings; }

  saveDraft(document: PuckDocument, bindings: Binding[], ctx: { newRevisionId: string }): DomainEvent[] {
    this.state.draftDocument = document;
    this.state.draftBindings = bindings;
    this.state.draftRevisionId = ctx.newRevisionId;
    if (this.state.publishState === 'published') this.state.publishState = 'draft_ahead';
    return [
      { type: 'PageRevisionSaved', payload: { pageId: this.id, revisionId: ctx.newRevisionId } },
    ];
  }

  publish(ctx: { validation: ValidationResult; publishedRevisionId: string }): DomainEvent[] {
    if (!ctx.validation.ok) throw new PageValidationError(ctx.validation.issues);
    this.state.publishedRevisionId = ctx.publishedRevisionId;
    this.state.publishState = 'published';
    return [{ type: 'PagePublished', payload: { pageId: this.id, revisionId: ctx.publishedRevisionId } }];
  }

  unpublish(): DomainEvent[] {
    this.state.publishState = 'draft';
    this.state.publishedRevisionId = null;
    return [{ type: 'PageUnpublished', payload: { pageId: this.id } }];
  }
}
