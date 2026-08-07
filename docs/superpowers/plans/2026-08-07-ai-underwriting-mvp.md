# AI-Driven Dynamic Underwriting MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simulation-only lender decision-support workbench that combines a traditional application/bureau baseline with consented alternative signals, produces a dynamic interpretable risk index, explains every contribution, flags anomalies, evaluates synthetic cohort parity, and records provenance, audit, limitations, and cost.

**Architecture:** A React/Vite Pages frontend calls a Hono Worker API. The Worker invokes a pure TypeScript score engine whose frozen scorecard is the source of truth; consent, provenance, fraud review, fairness evaluation, and self-checks surround it. D1 is optional persistence for consent receipts, audit events, and demo snapshots, with an in-memory adapter for local development.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui source-owned components, Hono, Zod schemas, Vitest, Playwright, Cloudflare Workers/Pages, and optional D1. No LLM or streaming provider is required for the decision path.

## Global Constraints

- Output is a simulation-only `riskScore` and `riskBand`; never approve, deny, price, limit, or make a real lending decision.
- Alternative data is used only after purpose-specific consent; revocation removes the affected features from the next score.
- The model feature registry rejects protected traits, proxy-like fields, raw social content, precise location, device fingerprints, credentials, and unknown fields.
- The interpretable score engine is the only source of truth for score, band, evidence, fraud adjustment, and cost.
- Fraud output is `clear`, `review`, or `high_review` with evidence; it never silently auto-denies.
- Fairness cohorts are synthetic evaluation labels and never model inputs.
- Synthetic fixtures and explicitly consented manual JSON are the only MVP data sources; no scraping or live provider access without credentials and an approved adapter.
- Hermes is steward-only; Codex performs research, design, integration, verification, and audit; OpenCode workers implement in isolated worktrees.
- Use Orca supervised orchestration for worker tasks. Do not substitute generic agent mesh.
- Codex workers use `gpt-5.6-luna` with medium effort. Never use `gpt-5.5/high` or agent mesh.
- No authentication, billing, queues, notifications, or unrelated infrastructure.
- Every API response includes `schemaVersion`; every score includes `modelVersion`, `featureRegistryVersion`, `scoreId`, `generatedAt`, `provenance`, and `auditEventId`.

## Hierarchical Roadmap

```text
Phase 0  Scope and execution gates
  Phase 1  Shared contract lock
    Phase 2  Foundation and local runtime
      Wave 1A  Score/data lane        (independent)
      Wave 1B  API/Worker lane         (independent after contracts)
      Wave 1C  Frontend/UI lane        (independent after contracts)
      Wave 1D  Evaluation/docs lane    (independent after contracts)
    Phase 3  Integration and end-to-end journey
    Phase 4  Verification gates
    Phase 5  Deployment and demo rehearsal
    Phase 6  Final Codex audit and handoff
```

The critical path is `contracts → foundation → score engine + API + UI → integration → verification → demo`. The data, API, frontend, and evaluation lanes must not edit one another's owned directories.

## Phase 0: Scope and Execution Gates

**Owner:** Codex coordinator

**Current state:** The repository has a clean docs-only checkpoint at commit `2d7f825`. The Orca runtime is currently unavailable (`runtime.state: not_running` and a macOS code-signing error), so implementation dispatch must wait for Orca recovery. GitHub authentication must also be restored before private-repository creation and push.

- [ ] Confirm the product definition: a lender-side decision-support engine, not a bank score provider and not a lending decision system.
- [ ] Confirm the one hero journey: baseline applicant → consent → alternative data → score delta → evidence → behavior update → anomaly → fairness/cost.
- [ ] Confirm real-provider boundary: adapter contracts now; synthetic/manual fixtures in MVP; no fake bureau or social API integration.
- [ ] Restore and verify Orca before dispatching any worker.
- [ ] Restore and verify GitHub authentication before creating the private remote.

**Gate:** No implementation worker starts until the contract gate below is accepted and Orca can prove a live supervised Run/Dispatch.

## Phase 1: Shared Contract Lock

**Owner:** Codex coordinator; no parallel implementation yet.

**Files:**

- Create: `packages/contracts/src/consent.ts`
- Create: `packages/contracts/src/applicant.ts`
- Create: `packages/contracts/src/score.ts`
- Create: `packages/contracts/src/fairness.ts`
- Create: `packages/contracts/src/audit.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `fixtures/hero-applicant.json`
- Create: `fixtures/fairness-cohort.json`
- Create: `docs/CONTRACTS.md`
- Test: `packages/contracts/test/contracts.test.ts`

**Locked interfaces:**

```ts
type ConsentPurpose =
  | 'application_baseline'
  | 'alternative_behavior'
  | 'employment_education'
  | 'public_professional'
  | 'fraud_screening'

