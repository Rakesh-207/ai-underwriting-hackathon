import { Hono } from 'hono';
import type { AppBindings } from './env.ts';
import { API_SCHEMA_VERSION } from '@underwriting/shared';
import { generateRequestId } from './errors.ts';
import { requireAuth } from './auth.ts';
import { cors } from './cors.ts';

const app = new Hono<AppBindings>();

// CORS applies to all routes; OPTIONS preflight is answered without auth.
app.use('*', cors());

// GET /api/health — public liveness exception.
// Discloses only service/repository/schema status; no user data, no Clerk
// configuration, no secret presence, no auth claims. (auth contract 3.1)
app.get('/api/health', (c) => {
  return c.json({
    schemaVersion: API_SCHEMA_VERSION,
    status: 'ok',
    service: 'underwriting-simulation-api',
    repository: 'memory',
    modelVersion: 'scorecard-v1',
    generatedAt: new Date().toISOString(),
  });
});

// All remaining routes are protected by Clerk verification. The middleware
// derives the principal from the verified token only. (auth contract 1.4, 3.1)
const protectedApi = new Hono<AppBindings>();
protectedApi.use('*', requireAuth());

// Protected route stubs. These return a 501 indicating the feature lands in P1B.
// Each is behind the verified-principal middleware, so an unauthenticated
// request fails with 401 UNAUTHORIZED before reaching the stub.
const protectedRoutes: Array<[string, 'get' | 'post']> = [
  ['/api/demo/applicants', 'get'],
  ['/api/consent', 'post'],
  ['/api/consent/:consentId/revoke', 'post'],
  ['/api/score', 'post'],
  ['/api/behavior', 'post'],
  ['/api/fairness', 'post'],
  ['/api/audit/:simulationId', 'get'],
];

for (const [path, method] of protectedRoutes) {
  protectedApi[method](path, (c) => {
    const requestId = generateRequestId();
    return c.json(
      {
        schemaVersion: API_SCHEMA_VERSION,
        errorCode: 'NOT_FOUND',
        message: 'This route is implemented in P1B.',
        fieldErrors: {},
        requestId,
      },
      501,
    );
  });
}

app.route('/', protectedApi);

export default app;
