# Final Integration Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the complete deterministic underwriting dependency closure and connect the authenticated web workflow to API-backed applications, providers, scoring, fairness, explanations, audit, and the sanitized non-streaming agent chat panel.

**Architecture:** The API remains the protected system boundary and selects D1 or in-memory storage through its existing repository interface. The web app keeps the existing Clerk routes and obtains bearer tokens through the existing API client, while `ApplicationsProvider` becomes an API-backed state layer. Explanation requests are API-scoped and use the completed explanation adapter plus optional Cloudflare AI Search/local RAG fallback; agent chat uses the existing transport-neutral panel with a typed API transport and deterministic completion behavior.

**Tech Stack:** Hono Workers, Cloudflare D1 repository, Clerk backend verification, React/Vite, TypeScript, Vitest, `@underwriting/engine`, `@underwriting/fairness-evaluation`, `@underwriting/explanation-adapter`, and `@underwriting/rag-retrieval`.

## Global Constraints

- Start from `main@67c110d` in a fresh isolated worktree.
- Cherry-pick `a71dc63`, `96ba618`, `f25c5ee`, `bd9319a`, `382e33b`, `5814343`, `f968a1a`, `0cdb87a` in exactly that order, skipping only refs already reachable from the candidate.
- Preserve current Clerk authentication, public landing, protected routes, and API bearer contracts.
- Keep API-owned provider modules and `packages/underwriting-engine`; do not create `packages/alternative-data`.
- Do not duplicate scoring, provider, fairness, explanation, or RAG logic.
- Send only sanitized structured evidence to the VPS; never send names, raw transactions, documents, account numbers, protected traits, proxy fields, or arbitrary applicant text.
- Treat the VPS wrapper as `stream: false`; expose completed/non-streaming status rather than claiming streaming.
- Keep Cloudflare AI Search optional and use the curated local corpus fallback when unavailable.
- Do not implement LinkedIn, OCR, scraping, real lending outcomes, protected/proxy inference, Cloudflare resources, deployment, or VPS changes.

---

### Task 1: Integrate Dependency Closure

**Files:**
- Modify: all files introduced or changed by the eight requested commits.
- Create: `docs/superpowers/specs/2026-08-08-final-integration-candidate-design.md` by cherry-picking `e246f2f` if clean.
- Create: `docs/superpowers/plans/2026-08-08-final-integration-candidate.md`.

**Interfaces:**
- Produces the API-owned provider modules, underwriting engine, D1 storage slice, fairness package, explanation adapter, RAG package, and `AgentChatPanel`.

- [ ] Verify all nine requested source refs and the design commit exist.
- [ ] For each requested source ref, check reachability from `HEAD`; cherry-pick only missing commits in the required order.
- [ ] Resolve conflicts by retaining mainline Clerk/auth/UI behavior and API ownership checks.
- [ ] Cherry-pick `e246f2f` after the required refs only if the design document applies without conflict.
- [ ] Run `npm install` and inspect the staged file list for absence of `packages/alternative-data`.

### Task 2: Complete API-Backed Application Transport

**Files:**
- Modify: `apps/api/src/index.ts`.
- Modify: `apps/api/src/repository.ts`.
- Modify: `apps/api/src/env.ts` and `apps/api/wrangler.jsonc` only when required by existing bindings.
- Modify: `apps/api/test/routes.test.ts` and `apps/api/test/vertical-slice.test.ts`.

**Interfaces:**
- Consumes: `SimulationRepository`, `repositoryFor`, `MockAccountAggregatorProvider`, `MockDigiLockerProvider`, `scoreApplication`, `evaluateFairness`, explanation adapter, and RAG provider interfaces.
- Produces: authenticated application, consent, provider, score, behavior, fairness, explanation, audit, and agent-chat API routes with application ownership and applicant binding.

- [ ] Inspect the integrated route surface before adding any endpoint.
- [ ] Add only missing application/provider/consent/explanation routes required by the existing UI.
- [ ] Ensure every application-scoped handler resolves the repository from `c.env`, verifies Clerk ownership, verifies applicant binding, and validates consent receipt hashes before reading or mutating data.
- [ ] Build explanation input from score, risk band, evidence, anomaly summaries, behavior delta, limitations, and approved RAG citation IDs only.
- [ ] Select Cloudflare AI Search only when `AI_SEARCH` is configured; otherwise use `LocalRagProvider` through the completed fallback interface.
- [ ] Configure the explanation adapter from environment-provided VPS base URL and API key, preserving its `stream: false` request and deterministic fallback.
- [ ] Add tests for unauthorized ownership, applicant mismatch, invalid receipt hash, sanitized explanation payload, VPS failure fallback, and optional RAG fallback.

