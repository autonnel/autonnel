import {
  applyParamsToHref,
  collectPropagatedParams,
  readExtraLinkParams,
  LINK_DATA_ATTRS,
  LINK_DATA_ATTR_SELECTOR,
} from '@/lib/analytics/link-params';

const PARAM_INPUT_ATTR = 'data-autonnel-param';

let params: Record<string, string> = {};
let started = false;

function decorateAnchor(anchor: Element): void {
  const href = anchor.getAttribute('href');
  if (href === null) return;
  const next = applyParamsToHref(href, params, window.location.href);
  if (next !== null) anchor.setAttribute('href', next);
}

// The page's own script reads these straight off the element, so decorating the
// anchor never reaches them; rewriting the attribute in place is the only hook.
function decorateLinkData(element: Element): void {
  for (const name of LINK_DATA_ATTRS) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const next = applyParamsToHref(value, params, window.location.href);
    if (next !== null) element.setAttribute(name, next);
  }
}

// A GET submit rebuilds the query string from the form controls, so rewriting
// `action` alone would drop the params; they have to exist as fields.
function decorateForm(form: HTMLFormElement): void {
  if ((form.getAttribute('method') || 'get').toLowerCase() !== 'get') return;

  let target: URL;
  try {
    target = new URL(form.getAttribute('action') || '', window.location.href);
  } catch {
    return;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return;

  const taken = new Set<string>();
  for (const element of Array.from(form.elements)) {
    const name = element.getAttribute?.('name');
    if (name) taken.add(name);
  }

  for (const [key, value] of Object.entries(params)) {
    if (taken.has(key)) continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    input.setAttribute(PARAM_INPUT_ATTR, '');
    form.appendChild(input);
  }
}

function decorateNode(node: Node): void {
  if (node.nodeType !== 1) return;
  const element = node as Element;
  if (element.tagName === 'A') decorateAnchor(element);
  if (element.tagName === 'FORM') decorateForm(element as HTMLFormElement);
  decorateLinkData(element);
  element.querySelectorAll?.('a[href]').forEach(decorateAnchor);
  element.querySelectorAll?.('form').forEach((form) => decorateForm(form as HTMLFormElement));
  element.querySelectorAll?.(LINK_DATA_ATTR_SELECTOR).forEach(decorateLinkData);
}

// Islands replace their server-rendered DOM on hydration and imported pages build
// their own links at runtime, so a one-shot pass over the initial document leaves
// exactly the CTAs that matter undecorated.
function observeMutations(): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        decorateNode(record.target);
        continue;
      }
      record.addedNodes.forEach(decorateNode);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'action', ...LINK_DATA_ATTRS],
  });
  return () => observer.disconnect();
}

// Last line of defence for a link created and clicked before the observer runs.
function interceptNavigation(): () => void {
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest?.('a[href]');
    if (anchor) decorateAnchor(anchor);
    const carrier = target.closest?.(LINK_DATA_ATTR_SELECTOR);
    if (carrier) decorateLinkData(carrier);
  };
  const onSubmit = (event: Event) => {
    if (event.target instanceof HTMLFormElement) decorateForm(event.target);
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('submit', onSubmit, true);
  };
}

// Returns a disposer so a caller (tests, an embedder) can tear the listeners down;
// a page calls this once and never stops it.
export function startLinkParamPropagation(): () => void {
  if (started) return () => {};
  started = true;

  const stop = () => {
    started = false;
  };

  params = collectPropagatedParams(window.location.search, readExtraLinkParams());
  if (Object.keys(params).length === 0) return stop;

  decorateNode(document.documentElement);
  const disconnect = observeMutations();
  const detach = interceptNavigation();
  return () => {
    disconnect();
    detach();
    stop();
  };
}
