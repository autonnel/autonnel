import { RenderedMessage } from '../rendered-message';
import type { TemplateVersion } from '../message-template';

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

// Maps a conditional block name to the variable whose presence keeps the block.
const CONDITIONAL_VARS: Record<string, string> = {
  COUPON: 'couponCode',
  ADDRESS2: 'shippingAddress2',
  SHIPPING: 'orderShipping',
  TAX: 'orderTax',
  DISCOUNT: 'orderDiscount',
};

const CONDITIONAL_RE = /<!--\s*IF_([A-Z0-9_]+)\s*-->([\s\S]*?)<!--\s*END_\1\s*-->/g;

// Keeps a block iff its mapped variable resolves to a non-empty string; unknown names keep
// their content. Marker comments are always stripped.
export function resolveConditionals(body: string, vars: Record<string, unknown>): string {
  return body.replace(CONDITIONAL_RE, (_match, name: string, inner: string) => {
    const mappedVar = CONDITIONAL_VARS[name];
    if (mappedVar === undefined) return inner;
    const raw = vars[mappedVar];
    const present = typeof raw === 'string' ? raw.trim().length > 0 : raw !== undefined && raw !== null;
    return present ? inner : '';
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderOptions {
  unsubscribeUrl: string;
  extraHeaders?: Record<string, string>;
}

export class TemplateRenderer {
  render(version: TemplateVersion, vars: Record<string, unknown>, options: RenderOptions): RenderedMessage {
    const { missing } = version.schema.validate(vars);
    if (missing.length) throw new Error(`missing required variable(s): ${missing.join(', ')}`);

    // Sandboxed single-pass substitution: a {{name}} token is replaced ONLY from the supplied
    // vars map (no eval, no expression engine, no prototype access). Replacement values are
    // inserted literally and are NOT re-scanned, so a value containing "{{x}}" is never expanded.
    // Values for variables whose name ends in `Html` (e.g. orderItemsHtml) are server-built,
    // pre-escaped trusted markup and are inserted verbatim; every other value is HTML-escaped in
    // the html body so customer-supplied text can never inject markup.
    const fill = (body: string, escape: boolean): string =>
      body.replace(VAR_RE, (_match, name: string) => {
        const raw = vars[name];
        const str = raw === undefined || raw === null ? '' : String(raw);
        return escape && !name.endsWith('Html') ? escapeHtml(str) : str;
      });

    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${options.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(options.extraHeaders ?? {}),
    };

    return RenderedMessage.of({
      subject: fill(version.subject, false),
      html: fill(resolveConditionals(version.html, vars), true),
      text: fill(resolveConditionals(version.text, vars), false),
      headers,
    });
  }
}