type DataSource = 'synthetic_fixture' | 'consented_manual_entry'

interface ConsentReceipt {
  consentId: string
  applicantId: string
  purposes: ConsentPurpose[]
  categories: string[]
  source: DataSource
  status: 'granted' | 'revoked'
  grantedAt: string
  revokedAt: string | null
  retentionLabel: 'demo_session'
  receiptHash: string
}

interface ApplicantProfile {
  applicantId: string
  baseline: {
    bureauScore: number
    monthlyIncome: number
    monthlyDebt: number
    employmentMonths: number
    applicationCompleteness: number
  }
  alternative: {
    cashflowStability: number
    incomeConsistency: number
    savingsBufferMonths: number
    onTimePaymentRate: number
    employmentVerified: boolean
    educationVerified: boolean
    engagementReliability: number
  } | null
  provenance: ProvenanceRecord[]
  evaluationCohort: 'cohort_alpha' | 'cohort_beta' | null
}

interface ScoreRequest {
  applicant: ApplicantProfile
  consentReceipts: ConsentReceipt[]
  behaviorUpdates: BehaviorUpdate[]
  mode: 'baseline_only' | 'consented_dynamic'
}

interface EvidenceItem {
  featureKey: string
  label: string
  normalizedValue: number | boolean
  signedPoints: number
  direction: 'supports' | 'reduces' | 'neutral'
  source: DataSource
  consentId: string | null
  explanation: string
}

interface ScoreResult {
  schemaVersion: string
  scoreId: string
  applicantId: string
  riskScore: number
  riskBand: 'watch' | 'guarded' | 'stable' | 'strong'
  scoreMeaning: 'higher_is_stronger_reliability'
  baselineScore: number
  alternativeContribution: number
  anomalyAdjustment: number
  evidence: EvidenceItem[]
  fraudReview: FraudReview
  provenance: ProvenanceRecord[]
  cost: CostBreakdown
  modelVersion: string
  featureRegistryVersion: string
  generatedAt: string
  auditEventId: string
}
```

- [ ] Write schema tests for valid hero input, missing alternative consent, revoked consent, unknown fields, out-of-range values, and protected/proxy-like field rejection.
- [ ] Make `alternative` nullable and require `mode: 'baseline_only'` when no valid alternative consent exists.
- [ ] Define fixed risk bands and score direction in `docs/CONTRACTS.md`.
- [ ] Define route names: `GET /api/health`, `GET /api/demo/applicants`, `POST /api/consent`, `POST /api/score`, `POST /api/behavior`, `POST /api/fairness`, `GET /api/audit/:applicantId`.
- [ ] Define error envelope: `{ schemaVersion, errorCode, message, fieldErrors }`.
- [ ] Commit the contract lock before dispatching implementation lanes.

**Gate:** Contract tests pass, all lane owners receive the same commit, and no later lane changes public field names without a coordinator decision.

## Phase 2: Foundation and Local Runtime

**Owner:** A single foundation worker or Codex coordinator, before Wave 1.

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/score-engine/package.json`
- Create: `wrangler.jsonc`
- Create: `README.md`
- Create: `scripts/check-scope.mjs`

