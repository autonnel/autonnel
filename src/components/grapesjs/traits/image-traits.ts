const FIELD_BASE = ['border:1px solid var(--border)', 'border-radius:4px', 'background:var(--background)', 'font-size:12px'];
const INPUT_CSS = [...FIELD_BASE, 'flex:1', 'min-width:0', 'padding:4px 8px', 'color:var(--foreground)'].join(';') + ';';
const BUTTON_CSS = [...FIELD_BASE, 'padding:4px 10px', 'cursor:pointer', 'color:var(--muted-foreground)', 'flex-shrink:0'].join(';') + ';';

const BG_URL_RE = /url\(['"]?([^'"()]+)['"]?\)/;

export function registerImageTraits(editor: any) {
  const bumpChanges = () => editor.set('changesCount', (editor.get('changesCount') || 0) + 1);

  const readSrc = (cmp: any): string => cmp.get('src') || cmp.getAttributes().src || '';
  const writeSrc = (cmp: any, src: string) => {
    cmp.set('src', src);
    cmp.addAttributes({ src });
  };

  type PickHandler = (src: string, input: HTMLInputElement) => void;

  function buildPickerRow(inputClass: string, placeholder: string, onPick: PickHandler): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;align-items:stretch;width:100%';

    const field = document.createElement('input');
    field.type = 'text';
    field.className = inputClass;
    field.placeholder = placeholder;
    field.style.cssText = INPUT_CSS;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.title = 'Browse images';
    trigger.innerHTML = '<i class="fa fa-image"></i>';
    trigger.style.cssText = BUTTON_CSS;

    const openPicker = () => {
      editor.AssetManager.open({
        types: ['image'],
        select(asset: any, complete: boolean) {
          if (editor.getSelected()) {
            onPick(asset.getSrc(), field);
            bumpChanges();
          }
          if (complete) editor.AssetManager.close();
        },
      });
    };
    trigger.addEventListener('click', openPicker);

    row.appendChild(field);
    row.appendChild(trigger);
    return row;
  }

  const fieldFrom = (elInput: any, cls: string) => elInput.querySelector('.' + cls) as HTMLInputElement | null;

  editor.Traits.addType('image-src', {
    createInput() {
      return buildPickerRow('image-src-trait__input', 'Image URL...', (src, field) => {
        const cmp = editor.getSelected();
        if (!cmp) return;
        writeSrc(cmp, src);
        field.value = src;
      });
    },
    onEvent({ elInput, component }: any) {
      const field = fieldFrom(elInput, 'image-src-trait__input');
      if (!field) return;
      writeSrc(component, field.value);
      bumpChanges();
    },
    onUpdate({ elInput, component }: any) {
      const field = fieldFrom(elInput, 'image-src-trait__input');
      if (field) field.value = readSrc(component);
    },
  });

  const setBg = (cmp: any, raw: string) => {
    const url = raw.trim();
    cmp.addStyle({ 'background-image': url ? `url(${url})` : 'none' });
  };

  editor.Traits.addType('bg-image', {
    createInput() {
      return buildPickerRow('bg-image-trait__input', 'Background image URL...', (src, field) => {
        const cmp = editor.getSelected();
        if (!cmp) return;
        cmp.addStyle({ 'background-image': `url(${src})` });
        field.value = src;
      });
    },
    onEvent({ elInput, component }: any) {
      const field = fieldFrom(elInput, 'bg-image-trait__input');
      if (!field) return;
      setBg(component, field.value);
      bumpChanges();
    },
    onUpdate({ elInput, component }: any) {
      const field = fieldFrom(elInput, 'bg-image-trait__input');
      if (!field) return;
      const current = component.getStyle()['background-image'] || '';
      const hit = current.match(BG_URL_RE);
      field.value = hit ? hit[1] : '';
    },
  });

  function attachBaseTraits(cmp: any) {
    if (!cmp.getTrait('src')) {
      cmp.addTrait({ type: 'image-src', name: 'src', label: 'Image URL' }, { at: 0 });
    }
    if (!cmp.getTrait('title')) {
      cmp.addTrait({ type: 'text', name: 'title', label: 'Title' });
    }
  }

  editor.DomComponents.addType('image', {
    model: {
      init() {
        attachBaseTraits(this);
      },
    },
  });

  const looksLikeImage = (cmp: any) => {
    const tag = (cmp.get('tagName') || '').toLowerCase();
    return cmp.get('type') === 'image' || tag === 'img';
  };

  const resolveBgImage = (cmp: any): string => {
    const declared = cmp.getStyle()['background-image'] || '';
    if (declared && declared !== 'none') return declared;
    if (!cmp.getEl) return declared;
    try {
      const el = cmp.getEl();
      const win = editor.Canvas?.getWindow?.();
      if (el && win) return win.getComputedStyle(el).getPropertyValue('background-image') || '';
    } catch {  }
    return declared;
  };

  editor.on('component:selected', (component: any) => {
    if (!component) return;
    let changed = false;

    if (looksLikeImage(component) && !component.getTrait('src')) {
      attachBaseTraits(component);
      changed = true;
    }

    const bg = resolveBgImage(component);
    if (bg && bg !== 'none' && /url\(/.test(bg) && !component.getTrait('bg-image-url')) {
      component.addTrait({ type: 'bg-image', name: 'bg-image-url', label: 'Background Image' });
      changed = true;
    }

    if (changed) Promise.resolve().then(() => component.trigger('change:traits'));
  });
}
