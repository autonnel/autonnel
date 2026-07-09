import { describe, it, expect } from 'vitest';
import { collectPendingMedia, applyMediaUrlToData } from './pending-media';

const media = (prompt: string, url = '') => ({ url, prompt, mediaType: 'image' });

describe('collectPendingMedia', () => {
  it('finds scalar and nested list media slots with a prompt but no url', () => {
    const content = [
      {
        type: 'HeroPanel',
        props: {
          id: 'hero1',
          backgroundImage: media('spa scene'),
          productImage: media('bottle shot'),
          title: { text: 'Hello' },
        },
      },
      {
        type: 'HowToSteps',
        props: {
          id: 'steps1',
          steps: [
            { label: 'Step 1', image: media('applying serum') },
            { label: 'Step 2', image: { url: 'https://cdn/x.png', prompt: 'done already' } },
          ],
        },
      },
    ];

    const items = collectPendingMedia(content);
    expect(items.map((i) => i.key)).toEqual([
      '0:backgroundImage',
      '0:productImage',
      '1:steps.0.image',
    ]);
    expect(items[0].componentId).toBe('hero1');
    expect(items[0].componentType).toBe('HeroPanel');
    expect(items[2].fieldPath).toEqual(['steps', 0, 'image']);
  });

  it('skips values without prompts and non-media objects', () => {
    const content = [
      {
        type: 'PageFooter',
        props: {
          id: 'f1',
          link: { type: 'custom', url: 'https://x.com' },
          logo: { url: '', prompt: '' },
        },
      },
    ];
    expect(collectPendingMedia(content)).toEqual([]);
  });

  it('derives aspect ratio from value first, then key heuristics', () => {
    const content = [
      {
        type: 'HeroPanel',
        props: {
          id: 'h',
          backgroundImage: media('wide scene'),
          avatarImage: media('face'),
          productImage: { ...media('bottle'), generationAspectRatio: '3:2' },
        },
      },
    ];
    const byKey = Object.fromEntries(collectPendingMedia(content).map((i) => [i.fieldPath.join('.'), i.aspectRatio]));
    expect(byKey['backgroundImage']).toBe('16:9');
    expect(byKey['avatarImage']).toBe('1:1');
    expect(byKey['productImage']).toBe('3:2');
  });
});

describe('applyMediaUrlToData', () => {
  const buildData = () => ({
    root: { props: {} },
    content: [
      { type: 'NoticeBar', props: { id: 'n1', text: { text: 'hi' } } },
      {
        type: 'HowToSteps',
        props: {
          id: 's1',
          steps: [{ label: 'One', image: media('step pic') }],
        },
      },
    ],
  });

  it('patches the url at a nested path and applies display ratio', () => {
    const data = buildData();
    const [item] = collectPendingMedia(data.content);
    const next = applyMediaUrlToData(data, item, 'https://cdn/generated.png');

    const patched = (next.content![1].props as any).steps[0].image;
    expect(patched.url).toBe('https://cdn/generated.png');
    expect(patched.displayRatio).toBe(item.aspectRatio);
    expect((data.content[1] as any).props.steps[0].image.url).toBe('');
  });

  it('locates the component by id after a reorder', () => {
    const data = buildData();
    const [item] = collectPendingMedia(data.content);
    const reordered = { ...data, content: [data.content[1], data.content[0]] };

    const next = applyMediaUrlToData(reordered, item, 'https://cdn/g.png');
    expect((next.content![0].props as any).steps[0].image.url).toBe('https://cdn/g.png');
  });

  it('leaves data untouched when the component vanished', () => {
    const data = buildData();
    const [item] = collectPendingMedia(data.content);
    const removed = { ...data, content: [data.content[0]] };
    expect(applyMediaUrlToData(removed, item, 'https://cdn/g.png')).toBe(removed);
  });
});
