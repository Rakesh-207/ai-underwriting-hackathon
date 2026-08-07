# Authentication and Routing Contract

**Status:** P0B-Auth contract lock
**Date:** 2026-08-07
**Scope:** Clerk authentication, public/protected routing, ConsentReceipt identity changes, API auth requirements, landing-page direction, and acceptance gates that supplement the vertical-slice design.

## Companion spec

This document **supplements** the companion `2026-08-07-vertical-slice-design.md`. It does not replace it. Where the companion spec explicitly excludes authentication (`vertical-slice-design.md:886`) or treats the landing page as a simulation entry screen, this contract overrides that exclusion for the authenticated MVP. All safety invariants, score contracts, consent semantics, fairness limitations, data minimization, provenance, and audit requirements in the companion spec remain fully in force. This contract only adds the authentication, routing, and identity layer that the companion spec omitted.

The global constraints in `docs/superpowers/plans/2026-08-07-ai-underwriting-mvp.md` ("No authentication, billing, queues, notifications, or unrelated infrastructure") are superseded by this document for the Clerk-scoped items only. Billing, queues, notifications, and unrelated infrastructure remain excluded.

## 12 confirmed decisions

These decisions are locked and drive every section below.

1. Clerk is the MVP authentication provider.
2. Better Auth is deliberately excluded from the MVP (non-goal).
3. The landing page is public and marketing-oriented.
4. The underwriting workspace under `/app` is protected by Clerk.
5. Worker/API routes require verified Clerk authentication.
6. The frontend uses `@clerk/react` with `VITE_CLERK_PUBLISHABLE_KEY`.
7. The Worker uses `@clerk/backend` or the current supported Hono/Cloudflare-compatible Clerk approach.
8. `CLERK_SECRET_KEY` must remain server-side and must never be exposed through Vite.
9. Cross-origin API calls use the Clerk session token as an `Authorization: Bearer` token unless a same-origin architecture makes cookie auth a deliberate, documented alternative.
10. Clerk identity is separate from underwriting consent.
11. No application data or alternative data may be processed before the consent receipt exists.
12. The landing page must feel like a real fintech product marketing page, not developer documentation.

---

## 1. Authentication Contract

### 1.1 Provider selection

- **Provider:** Clerk is the only MVP authentication provider.
- **Non-goal:** Better Auth is explicitly excluded. No Better Auth package, schema, middleware, cookie convention, or session store may enter the MVP. This is recorded so the implementation and dependency review fail closed if Better Auth appears.

### 1.2 Frontend authentication

- Package: `@clerk/react`.
- Initialization: `ClerkProvider` wraps the React app root.
- Public variable: `VITE_CLERK_PUBLISHABLE_KEY` is the only Clerk value exposed to the Vite build. It is a publishable key, not a secret, but it must still be present and valid in deployment configuration.
- Token acquisition: the protected fetch boundary calls Clerk's `getToken()` and attaches the resolved session token to every cross-origin API request as `Authorization: Bearer <token>`.
- UI states: the frontend explicitly handles Clerk loading, signed-out, and signed-in states. A full-screen skeleton renders while Clerk initializes. No protected route assumes `getToken()` is synchronous or non-null.
- Test boundary: local component tests use a test-safe fixture auth provider that injects a deterministic principal. The fixture provider must not leak into production builds.

### 1.3 Worker authentication

