import { UnknownProviderError } from './errors';
import type { ImageProvider, TextProvider, VideoProvider } from './types';

const text = new Map<string, TextProvider>();
const image = new Map<string, ImageProvider>();
const video = new Map<string, VideoProvider>();

function register<T extends { id: string }>(
  store: Map<string, T>,
  kind: 'text' | 'image' | 'video',
  p: T,
): void {
  if (store.has(p.id)) {
    throw new Error(`${kind} provider "${p.id}" already registered`);
  }
  store.set(p.id, p);
}

function get<T>(store: Map<string, T>, kind: 'text' | 'image' | 'video', id: string): T {
  const p = store.get(id);
  if (!p) throw new UnknownProviderError(kind, id);
  return p;
}

export const registerTextProvider = (p: TextProvider): void => register(text, 'text', p);
export const getTextProvider = (id: string): TextProvider => get(text, 'text', id);
export const listTextProviders = (): TextProvider[] => [...text.values()];

export const registerImageProvider = (p: ImageProvider): void => register(image, 'image', p);
export const getImageProvider = (id: string): ImageProvider => get(image, 'image', id);
export const listImageProviders = (): ImageProvider[] => [...image.values()];

export const registerVideoProvider = (p: VideoProvider): void => register(video, 'video', p);
export const getVideoProvider = (id: string): VideoProvider => get(video, 'video', id);
export const listVideoProviders = (): VideoProvider[] => [...video.values()];

export const __resetRegistry = (): void => {
  text.clear();
  image.clear();
  video.clear();
};
