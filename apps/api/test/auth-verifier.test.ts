import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env.ts';

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
}));

const { default: app } = await import('../src/index.ts');

const fixtureEnv: Env = {
  CLERK_SECRET_KEY: 'test-secret-placeholder-not-a-real-key',
  CLERK_AUTHORIZED_PARTIES:
    'https://app.example.com, http://localhost:5173',
};

async function request(env: Env = fixtureEnv, body?: string): Promise<Response> {
  return await app.fetch(
    new Request('http://localhost/api/consent', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fixture-token',
        'content-type': 'application/json',
      },
      body,
    }),
    env,
  );
}

describe('Clerk verifier boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an empty or wildcard authorized-party configuration', async () => {
    for (const value of ['', '*', 'https://app.example.com, *']) {
      const response = await request({
        CLERK_SECRET_KEY: fixtureEnv.CLERK_SECRET_KEY,
        CLERK_AUTHORIZED_PARTIES: value,
      });

      expect(response.status).toBe(500);
    }
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('returns an authenticated principal from verified claims.sub', async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: 'user_verified' });

    const response = await request();

    expect(response.status).toBe(501);
    expect(verifyTokenMock).toHaveBeenCalledWith('fixture-token', {
      jwtKey: undefined,
      secretKey: fixtureEnv.CLERK_SECRET_KEY,
      authorizedParties: ['https://app.example.com', 'http://localhost:5173'],
    });
  });

  it.each([
    ['expired', new Error('expired')],
    ['invalid', new Error('invalid')],
    ['wrong issuer', new Error('issuer')],
    ['wrong audience', new Error('audience')],
  ])('rejects %s verifier results with 401', async (_label, error) => {
    verifyTokenMock.mockRejectedValueOnce(error);

    const response = await request();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'UNAUTHORIZED' });
  });

  it('fails closed with 500 when the production allowlist is absent', async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: 'user_verified' });

    const response = await request({
      CLERK_SECRET_KEY: fixtureEnv.CLERK_SECRET_KEY,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ errorCode: 'INTERNAL_ERROR' });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('does not accept a principal supplied in the request body', async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: 'user_verified' });

    const response = await request(
      fixtureEnv,
      JSON.stringify({ clerkUserId: 'forged_user' }),
    );

    expect(response.status).toBe(501);
    expect(verifyTokenMock).toHaveBeenCalledWith(
      'fixture-token',
      expect.objectContaining({
        authorizedParties: ['https://app.example.com', 'http://localhost:5173'],
      }),
    );
  });
});
