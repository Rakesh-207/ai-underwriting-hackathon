import { verifyToken } from '@clerk/backend';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppBindings } from './env.ts';
import { errorResponse, generateRequestId } from './errors.ts';

// Extract the Bearer token from the Authorization header.
// auth contract 1.5: tokens must never appear in query strings, localStorage,
// sessionStorage, logs, error payloads, audit detail, or source-owned UI.
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  // Case-insensitive "Bearer " prefix.
  if (!/^bearer\s+/i.test(trimmed)) return null;
  const token = trimmed.replace(/^bearer\s+/i, '').trim();
  return token.length > 0 ? token : null;
}

interface VerifyOpts {
  jwtKey?: string;
  secretKey?: string;
  authorizedParties?: string[];
}

// Parse the server-only exact authorized-party allowlist. An absent, empty, or
// wildcard value is invalid so deployed verification cannot silently weaken.
export function parseAuthorizedParties(value?: string): string[] | null {
  const parties = (value ?? '')
    .split(',')
    .map((party) => party.trim())
    .filter(Boolean);
  if (parties.length === 0 || parties.includes('*')) return null;
  return parties;
}

// Verify a Clerk session token and return the authenticated principal (sub).
// Uses @clerk/backend verifyToken with jwtKey for networkless verification
// (Cloudflare Workers compatible). Returns null on any verification failure.
export async function verifyPrincipal(
  token: string,
  opts: VerifyOpts,
): Promise<{ clerkUserId: string } | null> {
  // Clerk session tokens are signed JWTs. Reject malformed or unsigned values
  // before invoking the verifier so invalid requests cannot incur a network wait.
  const tokenParts = token.split('.');
  if (tokenParts.length === 3 && tokenParts[2].length === 0) return null;
  try {
    const claims = await verifyToken(token, {
      jwtKey: opts.jwtKey,
      secretKey: opts.secretKey,
      authorizedParties: opts.authorizedParties,
    });
    const sub = claims.sub;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    return { clerkUserId: sub };
  } catch {
    return null;
  }
}

// Hono middleware: require a verified Clerk token on protected routes.
// Missing, malformed, expired, or invalid tokens all return 401 UNAUTHORIZED
// with the shared ErrorEnvelope shape. No token details are disclosed.
export const requireAuth = (): MiddlewareHandler<AppBindings> => {
  return async (c: Context<AppBindings>, next) => {
    const requestId = generateRequestId();
    const authHeader = c.req.header('authorization') ?? null;
    const token = extractBearerToken(authHeader);
    if (!token) {
      return errorResponse(
        'UNAUTHORIZED',
        'Authentication required.',
        requestId,
        401,
      );
    }

    const authorizedParties = parseAuthorizedParties(
      c.env.CLERK_AUTHORIZED_PARTIES,
    );
    if (!authorizedParties) {
      return errorResponse(
        'INTERNAL_ERROR',
        'Authentication is not configured for this service.',
        requestId,
        500,
      );
    }

    const principal = await verifyPrincipal(token, {
      jwtKey: c.env.CLERK_JWT_KEY,
      secretKey: c.env.CLERK_SECRET_KEY,
      authorizedParties,
    });

    if (!principal) {
      return errorResponse(
        'UNAUTHORIZED',
        'Authentication required.',
        requestId,
        401,
      );
    }

    // Principal is middleware-derived only; handlers never read clerkUserId
    // from the body, query, or client-supplied headers. (auth contract 1.4)
    c.set('principal', principal);
    await next();
  };
};
