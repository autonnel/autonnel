import { describe, it, expect } from 'vitest';
import { isWellFormedDocument } from './puck-document';
import type { PuckDocument } from './puck-document';

const doc: PuckDocument = {
  root: { props: { title: 'Home' } },
  content: [{ type: 'HeroPanel', props: { id: 'b1' } }],
  zones: { 'b1:col': [{ type: 'RichTextBlock', props: { id: 'b2' } }] },
};

describe('PuckDocument', () => {
  it('accepts a well-formed document with root, content, zones', () => {
    expect(isWellFormedDocument(doc)).toBe(true);
  });
  it('rejects a document missing root', () => {
    expect(isWellFormedDocument({ content: [], zones: {} } as unknown)).toBe(false);
  });
  it('rejects a block without a type', () => {
    const bad = { root: { props: {} }, content: [{ props: {} }], zones: {} };
    expect(isWellFormedDocument(bad as unknown)).toBe(false);
  });
  it('rejects a block without an id in props', () => {
    const bad = { root: { props: {} }, content: [{ type: 'X', props: {} }], zones: {} };
    expect(isWellFormedDocument(bad as unknown)).toBe(false);
  });
});
