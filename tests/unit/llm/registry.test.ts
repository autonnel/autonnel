import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTextProvider,
  getTextProvider,
  listTextProviders,
  registerImageProvider,
  getImageProvider,
  registerVideoProvider,
  getVideoProvider,
  __resetRegistry,
} from '@/lib/llm/registry';
import { UnknownProviderError } from '@/lib/llm/errors';
import type { TextProvider, ImageProvider, VideoProvider } from '@/lib/llm/types';

const textP: TextProvider = { id: 'p1', generateText: async () => ({ content: '' }) };
const imageP: ImageProvider = { id: 'i1', generateImage: async () => [] };
const videoP: VideoProvider = {
  id: 'v1',
  createJob: async () => ({ id: '1' }),
  getJob: async () => ({ id: '1', status: 'queued' }),
};

beforeEach(() => __resetRegistry());

describe('registry', () => {
  it('registers and retrieves a text provider', () => {
    registerTextProvider(textP);
    expect(getTextProvider('p1')).toBe(textP);
  });

  it('lists registered text providers', () => {
    registerTextProvider(textP);
    expect(listTextProviders().map((p) => p.id)).toEqual(['p1']);
  });

  it('throws UnknownProviderError when text provider id is unknown', () => {
    expect(() => getTextProvider('missing')).toThrow(UnknownProviderError);
  });

  it('throws when registering same text provider id twice', () => {
    registerTextProvider(textP);
    expect(() => registerTextProvider(textP)).toThrow(/already registered/);
  });

  it('separates text / image / video namespaces', () => {
    registerTextProvider({ ...textP, id: 'shared' });
    registerImageProvider({ ...imageP, id: 'shared' });
    registerVideoProvider({ ...videoP, id: 'shared' });
    expect(getTextProvider('shared').id).toBe('shared');
    expect(getImageProvider('shared').id).toBe('shared');
    expect(getVideoProvider('shared').id).toBe('shared');
  });

  it('throws UnknownProviderError carrying kind metadata', () => {
    try {
      getVideoProvider('nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownProviderError);
      expect((err as UnknownProviderError).kind).toBe('video');
      expect((err as UnknownProviderError).providerId).toBe('nope');
    }
  });
});