- Package: `@clerk/backend`, or the current supported Hono/Cloudflare-compatible Clerk verifier documented by Clerk at implementation time.
- Server secrets: `CLERK_SECRET_KEY` and optional `CLERK_JWT_KEY` are Worker-side secrets. `CLERK_JWT_KEY` is preferred for networkless verification; `CLERK_SECRET_KEY` is the fallback. They are stored in Wrangler/Cloudflare secret storage or local Worker secret injection and must never appear in any `VITE_*` variable, the client bundle, logs, source maps, error payloads, fixture data, or source-owned UI.
- Runtime constraint: the chosen verifier must run inside the Cloudflare Workers runtime. It must not require a Node-only runtime or import `node:` modules that Workers reject. If the current `@clerk/backend` release is not Workers-compatible at implementation time, record the supported Hono/Cloudflare alternative in the implementation report before proceeding.
- Authorized parties: `CLERK_AUTHORIZED_PARTIES` is a required server-side, comma-separated list of trimmed, exact frontend origins/authorized-party values for deployed operation. Empty values and `*` are invalid. Protected requests fail closed with a generic `500 INTERNAL_ERROR` configuration response when the list is absent or invalid; no secret or configuration value is disclosed.
- Verification scope: the middleware verifies signature, issuer, audience/authorized-party (as applicable), and expiry, passing the configured exact allowlist to `verifyToken`.

### 1.4 Authenticated principal

- The middleware extracts `sub` (the Clerk user ID) from the verified token as the authenticated principal.
- The principal is passed to handlers as a typed value, for example `AuthenticatedRequest { principal: { clerkUserId: string } }`.
- Handlers never read `clerkUserId` from a request body, query string, or client-supplied header. The principal is middleware-derived only.

### 1.5 Token transport

- Default: cross-origin requests carry `Authorization: Bearer <session-token>` obtained from Clerk's `getToken()`.
- Prohibited transport: tokens must never appear in query strings, `localStorage`, `sessionStorage`, logs, error payloads, audit detail, or source-owned UI strings.
- Same-origin alternative: if deployment later becomes same-origin (for example, Pages Functions proxying the Worker), cookie-based session auth may be selected as a deliberate, documented contract change. Selecting cookies requires CSRF protection, credential-aware CORS, and a recorded decision. Bearer is the default and the simplest contract for a separate Pages/Worker deployment.

### 1.6 CORS

- Allowed origins: the configured local development origin and the deployed Pages origin only.
- Allowed headers: `Authorization` and `Content-Type`.
- `OPTIONS` preflight is answered without token validation, only to satisfy browser CORS. A preflight is never treated as an authorized API request.
- Failures return the shared `ErrorEnvelope`.

### 1.7 Ownership enforcement

- A verified user may access only their own simulations, receipts, scores, behavior updates, fairness reports, and audit events.
- Ownership checks compare the simulation/receipt owner against the verified `clerkUserId`. Cross-user access returns `403 FORBIDDEN` (or `404 NOT_FOUND` if hiding existence is preferred) and writes a redacted audit failure event.

### 1.8 Clerk identity is not consent

- A valid Clerk token authenticates the acting user. It never substitutes for a purpose-specific consent receipt.
- Authentication may identify the user, but no application or alternative data is fetched, displayed from the API, persisted, scored, or streamed until a server-created `ConsentReceipt` exists for the required purpose and category.
- This separation preserves the compliance memo's pseudonymous-applicant boundary: `clerkUserId` authenticates the actor; `applicantId` remains a synthetic/pseudonymous fixture ID.

### 1.9 Fixture-mode authentication

- Local development represents Clerk auth with a test principal or an explicit test-only verifier.
- Consent is still created and enforced in fixture mode.
- Fixture mode must not silently become an unauthenticated production bypass. The deployed Worker verifies real Clerk tokens; the test verifier is gated to non-production environments by configuration, not by convention.

---

## 2. ConsentReceipt Type Changes

The companion spec's `ConsentReceipt` (`vertical-slice-design.md:345-358`) lacks an authenticated actor. This contract adds two fields without altering the existing fields.

```typescript
type ConsentIdentityProvider = 'clerk';

interface ConsentReceipt {
  // ... all existing fields unchanged (schemaVersion, consentId, simulationId,
  //     applicantId, purposes, categories, source, status, grantedAt,
  //     revokedAt, retention, receiptHash) ...
  identityProvider: ConsentIdentityProvider;
  clerkUserId: string; // Clerk subject (sub), derived from verified middleware,
                       // never from the request body
}
```

