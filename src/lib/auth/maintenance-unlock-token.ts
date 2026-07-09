// Derives a non-reversible bypass token from the tenant's maintenance password hash.
// The raw maintenance password is never written to the cookie: the token is a SHA-256
// digest of the stored hash, so possession of the cookie proves the holder once knew the
// password without exposing it. A reader can re-derive the same token from the current hash
// to validate the cookie, and rotating the password invalidates all prior tokens.
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}

const TOKEN_PREFIX = 'mu1:';

export async function createMaintenanceUnlockToken(passwordHash: string): Promise<string> {
  return TOKEN_PREFIX + (await sha256Hex(passwordHash));
}

export async function verifyMaintenanceUnlockToken(token: string, passwordHash: string): Promise<boolean> {
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  const expected = await createMaintenanceUnlockToken(passwordHash);
  return token === expected;
}
