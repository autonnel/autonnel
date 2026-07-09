const VAR_RE = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

// Distinct top-level variable names referenced by `{{name}}` tokens, taking the part before
// any dot. The messaging domain requires every referenced variable to be declared; declaring
// the parsed set as { required: false } keeps validation passing when a value is empty.
export function parseTemplateVariables(...bodies: string[]): string[] {
  const out = new Set<string>();
  for (const body of bodies) {
    if (!body) continue;
    for (const m of body.matchAll(VAR_RE)) out.add(m[1].split('.')[0]);
  }
  return [...out];
}

export function parsedVariableDecls(...bodies: string[]): { name: string; required: boolean }[] {
  return parseTemplateVariables(...bodies).map((name) => ({ name, required: false }));
}

// Promotes the named variables to required and declares any that the bodies never referenced, so
// the messaging renderer's validation fails closed on a missing core value instead of rendering it
// as an empty string.
export function withRequired(
  decls: { name: string; required: boolean }[],
  required: Iterable<string>,
): { name: string; required: boolean }[] {
  const req = new Set(required);
  const out = decls.map((d) => ({ name: d.name, required: d.required || req.has(d.name) }));
  const have = new Set(out.map((d) => d.name));
  for (const name of req) if (!have.has(name)) out.push({ name, required: true });
  return out;
}
