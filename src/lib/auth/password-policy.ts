// Client-safe password policy constants. Kept separate from `password.ts` so browser components
// can import the limits without pulling bcryptjs into the client bundle.

export const PASSWORD_MIN = 8;

// The maintenance bypass hash guards a PUBLICLY reachable unlock endpoint, so it gets the same
// floor as an account password despite being a single shared secret.
export const MAINTENANCE_PASSWORD_MIN = 8;
