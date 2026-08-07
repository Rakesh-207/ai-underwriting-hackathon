import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async () => ({ sub: 'user-validation' })),
}));

import app from '../src/index.ts';
import type { Env } from '../src/env.ts';

const env: Env = { CLERK_SECRET_KEY: 'test-placeholder', CLERK_AUTHORIZED_PARTIES: 'https://app.example.com,http://localhost:5173' };

describe('request validation', () => {
  it('returns field errors for an incomplete consent body', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/consent', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
      env,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: '1.1',
      errorCode: 'VALIDATION_ERROR',
      fieldErrors: {
        simulationId: expect.any(Array),
        applicantId: expect.any(Array),
        purposes: expect.any(Array),
        source: expect.any(Array),
      },
    });
  });
});
