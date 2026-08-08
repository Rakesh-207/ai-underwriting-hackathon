# Final Integration Candidate Design

## Objective

Create an isolated `codex/final-integration-candidate` branch from `67c110d` and integrate the complete deterministic underwriting workflow without merging into `main` or deploying.

## Dependency Closure

Verify each ref before integration and skip only a ref already reachable from the candidate. Cherry-pick the missing refs in this order:

1. `a71dc63` alternative-data provider foundation
2. `96ba618` underwriting engine
3. `f25c5ee` initial API/storage vertical slice
4. `bd9319a` final API/storage remediation
5. `382e33b` fairness evaluation
6. `5814343` explanation adapter
7. `f968a1a` Cloudflare AI Search RAG package

The approved provider lineage is API-owned: `apps/api/src/providers/**` and `packages/underwriting-engine`. No `packages/alternative-data` workspace will be created.

When conflicts occur, preserve the current mainline Clerk authentication, bearer-token, route, and UI contracts. Preserve the exact completed package interfaces rather than reimplementing their logic.

## Runtime Boundaries

- The API owns Clerk verification, application ownership, consent receipts and hashes, provider connections, deterministic scoring, behavior updates, fairness diagnostics, explanation orchestration, retrieval selection, provenance, and audit events.
- The web app acquires Clerk session tokens through the existing Clerk integration and sends them through the existing authenticated API client.
- Protected workflow state is API-backed. Local fixture persistence is not authoritative for applications, consent, providers, scores, behavior, fairness, explanations, or audit events.
- The underwriting engine, fairness package, explanation adapter, and RAG package are consumed through their existing exports. No duplicate scoring, fairness, explanation, or retrieval logic is allowed.

## Protected Workflow

The candidate must support:

1. Create and load an application.
2. Capture purpose-bound consent and preserve receipt/hash behavior.
3. Connect the approved mock alternative-data providers.
4. Run deterministic baseline and consented dynamic scoring.
5. Display evidence and provenance returned by the API.
6. Submit behavior updates and display the recalculated result.
7. Display deterministic fairness diagnostics.
8. Display audit events.
9. Generate grounded explanations, falling back deterministically when the VPS LLM or Cloudflare AI Search is unavailable.

Only endpoints strictly required by this existing UI workflow may be added after inspecting the integrated API. Every added endpoint must be documented in the integration report.

## Explicit Exclusions

Do not implement LinkedIn, OCR, scraping, public LLM exposure, Cloudflare Agent chat, real lending outcomes, scoring-formula changes, Cloudflare resource creation, deployment, or VPS changes.

## Verification and Audit

Run the complete repository gates:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

Perform an independent audit covering commit lineage, package ownership, Clerk bearer authentication, consent and ownership enforcement, deterministic fallbacks, provenance and audit behavior, endpoint scope, and prohibited-feature leakage. Write an integration report with the audit result. The candidate may remain unmerged; merge or deployment is permitted only if the audit returns `GO`, and this task explicitly requires leaving it unmerged.
