import type { ComponentLike } from './common';

const VIDEO_TRAITS = [
  { type: 'text', name: 'src', label: 'Source URL' },
  { type: 'text', name: 'poster', label: 'Poster URL' },
  { type: 'checkbox', name: 'controls', label: 'Controls' },
  { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
  { type: 'checkbox', name: 'loop', label: 'Loop' },
  { type: 'checkbox', name: 'muted', label: 'Muted' },
  {
    type: 'select',
    name: 'preload',
    label: 'Preload',
    options: [
      { id: 'auto', name: 'auto' },
      { id: 'metadata', name: 'metadata' },
      { id: 'none', name: 'none' },
    ],
  },
];

const AUDIO_TRAITS = VIDEO_TRAITS.filter((t) => t.name !== 'poster');

const SOURCE_TRAITS = [
  { type: 'text', name: 'src', label: 'Source URL' },
  { type: 'text', name: 'type', label: 'MIME type', placeholder: 'video/mp4' },
  { type: 'text', name: 'media', label: 'Media query' },
];

function ensure(component: ComponentLike, specs: typeof VIDEO_TRAITS): boolean {
  let added = false;
  for (const spec of specs) {
    if (!component.getTrait(spec.name)) {
      component.addTrait(spec);
      added = true;
    }
  }
  return added;
}

export function registerMediaTraits(editor: any): void {
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    const tagName = (component.get('tagName') || '').toLowerCase();
    let added = false;
    if (tagName === 'video') added = ensure(component, VIDEO_TRAITS);
    else if (tagName === 'audio') added = ensure(component, AUDIO_TRAITS);
    else if (tagName === 'source') added = ensure(component, SOURCE_TRAITS);
    if (added) Promise.resolve().then(() => component.trigger('change:traits'));
  });
}
