import type { Context, MiddlewareHandler } from 'hono';
import type { AppBindings } from './env.ts';

// CORS: allow the configured local origin and deployed Pages origin only.
// auth contract 1.6: Allowed headers are Authorization and Content-Type;
// OPTIONS preflight is answered without token validation.
const ALLOWED_HEADERS = ['authorization', 'content-type'];

function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) {
    // Default: allow localhost dev origins when none configured.
    return origin !== null && /^http:\/\/localhost(:\d+)?$/.test(origin);
  }
  return origin !== null && allowed.includes(origin);
}

export const cors = (): MiddlewareHandler<AppBindings> => {
  return async (c: Context<AppBindings>, next) => {
    const origin = c.req.header('origin') ?? null;
    const allowed = (c.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (origin && originAllowed(origin, allowed)) {
      c.header('access-control-allow-origin', origin);
      c.header('access-control-allow-headers', ALLOWED_HEADERS.join(', '));
      c.header('access-control-allow-methods', 'GET, POST, OPTIONS');
      c.header('vary', 'origin');
    }

    if (c.req.method === 'OPTIONS') {
      // Preflight is never an authorized API request. Return the CORS headers
      // directly on the 204 response.
      const preflightHeaders: Record<string, string> = { vary: 'origin' };
      if (origin && originAllowed(origin, allowed)) {
        preflightHeaders['access-control-allow-origin'] = origin;
        preflightHeaders['access-control-allow-headers'] =
          ALLOWED_HEADERS.join(', ');
        preflightHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      }
      return new Response(null, { status: 204, headers: preflightHeaders });
    }
    await next();
  };
};
