import { describe, it, expect } from 'vitest';
import { PageValidator } from './page-validator';
import type { PuckDocument } from '../value-objects/puck-document';
import type { ComponentSchema } from './page-validator';

const schemas: ComponentSchema[] = [
  { type: 'HeroPanel', allowedZones: ['root'], requiredProps: ['title'] },
  { type: 'RichTextBlock', allowedZones: ['b1:col'], requiredProps: [] },
];

const validDoc: PuckDocument = {
  root: { props: {} },
  content: [{ type: 'HeroPanel', props: { id: 'b1', title: 'Hi' } }],
  zones: { 'b1:col': [{ type: 'RichTextBlock', props: { id: 'b2' } }] },
};

describe('PageValidator', () => {
  const sut = new PageValidator();

  it('passes a well-formed, schema-satisfying, bound document', () => {
    const result = sut.validate(validDoc, schemas, { bindings: [], validRefs: new Set() });
    expect(result.ok).toBe(true);
  });

  it('fails when a block references an unregistered component', () => {
    const doc = { ...validDoc, content: [{ type: 'Ghost', props: { id: 'g' } }] };
    const result = sut.validate(doc, schemas, { bindings: [], validRefs: new Set() });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /unregistered|unknown component/i.test(i))).toBe(true);
  });

  it('fails when a required prop is missing', () => {
    const doc = { ...validDoc, content: [{ type: 'HeroPanel', props: { id: 'b1' } }] };
    const result = sut.validate(doc, schemas, { bindings: [], validRefs: new Set() });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /required prop "title"/i.test(i))).toBe(true);
  });

  it('fails when a block sits in a disallowed zone (orphan/zone violation)', () => {
    const doc = {
      root: { props: {} },
      content: [{ type: 'RichTextBlock', props: { id: 'b2' } }],
      zones: {},
    };
    const result = sut.validate(doc, schemas, { bindings: [], validRefs: new Set() });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /zone/i.test(i))).toBe(true);
  });

  it('fails when a binding references an externalRef not in validRefs', () => {
    const result = sut.validate(validDoc, schemas, {
      bindings: [{ kind: 'VariantRef', externalRef: 'missing' }],
      validRefs: new Set(['present']),
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /binding/i.test(i))).toBe(true);
  });
});
