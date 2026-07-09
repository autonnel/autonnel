import { describe, it, expect } from 'vitest';
import { buildKonjuraCanvasUrl } from '@/components/builder/MediaField/KonjuraCard';

describe('buildKonjuraCanvasUrl', () => {
  it('always includes source=autonnel', () => {
    const url = new URL(buildKonjuraCanvasUrl({ prompt: '', referenceImageUrl: '', mediaType: 'image' }));
    expect(url.searchParams.get('source')).toBe('autonnel');
  });

  it('encodes prompt text', () => {
    const url = new URL(buildKonjuraCanvasUrl({ prompt: 'a cat & dog', referenceImageUrl: '', mediaType: 'image' }));
    expect(url.searchParams.get('prompt')).toBe('a cat & dog');
  });

  it('includes refImage only when set', () => {
    const without = new URL(buildKonjuraCanvasUrl({ prompt: 'p', referenceImageUrl: '', mediaType: 'image' }));
    expect(without.searchParams.has('refImage')).toBe(false);
    const withImg = new URL(buildKonjuraCanvasUrl({ prompt: 'p', referenceImageUrl: 'https://cdn/x.png', mediaType: 'image' }));
    expect(withImg.searchParams.get('refImage')).toBe('https://cdn/x.png');
  });

  it('propagates mediaType', () => {
    expect(new URL(buildKonjuraCanvasUrl({ prompt: 'p', referenceImageUrl: '', mediaType: 'video' })).searchParams.get('type')).toBe('video');
    expect(new URL(buildKonjuraCanvasUrl({ prompt: 'p', referenceImageUrl: '', mediaType: 'image' })).searchParams.get('type')).toBe('image');
  });

  it('uses the konjura.com canvas origin and path', () => {
    const url = new URL(buildKonjuraCanvasUrl({ prompt: 'p', referenceImageUrl: '', mediaType: 'image' }));
    expect(url.origin).toBe('https://konjura.com');
    expect(url.pathname).toBe('/canvas');
  });

  it('omits empty prompt parameter', () => {
    const url = new URL(buildKonjuraCanvasUrl({ prompt: '', referenceImageUrl: '', mediaType: 'image' }));
    expect(url.searchParams.has('prompt')).toBe(false);
  });
});
