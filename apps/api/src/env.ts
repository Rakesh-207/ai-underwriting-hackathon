// Worker bindings and secrets.
// CLERK_SECRET_KEY and CLERK_JWT_KEY are server-side secrets stored in
// Wrangler/Cloudflare secret storage (never in any VITE_* variable).
// See auth contract 1.3: "must never appear in any VITE_* variable, the client
// bundle, logs, source maps, error payloads, fixture data, or source-owned UI."
export interface Env {
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  // Comma-separated exact Clerk authorized-party values, normally the deployed
  // frontend origin(s). Required for deployed auth hardening; wildcards are not
  // accepted.
  CLERK_AUTHORIZED_PARTIES?: string;
  // Allowed CORS origins (local dev + deployed Pages origin).
  ALLOWED_ORIGINS?: string;
}

// App-level Hono bindings: the verified principal is set by the auth middleware
// and read by handlers — never from the request body. (auth contract 1.4)
export interface AppBindings {
  Bindings: Env;
  Variables: {
    principal?: { clerkUserId: string };
  };
}