### 2.1 Separation rules

- `clerkUserId` authenticates the acting workspace user. It does not equal `applicantId`, which remains a synthetic/pseudonymous fixture ID.
- `clerkUserId` does not prove consent. A valid Clerk token is necessary but never sufficient for alternative-data use.
- Consent creation and revocation derive `clerkUserId` from verified middleware claims, never from the request body.

### 2.2 Receipt hash

The receipt hash covers `identityProvider`, `clerkUserId`, `simulationId`, `applicantId`, `purposes`, `categories`, `source`, `grantedAt`, `revokedAt`, `retention`, and `status`, using canonical serialization. Hashing must be deterministic and version-pinned so receipt integrity can be re-verified.

### 2.3 Ownership checks

Score, behavior, and audit reads check both:

1. Receipt ownership: the receipt's `clerkUserId` matches the verified principal.
2. Simulation ownership: the simulation's owner matches the verified principal.

Both must pass before any application or alternative data is returned or processed.

### 2.4 Storage minimization

Do not store email, display name, access token, raw JWT, or Clerk private metadata on the receipt or in audit detail. Store only `identityProvider` and `clerkUserId`.

---

## 3. API Route Authentication Changes

The companion spec lists eight routes (`vertical-slice-design.md:308`). This contract adds auth, consent, and ownership prerequisites to each. The shared response schema version is bumped to `"1.1"`, and this version applies to **all** API responses in this contract (success and error envelopes alike), not just auth failures. The companion spec's `"1.0"` version continues to govern its own pre-auth contract surfaces.

