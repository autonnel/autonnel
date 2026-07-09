import { type ComponentLike } from './common';

const LINK_TRAITS = [
  { type: 'text', name: 'href', label: 'URL', placeholder: 'https://...' },
  {
    type: 'select',
    name: 'target',
    label: 'Target',
    options: [
      { id: '', name: 'Same tab (_self)' },
      { id: '_blank', name: 'New tab (_blank)' },
      { id: '_parent', name: 'Parent frame (_parent)' },
      { id: '_top', name: 'Top frame (_top)' },
    ],
  },
  {
    type: 'select',
    name: 'rel',
    label: 'Rel',
    options: [
      { id: '', name: 'None' },
      { id: 'noopener', name: 'noopener' },
      { id: 'noopener noreferrer', name: 'noopener noreferrer' },
      { id: 'nofollow', name: 'nofollow' },
      { id: 'sponsored', name: 'sponsored' },
      { id: 'ugc', name: 'ugc' },
    ],
  },
  { type: 'text', name: 'title', label: 'Title' },
  { type: 'text', name: 'download', label: 'Download (filename)' },
];

function ensureLinkTraits(component: ComponentLike): boolean {
  let added = false;
  for (const spec of LINK_TRAITS) {
    if (!component.getTrait(spec.name)) {
      component.addTrait(spec);
      added = true;
    }
  }
  return added;
}

export function registerLinkTraits(editor: any): void {
  editor.DomComponents.addType('link', {
    model: {
      init() {
        ensureLinkTraits(this as unknown as ComponentLike);
      },
    },
  });

  editor.on('component:selected', (component: any) => {
    if (!component) return;
    const type = component.get('type');
    const tagName = (component.get('tagName') || '').toLowerCase();
    if (type === 'link' || tagName === 'a') {
      const added = ensureLinkTraits(component);
      if (added) Promise.resolve().then(() => component.trigger('change:traits'));
    }
  });
}
