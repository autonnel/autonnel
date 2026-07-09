import { describe, it, expect, vi } from 'vitest';
import { POST } from './login';

vi.mock('@/composition/make-identity', () => ({
  makeIdentity: () => ({
    authentication: {
      login: vi.fn(async (cmd: { email: string; password: string }) => {
        if (cmd.password !== 'good') throw new Error('Invalid credentials');
        return { sessionToken: 'signed.jwt', principal: { kind: 'user', userId: 'u1' } };
      }),
    },
  }),
}));

function ctx(body: unknown): any {
  return {
    request: new Request('https://x/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    locals: {},
  };
}

describe('POST /api/auth/login', () => {
  it('sets a session cookie + returns 200 on valid credentials', async () => {
    const res = await POST(ctx({ email: 'a@b.com', password: 'good' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/autonnel_session=signed\.jwt/);
  });

  it('returns 401 with a safe message on invalid credentials', async () => {
    const res = await POST(ctx({ email: 'a@b.com', password: 'bad' }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/invalid credentials/i);
    expect(JSON.stringify(json)).not.toMatch(/jwt|secret|hash/i);
  });
});
