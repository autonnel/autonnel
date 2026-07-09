import { describe, it, expect } from 'vitest';
import { Page } from './page';
import { PageValidationError } from './errors';
import type { PuckDocument } from './value-objects/puck-document';

const doc: PuckDocument = { root: { props: {} }, content: [], zones: {} };

function newPage() {
  return Page.create({ id: 'p1', slug: 'home', type: 'custom' });
}

describe('Page', () => {
  it('starts in draft with no published revision', () => {
    const page = newPage();
    expect(page.publishState).toBe('draft');
    expect(page.publishedRevisionId).toBeNull();
  });

  it('saves a draft revision and emits PageRevisionSaved', () => {
    const page = newPage();
    const events = page.saveDraft(doc, [], { newRevisionId: 'r1' });
    expect(page.draftRevisionId).toBe('r1');
    expect(events.map((e) => e.type)).toContain('PageRevisionSaved');
  });

  it('publishes only when validation passed, pinning publishedRevisionId', () => {
    const page = newPage();
    page.saveDraft(doc, [], { newRevisionId: 'r1' });
    const events = page.publish({ validation: { ok: true, issues: [] }, publishedRevisionId: 'r1' });
    expect(page.publishState).toBe('published');
    expect(page.publishedRevisionId).toBe('r1');
    expect(events.map((e) => e.type)).toContain('PagePublished');
  });

  it('refuses to publish when validation failed', () => {
    const page = newPage();
    page.saveDraft(doc, [], { newRevisionId: 'r1' });
    expect(() =>
      page.publish({ validation: { ok: false, issues: ['bad'] }, publishedRevisionId: 'r1' }),
    ).toThrow(PageValidationError);
  });

  it('marks draft_ahead when edited after publishing', () => {
    const page = newPage();
    page.saveDraft(doc, [], { newRevisionId: 'r1' });
    page.publish({ validation: { ok: true, issues: [] }, publishedRevisionId: 'r1' });
    page.saveDraft(doc, [], { newRevisionId: 'r2' });
    expect(page.publishState).toBe('draft_ahead');
  });
});