- [ ] Establish workspace scripts: `npm run test`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm run test:e2e`, `npm run evaluate`.
- [ ] Configure TypeScript project references for contracts, score engine, API, and web.
- [ ] Configure local Worker/Pages dev commands without requiring Cloudflare credentials.
- [ ] Add a scope check that fails if protected/proxy fields or raw personal data appear in fixtures.
- [ ] Run the empty foundation checks and commit the runtime scaffold.

**Gate:** A clean clone can install dependencies, typecheck, run unit tests, and start local API/UI processes before any feature lane begins.

## Wave 1A: Score and Data Lane

**Worker:** OpenCode implementation worker in an isolated worktree.

**Write scope:** `packages/score-engine/**`, `fixtures/**`, `tests/score/**`. It must not modify `apps/api`, `apps/web`, contracts, root scripts, or docs outside its scope.

**Interfaces consumed:** Phase 1 contract types and fixture IDs.

**Interfaces produced:**

```ts
scoreApplicant(request: ScoreRequest): ScoreResult
applyBehaviorUpdate(request: ScoreRequest, update: BehaviorUpdate): ScoreResult
detectAnomalies(profile: ApplicantProfile, updates: BehaviorUpdate[]): FraudReview
evaluateFairness(rows: FairnessEvaluationRow[]): FairnessReport
```

- [ ] Add failing tests for deterministic scoring, baseline-only behavior, consent gating, revocation, monotonic feature changes, evidence completeness, anomaly separation, behavior deltas, and fairness metrics.
- [ ] Implement normalized allowlisted features and fixed scorecard coefficients trained/calibrated from the synthetic fixture; export coefficients as versioned constants.
- [ ] Implement `riskScore` as a bounded 0–100 reliability index with fixed bands and a capped anomaly adjustment.
- [ ] Implement rule/model anomaly checks for impossible event ordering, duplicate application bursts, and income/expense inconsistency.
- [ ] Implement synthetic cohort metrics: sample count, strong/stable selection rate, outcome rate, selection-rate ratio, and sample-size warnings.
- [ ] Implement structured evidence and template explanations from the same contribution ledger.
- [ ] Report measured local compute duration and line-item cost without inventing provider invoices.
- [ ] Run score tests, typecheck, and fixture scope checks; commit the lane.

## Wave 1B: API and Worker Lane

**Worker:** OpenCode implementation worker in an isolated worktree.

**Write scope:** `apps/api/**`, `migrations/**`, `tests/api/**`. It must not modify score engine internals, frontend files, contracts, root scripts, or docs.

**Interfaces consumed:** Contract types and score-engine functions from the locked base commit.

- [ ] Add route tests for health, applicant fixtures, consent creation/revocation, baseline score, dynamic score, behavior update, fairness, and audit retrieval.
- [ ] Implement Hono routes with request IDs, schema validation, CORS restricted to the local/Pages origin configuration, and the shared error envelope.
- [ ] Enforce consent and feature allowlists at the API boundary before calling the score engine.
- [ ] Implement an in-memory repository used by local tests and a D1 repository for receipts, audit events, and snapshots.
- [ ] Add D1 migration files only for consent/audit/demo snapshot records; do not persist raw credentials or raw social content.
- [ ] Write an audit event for every consent mutation, score, behavior update, fairness run, and failed validation.
- [ ] Run API tests against the in-memory adapter, then run Worker-compatible tests; commit the lane.

## Wave 1C: Frontend and UI Lane

**Worker:** OpenCode implementation worker in an isolated worktree.

**Write scope:** `apps/web/**`. It must not modify API, score engine, contracts, fixtures, root scripts, or docs.

**Interfaces consumed:** API routes and response schemas from Phase 1.

- [ ] Add component tests for consent gating, baseline/dynamic comparison, evidence rendering, behavior delta, anomaly warning, fairness warnings, and simulation-only copy.
- [ ] Implement landing page CTA: `Run a consented simulation`.
- [ ] Implement the left mini-sidebar flow: `Consent`, `Applicant`, `Score`, `Behavior`, `Fairness`.
- [ ] Implement the score view with baseline score, dynamic score, band, delta, score meaning, and evidence ledger.
- [ ] Implement purpose-specific consent controls with source, category, retention, and revocation text.
- [ ] Implement behavior update controls that show before/after scores and the exact changed evidence.
- [ ] Implement audit/provenance, fraud review, fairness, cost, and limitations panels.
- [ ] Use shadcn/ui primitives only where they improve the flow; do not add chat/streaming UI to the critical path.
- [ ] Add keyboard/focus checks, responsive layout checks, and end-to-end tests against local API fixtures; commit the lane.

## Wave 1D: Evaluation, Compliance, and Demo Lane

**Worker:** OpenCode implementation worker in an isolated worktree.

**Write scope:** `evaluation/**`, `scripts/evaluate.mjs`, `docs/**`, `SECURITY.md`. It must not modify application code, contracts, fixtures, or root scripts except the named evaluator entry point.

- [ ] Define synthetic evaluation protocol and record dataset version, cohort sizes, model version, and limitations.
- [ ] Implement `npm run evaluate` output for model discrimination/calibration metrics, anomaly checks, fairness ratios, and cost per decision.
- [ ] Add the architecture diagram, data-flow explanation, AI workflow, integration boundary, and source URLs.
- [ ] Write the 8-minute demo script around one hero applicant and one anomaly fixture.
- [ ] Document that real bureau/bank/social integrations require licensed provider access and are not simulated as live.
- [ ] Add security/privacy checklist covering consent, data minimization, no scraping, protected/proxy rejection, audit, and retention.
- [ ] Commit the evaluation/docs lane.

## Phase 3: Integration and End-to-End Journey

**Owner:** Codex coordinator with fresh review worker.

- [ ] Merge the four lane branches only after reviewing each diff for write-scope violations.
- [ ] Resolve dependency conflicts in one coordinator-owned integration branch; workers do not edit another lane's files to resolve conflicts.
- [ ] Connect the UI to the API using the locked schemas; remove mock data from production paths while retaining deterministic fixtures for tests.
- [ ] Verify the complete journey: baseline → consent → dynamic score → evidence → behavior update → anomaly → fairness → audit/cost.
- [ ] Add one integration test that asserts consent revocation removes alternative evidence and changes the result.
- [ ] Add one integration test that asserts the explanation contains no feature absent from `evidence[]`.

**Gate:** A fresh local run can reproduce the full demo without external provider credentials or an LLM key.

## Phase 4: Verification Gates

**Owner:** Codex; fresh independent audit worker for review.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test` and record exact counts.
- [ ] Run `npm run test:e2e` against the local Pages/Worker dev servers.
- [ ] Run `npm run evaluate` and record fairness, calibration, anomaly, and cost results; never replace measured values with targets.
- [ ] Run the repository security scan and review findings against the no-PII/no-scraping boundaries.
- [ ] Run a schema-drift check between contracts, API responses, and frontend types.
- [ ] Review the final diff for protected/proxy fields, credentials, external calls, raw personal data, and accidental lending-decision language.
- [ ] Reject the release if score evidence, consent provenance, fairness limitations, or self-check output is missing.

## Phase 5: Deployment and Demo Rehearsal

**Owner:** Codex coordinator; deployment is conditional on existing credentials.

- [ ] Verify Cloudflare authentication without printing secrets.
- [ ] Deploy Worker/API and Pages separately using the documented Wrangler configuration.
- [ ] Apply D1 migrations only if a D1 database was created and the migration target is verified.
- [ ] Verify `/api/health`, a complete score request, behavior update, fairness report, audit retrieval, and static Pages rendering against the deployed URLs.
- [ ] If Cloudflare credentials are absent, produce a local demo recording/checklist and report deployment as blocked; do not claim a bare URL is success.
- [ ] Rehearse the 8-minute flow with the exact hero applicant and capture timing for each segment.

## Phase 6: Final Codex Audit and Handoff

- [ ] Confirm the private GitHub remote, branch, commit, and clean working tree.
- [ ] Confirm no Orvyn/avtr-1/VPS project files, memory, or remotes were touched.
- [ ] Confirm agents and write scopes in the final report.
- [ ] Confirm exact test counts, fairness results, consent/privacy controls, cost per decision, limitations, and excluded scope.
- [ ] Confirm the architecture diagram and demo script are in the repository.
- [ ] Perform a fresh audit of the actual deployed/local behavior, not just code review.

## Parallel Dispatch DAG

```text
Codex: contract lock + foundation
          |
          +--> OpenCode: score/data lane
          +--> OpenCode: API/Worker lane
          +--> OpenCode: frontend/UI lane
          +--> OpenCode: evaluation/docs/demo lane
          |
          +--> Codex integration
                    |
                    +--> fresh security audit
                    +--> fairness/evaluation verification
                    +--> deployment smoke test
                    +--> demo rehearsal
```

The four Wave 1 tasks are independent only because they share the frozen contracts and each has a disjoint write scope. They must be created as Orca Tasks first, then dispatched as supervised worker Dispatches. After each `worker_done`, Codex reviews the diff and either releases the worker or assigns a bounded follow-up; no completed worker remains unaccounted for.

## Required Worker Prompt Shape

Every implementation worker receives:

1. The locked contract commit and exact files it may change.
2. The source-of-truth safety constraints from `HACKATHON_CONTEXT.md`.
3. The exact tests and commands it must run.
4. A prohibition on editing other lane scopes or adding provider credentials.
5. A required completion report listing changed files, tests, measurements, and remaining risks.

## Completion Definition

The MVP is complete only when a fresh user can run the full journey locally or at a verified deployment, see a score change caused by a consented behavior update, inspect evidence tied to the score, observe a separate anomaly review signal, read a synthetic fairness report, and retrieve an audit/provenance/cost record. A polished landing page without that journey is not completion.
