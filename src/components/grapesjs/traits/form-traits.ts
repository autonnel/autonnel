type Spec = { type?: string; name: string; label?: string; placeholder?: string; options?: Array<{ id: string; name?: string }> };

const FORM_TRAITS: Spec[] = [
  { type: 'text', name: 'action', label: 'Action URL' },
  {
    type: 'select', name: 'method', label: 'Method',
    options: [{ id: 'get', name: 'GET' }, { id: 'post', name: 'POST' }],
  },
  {
    type: 'select', name: 'enctype', label: 'Enctype',
    options: [
      { id: 'application/x-www-form-urlencoded', name: 'urlencoded' },
      { id: 'multipart/form-data', name: 'multipart' },
      { id: 'text/plain', name: 'text/plain' },
    ],
  },
  { type: 'text', name: 'target', label: 'Target' },
  { type: 'text', name: 'name', label: 'Name' },
];

const INPUT_TYPE_OPTIONS = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local', 'checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].map((id) => ({ id, name: id }));

const INPUT_TRAITS: Spec[] = [
  { type: 'select', name: 'type', label: 'Type', options: INPUT_TYPE_OPTIONS },
  { type: 'text', name: 'name', label: 'Name' },
  { type: 'text', name: 'placeholder', label: 'Placeholder' },
  { type: 'text', name: 'value', label: 'Value' },
  { type: 'checkbox', name: 'required', label: 'Required' },
  { type: 'text', name: 'min', label: 'Min' },
  { type: 'text', name: 'max', label: 'Max' },
  { type: 'text', name: 'pattern', label: 'Pattern' },
  { type: 'text', name: 'autocomplete', label: 'Autocomplete' },
];

const BUTTON_TRAITS: Spec[] = [
  {
    type: 'select', name: 'type', label: 'Type',
    options: [
      { id: 'button', name: 'button' },
      { id: 'submit', name: 'submit' },
      { id: 'reset', name: 'reset' },
    ],
  },
  { type: 'text', name: 'name', label: 'Name' },
  { type: 'text', name: 'value', label: 'Value' },
  { type: 'checkbox', name: 'disabled', label: 'Disabled' },
];

const TEXTAREA_TRAITS: Spec[] = [
  { type: 'text', name: 'name', label: 'Name' },
  { type: 'text', name: 'placeholder', label: 'Placeholder' },
  { type: 'number', name: 'rows', label: 'Rows' },
  { type: 'number', name: 'cols', label: 'Cols' },
  { type: 'checkbox', name: 'required', label: 'Required' },
  { type: 'number', name: 'maxlength', label: 'Max length' },
];

const SELECT_TRAITS: Spec[] = [
  { type: 'text', name: 'name', label: 'Name' },
  { type: 'checkbox', name: 'required', label: 'Required' },
  { type: 'checkbox', name: 'multiple', label: 'Multiple' },
  { type: 'number', name: 'size', label: 'Size' },
];

const TAG_MAP: Record<string, Spec[]> = {
  form: FORM_TRAITS,
  input: INPUT_TRAITS,
  button: BUTTON_TRAITS,
  textarea: TEXTAREA_TRAITS,
  select: SELECT_TRAITS,
};

export function registerFormTraits(editor: any): void {
  editor.on('component:selected', (component: any) => {
    if (!component) return;
    const tagName = (component.get('tagName') || '').toLowerCase();
    const specs = TAG_MAP[tagName];
    if (!specs) return;
    let added = false;
    for (const spec of specs) {
      if (!component.getTrait(spec.name)) {
        component.addTrait(spec);
        added = true;
      }
    }
    if (added) Promise.resolve().then(() => component.trigger('change:traits'));
  });
}
