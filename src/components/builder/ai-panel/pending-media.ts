import type { PendingMediaItem } from '@/components/ai-panel/media-autogen';
import { resolveGenerationParams } from '../MediaField/generation';
import type { MediaFieldValue } from '../MediaField';

type Dict = Record<string, any>;
interface ContentEntry {
  type: string;
  props?: Dict;
}
interface PuckLikeData {
  content?: ContentEntry[];
  root?: { props?: Dict };
  [k: string]: unknown;
}

function isPlainObject(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPendingMediaValue(v: unknown): v is Dict {
  return (
    isPlainObject(v) &&
    typeof v.url === 'string' &&
    v.url.trim() === '' &&
    typeof v.prompt === 'string' &&
    v.prompt.trim() !== ''
  );
}

function aspectForSlot(key: string, value: Dict): string {
  if (typeof value.generationAspectRatio === 'string' && value.generationAspectRatio) {
    return value.generationAspectRatio;
  }
  if (typeof value.displayRatio === 'string' && value.displayRatio) {
    return value.displayRatio;
  }
  const k = key.toLowerCase();
  if (k.includes('background')) return '16:9';
  if (k.includes('avatar') || k.includes('icon') || k.includes('logo')) return '1:1';
  return '4:5';
}

export function collectPendingMedia(content: ContentEntry[]): PendingMediaItem[] {
  const items: PendingMediaItem[] = [];

  content.forEach((entry, componentIndex) => {
    const componentId = typeof entry.props?.id === 'string' ? entry.props.id : null;

    const walk = (node: unknown, path: Array<string | number>) => {
      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, [...path, i]));
        return;
      }
      if (!isPlainObject(node)) return;
      for (const [key, value] of Object.entries(node)) {
        if (isPendingMediaValue(value)) {
          const fieldPath = [...path, key];
          items.push({
            key: `${componentIndex}:${fieldPath.join('.')}`,
            componentId,
            componentIndex,
            componentType: entry.type,
            fieldPath,
            label: `${entry.type} · ${fieldPath.join('.')}`,
            prompt: (value.prompt as string).trim(),
            mediaType: value.mediaType === 'video' ? 'video' : 'image',
            referenceImageUrl:
              typeof value.referenceImageUrl === 'string' && value.referenceImageUrl
                ? value.referenceImageUrl
                : undefined,
            aspectRatio: aspectForSlot(key, value),
          });
        } else if (Array.isArray(value) || isPlainObject(value)) {
          walk(value, [...path, key]);
        }
      }
    };

    walk(entry.props ?? {}, []);
  });

  return items;
}

function setAtPath(node: Dict, path: Array<string | number>, update: (leaf: Dict) => Dict): Dict {
  if (path.length === 0) return node;
  const [head, ...rest] = path;

  if (Array.isArray(node)) {
    const idx = typeof head === 'number' ? head : Number(head);
    if (!(idx >= 0 && idx < node.length)) return node;
    const next = [...node];
    next[idx] =
      rest.length === 0
        ? (isPlainObject(next[idx]) ? update(next[idx]) : next[idx])
        : setAtPath(next[idx], rest, update);
    return next as unknown as Dict;
  }

  if (!isPlainObject(node)) return node;
  const k = String(head);
  if (!(k in node)) return node;
  return {
    ...node,
    [k]:
      rest.length === 0
        ? (isPlainObject(node[k]) ? update(node[k]) : node[k])
        : setAtPath(node[k], rest, update),
  };
}

// Locate by component id first: the user may reorder or insert components while
// generation is still in flight, which invalidates the captured index.
function findComponentIndex(content: ContentEntry[], item: PendingMediaItem): number {
  if (item.componentId) {
    const byId = content.findIndex((c) => c.props?.id === item.componentId);
    if (byId !== -1) return byId;
  }
  const candidate = content[item.componentIndex];
  if (candidate && candidate.type === item.componentType) return item.componentIndex;
  return -1;
}

export function applyMediaUrlToData<T extends PuckLikeData>(
  data: T,
  item: PendingMediaItem,
  url: string,
): T {
  const content = data.content ?? [];
  const idx = findComponentIndex(content, item);
  if (idx === -1) return data;

  const entry = content[idx];
  const nextProps = setAtPath(entry.props ?? {}, item.fieldPath, (leaf) => {
    const merged = { ...leaf, url } as MediaFieldValue;
    const { updatedValue } = resolveGenerationParams(merged, item.aspectRatio);
    return { ...updatedValue, url };
  });

  const nextContent = [...content];
  nextContent[idx] = { ...entry, props: nextProps };
  return { ...data, content: nextContent };
}
