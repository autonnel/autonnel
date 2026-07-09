const IFRAME_TRAITS = [
  { type: 'text', name: 'src', label: 'Source URL' },
  { type: 'text', name: 'title', label: 'Title' },
  { type: 'text', name: 'sandbox', label: 'Sandbox', placeholder: 'allow-scripts allow-same-origin' },
  { type: 'text', name: 'allow', label: 'Allow', placeholder: 'autoplay; fullscreen' },
  {
    type: 'select',
    name: 'loading',
    label: 'Loading',
    options: [
      { id: 'eager', name: 'eager' },
      { id: 'lazy', name: 'lazy' },
    ],
  },
  {
    type: 'select',
    name: 'referrerpolicy',
    label: 'Referrer policy',
    options: [
      { id: '', name: '(default)' },
      { id: 'no-referrer', name: 'no-referrer' },
      { id: 'origin', name: 'origin' },
      { id: 'strict-origin', name: 'strict-origin' },
      { id: 'unsafe-url', name: 'unsafe-url' },
    ],
  },
];

export function registerIframeTraits(editor: any): void {
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    const tagName = (component.get('tagName') || '').toLowerCase();
    if (tagName !== 'iframe') return;
    let added = false;
    for (const spec of IFRAME_TRAITS) {
      if (!component.getTrait(spec.name)) {
        component.addTrait(spec);
        added = true;
      }
    }
    if (added) Promise.resolve().then(() => component.trigger('change:traits'));
  });
}
