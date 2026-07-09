type Dict = Record<string, any>;

const SCALAR_MEDIA_KEYS = new Set([
  'productImage',
  'backgroundImage',
  'image',
  'expertImage',
  'shippingImage',
]);

const LIST_MEDIA_KEYS: Dict = {
  steps: 'image',
  images: 'image',
  ingredients: 'image',
};

const DEEP_LIST_MEDIA_KEYS: Record<string, [string, string]> = {
  reviews: ['images', 'image'],
};

const isPlainObject = (v: any): boolean =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function blendMedia(prev: any, next: any): any {
  if (!next || typeof next !== 'object') return prev || next;
  return {
    url: prev?.url || next.url || '',
    prompt: next.prompt || prev?.prompt || '',
    mediaType: next.mediaType || prev?.mediaType || 'image',
  };
}

function blendLeaf(prev: Dict, next: Dict, field: string): Dict {
  const out = { ...next };
  if (next[field] && typeof next[field] === 'object') {
    out[field] = blendMedia(prev[field], next[field]);
  }
  return out;
}

export function mergePropsWithMediaPreservation(existingProps: any, newContent: any): any {
  const result: Dict = { ...existingProps, _generated: true };

  for (const key of Object.keys(newContent)) {
    const incoming = newContent[key];

    if (SCALAR_MEDIA_KEYS.has(key) && isPlainObject(incoming)) {
      result[key] = blendMedia(existingProps[key], incoming);
      continue;
    }

    if (Array.isArray(incoming) && key in LIST_MEDIA_KEYS) {
      const field = LIST_MEDIA_KEYS[key];
      const prevList: any[] = existingProps[key] || [];
      result[key] = incoming.map((entry, i) => blendLeaf(prevList[i] || {}, entry, field));
      continue;
    }

    if (Array.isArray(incoming) && key in DEEP_LIST_MEDIA_KEYS) {
      const [innerKey, field] = DEEP_LIST_MEDIA_KEYS[key];
      const prevList: any[] = existingProps[key] || [];
      result[key] = incoming.map((parent, i) => {
        const merged: Dict = { ...parent };
        if (Array.isArray(parent[innerKey])) {
          const prevInner: any[] = (prevList[i] || {})[innerKey] || [];
          merged[innerKey] = parent[innerKey].map((child: any, j: number) =>
            blendLeaf(prevInner[j] || {}, child, field),
          );
        }
        return merged;
      });
      continue;
    }

    result[key] = incoming;
  }

  return result;
}
