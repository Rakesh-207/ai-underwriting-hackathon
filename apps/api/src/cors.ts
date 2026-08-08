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

    const allowedOrigin = origin && originAllowed(origin, allowed) ? origin : null;
    const applyCorsHeaders = (headers: Headers) => {
      if (!allowedOrigin) return;
      headers.set('access-control-allow-origin', allowedOrigin);
      headers.set('access-control-allow-headers', ALLOWED_HEADERS.join(', '));
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      headers.set('vary', 'origin');
    };

    if (c.req.method === 'OPTIONS') {
      // Preflight is never an authorized API request. Return the CORS headers
      // directly on the 204 response.
      const preflightHeaders: Record<string, string> = { vary: 'origin' };
      if (allowedOrigin) {
        preflightHeaders['access-control-allow-origin'] = allowedOrigin;
        preflightHeaders['access-control-allow-headers'] =
          ALLOWED_HEADERS.join(', ');
        preflightHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      }
      return new Response(null, { status: 204, headers: preflightHeaders });
    }
    await next();
    const response = c.res;
    const headers = new Headers(response.headers);
    applyCorsHeaders(headers);
    c.res = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
};
