import { describe, it, expect } from 'vitest';
import { createPageTools, type PageState, type ComponentInfo } from '@/lib/ai/page-tools';

const catalog: ComponentInfo[] = [
  { name: 'HeroPanel', label: 'Hero', category: 'Landing' },
  { name: 'FaqAccordion', label: 'FAQ', category: 'Landing' },
  { name: 'StoreHeader', label: 'Nav', category: 'Landing' },
  { name: 'PageFooter', label: 'Footer', category: 'Landing' },
];

function makeState(): PageState {
  return {
    root: { maxWidth: '1080' },
    content: [
      { type: 'HeroPanel', props: { headline: 'Hi' } },
      { type: 'FaqAccordion', props: { title: 'Q&A' } },
    ],
  };
}

const ctx = { messages: [] } as any;

describe('createPageTools', () => {
  it('getAvailableComponents returns the catalog', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const result = await tools.getAvailableComponents.execute!({}, ctx);
    expect(result).toEqual(catalog);
  });

  it('getPageState returns root, indexed content, and count', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const result: any = await tools.getPageState.execute!({}, ctx);
    expect(result.root).toEqual({ maxWidth: '1080' });
    expect(result.count).toBe(2);
    expect(result.content[0]).toEqual({ index: 0, type: 'HeroPanel', props: { headline: 'Hi' }, validPropNames: [], schema: undefined });
    expect(result.content[1]).toEqual({ index: 1, type: 'FaqAccordion', props: { title: 'Q&A' }, validPropNames: [], schema: undefined });
  });

  it('addComponent inserts at the given index', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    const r: any = await tools.addComponent.execute!(
      { type: 'StoreHeader', index: 1, props: { logoText: 'Acme' } },
      ctx,
    );
    expect(r.newCount).toBe(3);
    expect(getPageState().content.map((c) => c.type)).toEqual([
      'HeroPanel',
      'StoreHeader',
      'FaqAccordion',
    ]);
    expect(getPageState().content[1].props).toEqual({ logoText: 'Acme' });
  });

  it('addComponent appends when index is past the end', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    await tools.addComponent.execute!({ type: 'PageFooter', index: 999 }, ctx);
    const content = getPageState().content;
    expect(content[content.length - 1].type).toBe('PageFooter');
    expect(content).toHaveLength(3);
  });

  it('addComponent defaults props to an empty object when omitted', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    await tools.addComponent.execute!({ type: 'PageFooter', index: 0 }, ctx);
    expect(getPageState().content[0]).toEqual({ type: 'PageFooter', props: {} });
  });

  it('removeComponent deletes by index', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    const r: any = await tools.removeComponent.execute!({ index: 0 }, ctx);
    expect(r.removedItem.type).toBe('HeroPanel');
    expect(r.removed).toBe(1);
    expect(r.newCount).toBe(1);
    expect(getPageState().content).toHaveLength(1);
    expect(getPageState().content[0].type).toBe('FaqAccordion');
  });

  it('removeComponent returns error for out-of-bounds index', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const r: any = await tools.removeComponent.execute!({ index: 99 }, ctx);
    expect(r.error).toMatch(/out of bounds/);
  });

  it('removeComponent returns error for negative index', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const r: any = await tools.removeComponent.execute!({ index: -1 }, ctx);
    expect(r.error).toMatch(/out of bounds/);
  });

  it('updateComponent merges props', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    const r: any = await tools.updateComponent.execute!(
      { index: 0, props: { subhead: 'Hello' } },
      ctx,
    );
    expect(r.updated.index).toBe(0);
    expect(r.updated.changedFields).toEqual(['subhead']);
    expect(getPageState().content[0].props).toEqual({ headline: 'Hi', subhead: 'Hello' });
  });

  it('updateComponent rejects out-of-bounds index', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const r: any = await tools.updateComponent.execute!({ index: 99, props: {} }, ctx);
    expect(r.error).toMatch(/out of bounds/);
  });

  it('reorderComponents moves an item forward', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    const r: any = await tools.reorderComponents.execute!(
      { fromIndex: 0, toIndex: 2 },
      ctx,
    );
    expect(r.moved.type).toBe('HeroPanel');
    expect(getPageState().content.map((c) => c.type)).toEqual(['FaqAccordion', 'HeroPanel']);
  });

  it('reorderComponents moves an item backward', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    await tools.reorderComponents.execute!({ fromIndex: 1, toIndex: 0 }, ctx);
    expect(getPageState().content.map((c) => c.type)).toEqual(['FaqAccordion', 'HeroPanel']);
  });

  it('reorderComponents rejects out-of-bounds fromIndex', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const r: any = await tools.reorderComponents.execute!(
      { fromIndex: 99, toIndex: 0 },
      ctx,
    );
    expect(r.error).toMatch(/fromIndex/);
  });

  it('reorderComponents rejects out-of-bounds toIndex', async () => {
    const { tools } = createPageTools(makeState(), catalog);
    const r: any = await tools.reorderComponents.execute!(
      { fromIndex: 0, toIndex: 99 },
      ctx,
    );
    expect(r.error).toMatch(/toIndex/);
  });

  it('setRootProps merges into root', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    const r: any = await tools.setRootProps.execute!(
      { props: { fontFamily: 'Inter' } },
      ctx,
    );
    expect(r.root).toEqual({ maxWidth: '1080', fontFamily: 'Inter' });
    expect(getPageState().root).toEqual({ maxWidth: '1080', fontFamily: 'Inter' });
  });

  it('setRootProps overwrites existing keys', async () => {
    const { tools, getPageState } = createPageTools(makeState(), catalog);
    await tools.setRootProps.execute!({ props: { maxWidth: '1280' } }, ctx);
    expect(getPageState().root.maxWidth).toBe('1280');
  });

  it('initial state is cloned, not referenced', async () => {
    const original = makeState();
    const { tools, getPageState } = createPageTools(original, catalog);
    await tools.addComponent.execute!({ type: 'PageFooter', index: 0 }, ctx);
    expect(original.content).toHaveLength(2);
    expect(getPageState().content).toHaveLength(3);
  });
});
