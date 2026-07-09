import { describe, it, expect } from 'vitest';
import { createPageTools, type ComponentInfo } from './page-tools';

const catalog: ComponentInfo[] = [
  {
    name: 'ReviewList',
    label: 'Review List',
    category: 'landing',
    defaultProps: { sectionTitle: { text: '' }, reviews: [], columns: 3 },
    arrayItemKeys: { reviews: ['author', 'country', 'content', 'rating', 'avatarImage'] },
  },
];

function makeTools() {
  return createPageTools({ root: {}, content: [] }, catalog).tools as Record<string, any>;
}

describe('page-tools prop validation', () => {
  it('warns on unknown top-level props in addComponent', async () => {
    const tools = makeTools();
    const res = await tools.addComponent.execute({
      type: 'ReviewList',
      index: 0,
      props: { headline: 'nope', reviews: [] },
    });
    expect(res.warning).toMatch(/headline/);
    expect(res.warning).toMatch(/sectionTitle/);
  });

  it('warns on unknown array item keys in addComponent', async () => {
    const tools = makeTools();
    const res = await tools.addComponent.execute({
      type: 'ReviewList',
      index: 0,
      props: { reviews: [{ name: 'Sarah', text: 'Great', rating: 5 }] },
    });
    expect(res.warning).toMatch(/reviews\[\]/);
    expect(res.warning).toMatch(/name, text/);
    expect(res.warning).toMatch(/author/);
  });

  it('warns on unknown array item keys in updateComponent', async () => {
    const tools = makeTools();
    await tools.addComponent.execute({ type: 'ReviewList', index: 0, props: {} });
    const res = await tools.updateComponent.execute({
      index: 0,
      props: { reviews: [{ author: 'Sarah', text: 'wrong key' }] },
    });
    expect(res.warning).toMatch(/text/);
  });

  it('stays silent for valid props and item keys', async () => {
    const tools = makeTools();
    const res = await tools.addComponent.execute({
      type: 'ReviewList',
      index: 0,
      props: { columns: 2, reviews: [{ author: 'Sarah', content: 'Great', rating: 5 }] },
    });
    expect(res.warning).toBeUndefined();
  });
});
