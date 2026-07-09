// Minimal semver range check covering the forms a plugin's engines.autonnel uses:
//   '*' / ''  -> always; 'x.y.z' pinned; '>=x.y.z' '>x.y.z'; '^x.y.z' (caret); '~x.y.z' (tilde).
// Avoids pulling in the full `semver` dependency for this single build-time gate.

type Parts = [number, number, number];

function parse(v: string): Parts | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmp(a: Parts, b: Parts): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function caretUpper(p: Parts): Parts {
  if (p[0] > 0) return [p[0] + 1, 0, 0];
  if (p[1] > 0) return [0, p[1] + 1, 0];
  return [0, 0, p[2] + 1];
}

export function satisfiesRange(version: string, range: string): boolean {
  const trimmed = range.trim();
  if (trimmed === '' || trimmed === '*') return true;

  const v = parse(version);
  if (!v) return false;

  if (trimmed.startsWith('>=')) {
    const b = parse(trimmed.slice(2));
    return b ? cmp(v, b) >= 0 : false;
  }
  if (trimmed.startsWith('>')) {
    const b = parse(trimmed.slice(1));
    return b ? cmp(v, b) > 0 : false;
  }
  if (trimmed.startsWith('^')) {
    const b = parse(trimmed.slice(1));
    return b ? cmp(v, b) >= 0 && cmp(v, caretUpper(b)) < 0 : false;
  }
  if (trimmed.startsWith('~')) {
    const b = parse(trimmed.slice(1));
    return b ? cmp(v, b) >= 0 && cmp(v, [b[0], b[1] + 1, 0]) < 0 : false;
  }

  const pinned = parse(trimmed);
  return pinned ? cmp(v, pinned) === 0 : false;
}