### Task 3: Replace Local Fixture Workflow in the Web App

**Files:**
- Modify: `apps/web/src/hooks/useApplications.tsx`.
- Modify: `apps/web/src/lib/api.ts`.
- Modify: `apps/web/src/lib/applicationAdapter.ts` only to remove protected-flow authority, not to duplicate API behavior.
- Modify: `apps/web/src/routes/NewApplication.tsx`.
- Modify: `apps/web/src/routes/ApplicationDetail.tsx`.
- Modify: `apps/web/src/routes/Applications.tsx` and affected protected subroutes.
- Modify: `apps/web/src/App.tsx` only if provider placement is needed.
- Modify: relevant web tests and add API transport tests.

**Interfaces:**
- Consumes: `createApiClient`, Clerk `getToken`, API application/provider/consent/score/behavior/fairness/explanation/audit responses.
- Produces: API-backed `ApplicationsProvider` methods and stable UI state for create, consent, providers, scoring, evidence, behavior, fairness, explanations, and audit.

- [ ] Add typed API transport methods for application CRUD, provider listing/connection, consent listing, explanation, and agent chat.
- [ ] Bind the API client to Clerk's `getToken` inside the authenticated provider boundary.
- [ ] Replace local adapter mutations in protected routes with API calls and refresh API state after mutations.
- [ ] Keep public landing and Clerk sign-in/sign-up/protected routing unchanged.
- [ ] Render explicit model-unavailable and completed/non-streaming status from explanation/chat responses.
- [ ] Preserve existing evidence, provenance, fairness, audit, and deterministic scoring presentation.
- [ ] Add tests proving bearer headers, API-backed create flow, and protected-state refresh.

### Task 4: Integrate Agent Chat Panel

**Files:**
- Modify: `apps/web/src/routes/ApplicationDetail.tsx`.
- Modify: `apps/web/src/features/agent-chat/AgentChatPanel.tsx` only if transport typing or status copy requires it.
- Modify: `apps/web/src/features/agent-chat/types.ts` and `index.ts` only when the existing panel interface needs an API transport type.
- Add: `apps/web/src/lib/agentChat.ts` if a focused typed transport wrapper is needed.
- Add/modify: focused agent chat tests.

**Interfaces:**
- Consumes: `AgentChatPanel` transport-neutral event contract and sanitized application evidence.
- Produces: a detail-view chat panel that sends only redacted structured context and displays completed/non-streaming responses.

- [ ] Inspect `0cdb87a` panel props and event types before changing the component.
- [ ] Add typed chat request/response/event transport through the authenticated API client.
- [ ] Send only score, risk band, evidence IDs/features/directions/magnitudes, anomaly IDs/severity, behavior delta, limitations, and RAG citation IDs.
- [ ] Reject or redact forbidden keys before the request leaves the browser; enforce the same contract again at the API boundary.
- [ ] Display model-unavailable fallback status and completed/non-streaming status.
- [ ] Test that names, raw transactions, documents, account numbers, protected traits, proxy fields, and arbitrary applicant text never enter the transport payload.

### Task 5: Documentation, Full Gates, and Independent Audit

**Files:**
- Create: `docs/integration/final-integration-candidate-report.md`.
- Modify: package/API README files only to document newly added endpoints and environment prerequisites.

- [ ] Document the integrated branch and commit lineage.
- [ ] Document every endpoint added during integration with method, path, auth, request, response, and consent/ownership constraints.
- [ ] Document deployment prerequisites without creating resources or deploying: Clerk issuer/JWKS configuration, API base URL, D1 binding/migration, VPS base URL/API key, optional AI Search binding, and local fallback behavior.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Independently audit lineage, prohibited scope, bearer authentication, ownership, consent/hash validation, sanitized VPS payloads, fallback status, and UI/API journey coverage.
- [ ] Mark the report `GO` only if every required gate and audit check passes; otherwise record blockers and leave the branch unmerged and undeployed.