### 3.1 Route auth matrix

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/health` | Public liveness exception | Returns service/repository/schema status only. Discloses no user data, no Clerk configuration, no secret presence, and no auth claims. |
| `GET /api/demo/applicants` | Protected + consent-gated | Applicant application data is unavailable before a consent receipt exists. See decision 11. |
| `POST /api/consent` | Protected | Server derives `clerkUserId` from the verified token, never from the request body. |
| `POST /api/consent/:consentId/revoke` | Protected + ownership | Verify the user owns the receipt/simulation before revoking. |
| `POST /api/score` | Protected + consent + ownership | Load receipts server-side; reject client receipt spoofing. Reject any application/alternative payload before a receipt exists. |
| `POST /api/behavior` | Protected + consent + ownership | Require the `behavior_updates` purpose. Reject revoked/missing receipts before processing. |
| `POST /api/fairness` | Protected | Bind the report to the simulation; the fixed synthetic cohort remains evaluation-only. |
| `GET /api/audit/:simulationId` | Protected + ownership | Verify the user owns the simulation. Return no other user's receipts, applicant data, or events. |

### 3.2 401 response shape

The shared `ErrorEnvelope` (companion spec `vertical-slice-design.md:468-474`) is extended with `UNAUTHORIZED` and `FORBIDDEN` codes. The response schema version `"1.1"` applies to **all** responses under this contract — every success body, error envelope, and streaming event emitted by an authenticated route carries `schemaVersion: "1.1"`. It is not scoped to 401/auth errors only.

```typescript
interface ErrorEnvelope {
  schemaVersion: '1.1';
  errorCode:
    | 'VALIDATION_ERROR'
    | 'CONSENT_REQUIRED'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'INTERNAL_ERROR';
  message: string;
  fieldErrors: Record<string, string[]>;
  requestId: string;
}
```

Example `401` body (no token details disclosed):

```json
{
  "schemaVersion": "1.1",
  "errorCode": "UNAUTHORIZED",
  "message": "Authentication required.",
  "fieldErrors": {},
  "requestId": "req-..."
}
```

- `UNAUTHORIZED` (401): missing, malformed, expired, or invalid token.
- `FORBIDDEN` (403): valid token, but the user does not own the target simulation/receipt.
- `CONSENT_REQUIRED`: authenticated and owning user, but the required purpose/category receipt is missing or revoked.

### 3.3 Test coverage required

Tests must cover: missing token, malformed token, expired token, wrong-issuer/audience token, valid verified token with principal extraction, configured authorized-party propagation, absent/invalid production allowlist fail-closed behavior, forged token, and cross-user token. The deterministic verifier-path tests use a supported module mock because real Clerk credentials are unavailable in local CI; this is test evidence, not deployment proof. Tests must never print token or secret values.

### 3.4 Pre-consent boundary (decision 11)

Authentication may identify the user, but no application or alternative data is processed before a server-created `ConsentReceipt` exists. Concretely:

- `GET /api/demo/applicants` returns no application fields before consent. The safest contract is protected and receipt-required.
- `POST /api/score` loads authoritative receipts server-side and rejects any application/alternative payload when no valid receipt covers the purpose and category.
- `POST /api/behavior` rejects events whose consent ID is missing or revoked.

---

## 4. UI Route Map

### 4.1 Public routes

| Path | Purpose |
|------|---------|
| `/` | Marketing landing page. Reachable signed-out and signed-in. Signed-out CTA routes to Clerk; signed-in CTA routes to `/app`. |
| `/sign-in` | Clerk sign-in. Redirects to `/app` on success. |
| `/sign-up` | Clerk sign-up. Redirects to `/app` on success. |

### 4.2 Protected routes

All routes under `/app` require Clerk authentication.

| Path | Purpose |
|------|---------|
| `/app` | Application shell. Redirects to `/app/overview`. |
| `/app/overview` | Overview / simulation dashboard. |
| `/app/consent` | Consent management: grant/revoke purpose-bound consent. |
| `/app/applicant` | Applicant and baseline data. Consent-gated. |
| `/app/score` | Score comparison: baseline vs dynamic. |
| `/app/behavior` | Behavior update application. Requires `behavior_updates` purpose. |
| `/app/fairness` | Synthetic parity diagnostic. |
| `/app/audit` | Audit trail, provenance, limitations. |

### 4.3 Route behavior

- Unauthenticated user navigating to `/app/*` is redirected to `/sign-in` with the return URL preserved.
- Signed-in user navigating to `/` sees the landing page with an "Open Workbench" CTA.
- Sign-in / sign-up success redirects to `/app/overview`.
- A full-screen skeleton renders while Clerk initializes.
- Logout redirects to `/`.

---

## 5. Landing Page Section Map (Trust-First B2B Fintech)

### 5.1 Design direction (critical)

The landing page must feel like a real fintech product marketing page. It must not look like developer documentation, an evaluator workbench, or generated boilerplate. The execution agent implementing this page must use their taste and design skill to the fullest.

Avoid: generic purple gradients, generic "AI" aesthetics, template feel, documentation-style tables, developer jargon, fixture selectors, simulation IDs, nav rails, or audit timelines on the public surface.

### 5.2 Copy direction

Clear human copy. Confident but not exaggerated. No fake customers, fake metrics, or unsupported claims. No documentation-style tables or developer jargon. Preserve the approved safety terminology from the companion spec (`simulation result`, `reliability score`, `risk band`, `manual review signal`, `alternative contribution`, `consented signal`).

### 5.3 Sections (in order)

1. **Hero** — What the product helps underwriting teams explore. Value proposition in plain language. CTA: "Start a Simulation" or "Sign In". No "AI decides" language.
2. **Trust strip** — Synthetic-only, purpose-bound consent, deterministic evidence, auditability, human review signal. Restrained visual proof points.
3. **How it works** — Baseline → consent → alternative fixture → score/evidence → behavior update, in business language.
4. **Methodology / proof** — Deterministic scorecard, contribution ledger, provenance, synthetic parity diagnostic, limitations.
5. **Privacy / safety** — No credentials, no live bank/bureau/social, no protected/proxy traits, no automatic outcome.
6. **CTA** — "Run a Consented Simulation". Signed-out → Clerk sign-in; signed-in → `/app`.
7. **Footer** — Simulation-only / legal boundary, product links. No fake customer logos, no lender claims, no performance guarantees, no invented compliance badges.

### 5.4 What moves into `/app`

Move all fixture selectors, simulation IDs, nav rails, score summaries, receipt IDs, audit timelines, and detailed limitations into protected `/app`. The public landing page exposes none of the workspace controls.

---

## 6. Authenticated App Screen Map

All screens under `/app/*` require Clerk authentication. Each screen shows:

- A global simulation-only banner.
- Signed-in user state (Clerk user, sign-out option).
- Left navigation: `Overview | Consent | Applicant | Score | Behavior | Fairness | Audit`.

| Screen | Path | Prerequisites | Content |
|--------|------|---------------|---------|
| Overview | `/app/overview` | Auth | Simulation dashboard, start a new simulation. |
| Consent | `/app/consent` | Auth | Purpose-card consent flow, grant/revoke. |
| Applicant | `/app/applicant` | Auth + consent receipt | Synthetic applicant, baseline data. |
| Score | `/app/score` | Auth + consent | Baseline vs dynamic score, risk band, evidence. |
| Behavior | `/app/behavior` | Auth + consent + `behavior_updates` purpose | Apply behavior update, see changed score. |
| Fairness | `/app/fairness` | Auth + consent | Synthetic parity diagnostic. |
| Audit | `/app/audit` | Auth + consent | Full audit trail, provenance, limitations. |

---

## 7. Streaming Workflow Event Names

Streaming remains **optional** and **display-only** (explanation panel only), as in the companion spec. If enabled, it uses these stable event names. If streaming is deferred to a later phase, say so explicitly; the same auth contract applies before it is enabled.

| Event | Payload | Notes |
|-------|---------|-------|
| `explanation.started` | `{schemaVersion, simulationId, requestId}` | Stream begins. |
| `explanation.token` | `{schemaVersion, simulationId, requestId, textChunk}` | One text chunk. The payload field is `textChunk` (never `token`, to avoid collision with auth tokens). |
| `explanation.completed` | `{schemaVersion, simulationId, requestId}` | Stream finished. |
| `explanation.error` | `{schemaVersion, simulationId, requestId, errorCode, message}` | Stream failed. |
| `stream.closed` | `{schemaVersion, simulationId, requestId}` | Connection closed. |

Rules:

- Every event carries `schemaVersion`, `simulationId`, and `requestId`.
- No event ever carries tokens, secrets, or Clerk claims.
- No event ever changes `ScoreResult`, score bands, fraud review, provenance, or cost.
- Streaming requires the same auth as the parent API route.

---

## 8. Shared Design-System Boundaries

| Layer | Public marketing components | Protected app components | Shared primitives |
|-------|---------------------------|------------------------|-------------------|
| Allowed | `MarketingHeader`, `TrustProof`, `HowItWorks`, `SafetyDisclosure`, `MarketingCTA` | `AppShell`, `NavRail`, consent/score/audit domain components | Tokens (colors, typography, spacing), `Button`, `Card`, `Input`, `Badge` |
| Prohibited imports | Must not import app state, Clerk session, or the API client. | Must not import marketing components. | May cross the boundary. |
| Auth requirement | None. | Clerk authenticated context required. | N/A. |

The companion spec's `AppShell`/`NavRail` (`vertical-slice-design.md:49-56`) are app-only under this contract. They must not appear on the public landing page. Existing tokens (`#f7f8fa` background, white surfaces, restrained blue primary, accessible status colors, visible focus) and the primitive inventory remain valid and may be shared across both layers.

---

## 9. Fixture-Mode Behavior (Before OCR, LLM, RAG)

- Clerk auth is represented by a test principal or an explicit test-only verifier.
- Consent is still created and enforced.
- Synthetic fixture metadata may be public only if it contains no application or alternative data.
- No OCR, LLM, RAG, or live-provider call occurs.
- Fixture mode must not silently become an unauthenticated production bypass.
- Local development uses deterministic fixtures and the in-memory repository.
- No external dependencies are required for local development.

---

## 10. Acceptance Gates

### 10.1 P1A — Contract and Foundation

- Type contracts include the Clerk principal/auth context, `ConsentReceipt.identityProvider`, and `ConsentReceipt.clerkUserId`.
- `UNAUTHORIZED` (and `FORBIDDEN`, if used) error codes exist in `ErrorEnvelope`.
- The route contract marks `GET /api/health` as the public liveness exception; every other route has auth, consent, and ownership prerequisites documented.
- The frontend contract names `@clerk/react`, `VITE_CLERK_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL`.
- The Worker contract names `CLERK_SECRET_KEY` as a server-side secret and defines the supported Cloudflare-compatible verifier.
- No `CLERK_SECRET_KEY` appears in any Vite variable.
- A pre-consent test proves no application or alternative data is processed before a receipt exists.
- Public landing and protected app route maps are documented.
- `CLERK_AUTHORIZED_PARTIES` is an exact, non-wildcard server allowlist; deployed protected requests fail closed when it is absent or invalid.
- Tests prove the 401 shape, token rejection, valid mocked-verifier principal extraction, authorized-party propagation, cross-user isolation, and server-derived identity. Real Clerk credentials remain unavailable in local CI, so mocked verifier evidence is clearly separated from deployment proof. Tests never print token or secret values.

### 10.2 P1B — Vertical Slice Implementation

- Signed-out `/` renders the marketing landing page without Clerk-required API calls or application data.
- Signed-in `/app` renders the shell only after Clerk loads.
- All protected API calls carry a fresh Bearer session token.
- Consent creation persists the server-derived Clerk subject.
- Applicant data is unavailable before consent.
- Cross-user access is denied.
- Missing, invalid, or revoked consent blocks score, behavior, explanation, and audit writes (except the required redacted validation/audit failure event).
- The full consent-gated journey works end-to-end for the authenticated simulation owner.
- Cross-user ownership and business-route behavior remain P1B responsibilities; P1A only establishes the verified principal boundary and protected route stubs.

### 10.3 P1C — Deployment Foundation

- Pages has `VITE_API_BASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY` only. No secret key is bundled into output (`dist` scan).
- Worker has `CLERK_SECRET_KEY` configured as a server-side secret. Secret values are not printed, returned by health, or included in logs or source maps.
- CORS permits only local and deployed Pages origins and explicitly supports `Authorization` preflight.
- Deployment smoke tests cover: health, 401, authenticated journey (applicant/consent/score/behavior/fairness/audit), and cross-user denial.
- `/app` redirects signed-out users.
- If deployment credentials are unavailable, P1C is **HOLD**, with local fixture-mode evidence clearly separated from deployment proof. A secret-name inventory proves names only, not values, history, or environment parity.

---

## 11. Unresolved Decisions

These items are recorded explicitly so the implementation does not resolve them silently.

1. **`GET /api/health` public vs protected.** Recommendation: public liveness exception. Health discloses only service/repository/schema status, never Clerk configuration or secret presence. Document the choice in the implementation report.
2. **`GET /api/demo/applicants` before consent.** Recommendation: protected and consent-gated. No application data before a receipt exists. A metadata-only public catalog is explicitly rejected by decision 11's pre-consent boundary.
3. **Bearer vs same-origin cookie auth.** Recommendation: Bearer as the default. If deployment becomes same-origin and cookies are selected, record CSRF protection, credential-aware CORS, and the decision rationale as a contract change.

---

## Relationship to existing gates

This contract adds gates P1A, P1B, and P1C on top of the companion spec's acceptance criteria (`vertical-slice-design.md:859-880`). The companion spec's 18 criteria remain in force. The landing-page criterion (criterion 1) is refined by Section 5 of this document: the landing page is now a public marketing surface, not a simulation entry screen. The simulation-entry experience moves to `/app`.
