const IDENTITY_TRAITS = [
  { type: 'text', name: 'id', label: 'ID' },
  { type: 'text', name: 'class', label: 'Class' },
];

export function registerIdentityTraits(editor: any): void {
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    let added = false;
    for (const spec of IDENTITY_TRAITS) {
      if (!component.getTrait(spec.name)) {
        component.addTrait(spec);
        added = true;
      }
    }
    if (added) Promise.resolve().then(() => component.trigger('change:traits'));
  });
}
