# Evaluation Matrix

**Status:** First review (deterministic slice)
**Date:** 2026-08-07

This scorecard maps the hackathon judging dimensions to concrete deliverables in the first review. Each dimension lists what we deliver (with evidence), a self-rated strength (1–5), and a justification. Ratings are honest self-assessments against what the first review actually contains — not aspirational claims about future scope.

> **Scoring guide.** 5 = best-in-class evidence; 4 = strong, minor gaps; 3 = solid core with visible gaps; 2 = partial; 1 = minimal/missing.

## Dimension-by-dimension scorecard

### 1. Business Impact (weight 20%)

**What we deliver:** A lender-side underwriting decision-support workbench that demonstrates how consented alternative signals (cashflow stability, income consistency, savings buffer, on-time payment rate) complement a traditional application/bureau baseline. The product explicitly expands the reliability picture without replacing the bureau — a defensible "augment, don't replace" positioning that aligns with the CFPB interagency statement on alternative data's potential to expand access. The demo shows a real score change from a consented behavior update, making the business value tangible.

**Strength: 4/5** — The consent-before-use, revocation-first story is a strong enterprise differentiator. The dynamic score visibly moves on a behavior update. Held back from 5 because the data is synthetic (no live provider integration), which is honest but limits a "deploy Monday" claim.

**Evidence:**
- `first-review-demo-script.md` — 8-minute flow showing score delta from behavior update.
- Dynamic score: `baselineScore` (72) → `dynamicScore` (80) → post-behavior (82), per `vertical-slice-design.md` score examples.
- Consent-gated alternative contribution: zero without receipt, +8 with valid receipt.

### 2. AI Innovation & Depth (weight 20%)

**What we deliver:** An interpretable, deterministic scorecard as the source of truth with structured, feature-level evidence — not a black box. Typed cooperating units (consent guard, scorecard, anomaly reviewer, evidence renderer, self-check, fairness evaluator) are designed as separate components rather than one giant prompt. Anomaly detection is a separate rule-based path that produces a manual-review signal, never auto-deny. A synthetic parity diagnostic evaluates fairness on evaluation-only cohort labels.

**Strength: 4/5** — The "deterministic core + evidence-constrained explanation" pattern is genuinely innovative for a hackathon: it proves you can deliver explainable, auditable AI-adjacent underwriting without an LLM in the decision path. Held back from 5 because OCR, LLM explanation, and RAG are future scope (interfaces defined, not implemented) — the AI surface is intentionally thin in this slice.

**Evidence:**
- `architecture-diagram.md` — current vs future component split.
- Evidence ledger: every `EvidenceItem` carries `featureKey`, `signedPoints`, `direction`, `explanation`.
- `compliance-and-privacy-checklist.md` §11–12 — deterministic source-of-truth rule.

### 3. Technical Excellence (weight 20%)

**What we deliver:** TypeScript end-to-end with shared Zod contracts locked before implementation. React/Vite on Cloudflare Pages + Hono Worker API. Pure TypeScript score engine callable without a Worker runtime (enables local unit/fairness tests). Workspace scripts for typecheck, test, build, dev, e2e, and evaluate. Schema-versioned API responses (`schemaVersion` on every response). Feature-registry allowlist that fails closed on protected/proxy/unknown fields.

**Strength: 4/5** — Clean typed architecture, locked contracts, fail-closed validation. The score engine being Worker-independent is a well-considered testability boundary. Held back from 5 because deployment verification is conditional on credentials and the D1 adapter is deferred.

**Evidence:**
- `2026-08-07-ai-underwriting-mvp.md` — Phase 1 contract lock + Phase 2 foundation gates.
- Feature registry rejects protected traits, proxy fields, unknown fields (fail closed).
- Every score response includes `modelVersion`, `featureRegistryVersion`, `scoreId`, `generatedAt`, `auditEventId`.

### 4. Enterprise Architecture & Integration (weight 15%)

**What we deliver:** A two-surface Cloudflare deployment (Pages + Worker) with typed bindings, CORS restricted to configured origins, and a shared `ErrorEnvelope` (schema version `1.1`) across all responses. Clerk authentication with server-derived principal (never client-supplied). Ownership enforcement (a user sees only their own simulations). Defined adapter contracts (`BureauAdapter`, `EmploymentAdapter`, `DigitalBehaviorAdapter`, `PublicDataAdapter`) for future licensed-provider integration — but no live integration is faked. Audit trail with model/registry versions, consent IDs, provenance refs, and cost on every event.

**Strength: 4/5** — The adapter-contract-now, integrate-later pattern is exactly how an enterprise would de-risk provider dependencies. Clerk + ownership + audit is production-shaped. Held back from 5 because no real provider is connected and the deployment is local/conditional.

**Evidence:**
- `architecture-diagram.md` — route inventory + deployment topology.
- `2026-08-07-auth-and-routing-contract.md` — auth matrix, ownership enforcement, CORS.
- `source-registry.md` — Cloudflare/Hono/Clerk official docs cited.

### 5. User Experience (weight 10%)

**What we deliver:** A serious underwriting/audit-console design (not a chatbot). Left navigation: Overview · Consent · Applicant · Score · Behavior · Fairness · Audit. Every screen has loading, error, empty, and success states. Simulation-only banner persists on all screens. Score comparison shows baseline vs dynamic side-by-side with a delta rail. Evidence ledger renders every contribution with direction and points. Fixed risk bands (watch/guarded/stable/strong) with text + icon + colour (never colour-only). Responsive at mobile/tablet/desktop breakpoints.

**Strength: 4/5** — The UX is purpose-built for an evaluator reviewing an underwriting simulation, with honest empty states and persistent safety copy. Held back from 5 because there is no live data richness and the public landing page polish is still maturing.

**Evidence:**
- `first-review-demo-script.md` — screen-by-screen flow.
- `vertical-slice-design.md` — screen-state table, responsive breakpoints, design tokens.
- Copy test scans rendered UI strings against a blocklist (no approve/deny/eligible language).

### 6. Scalability, Security & Cost (weight 10%)

**What we deliver:** Cloudflare Workers (scale-to-zero, global edge, no cold starts per Cloudflare docs), optional D1 (scale-to-zero, no capacity units), Pages static hosting. Clerk authentication with server-side secret storage (`CLERK_SECRET_KEY` never in Vite). Data minimisation: pseudonymous IDs only, no credentials, no raw bank/social data, no protected traits. Consent receipts with purpose/category binding and first-class revocation. Measured cost-per-decision model (near-zero on free tier; see `cost-model.md`).

**Strength: 4/5** — The security posture (consent enforcement, feature-registry allowlist, ownership checks, secret isolation) and the near-zero marginal cost are compelling. Held back from 5 because the security scan is part of the verification phase and deployment cost is "unverified" without a confirmed plan.

**Evidence:**
- `compliance-and-privacy-checklist.md` — 12 controls.
- `cost-model.md` — Cloudflare pricing-sourced per-decision breakdown.
- `2026-08-07-auth-and-routing-contract.md` §1.3–1.7 — secret handling, token transport, CORS, ownership.

### 7. Presentation (weight 5%)

**What we deliver:** A timed 8-minute demo script tied to one hero applicant and one anomaly fixture. Safety language is locked and copy-tested. Architecture, compliance, cost, and limitations are documented and demoable. The presenter never claims a real lending decision.

**Strength: 4/5** — The script is rehearseable and the safety story is consistent across all docs. Held back from 5 because live polish depends on rehearsal timing and the landing page is still maturing.

**Evidence:**
- `first-review-demo-script.md` — timestamped, with "things never to say" guardrails.
- `architecture-diagram.md`, `evaluation-matrix.md`, `compliance-and-privacy-checklist.md`, `cost-model.md` — evaluator-ready artefacts.

---

## Weighted scoring summary

| Dimension | Weight | Self-rating (1–5) | Weighted score |
|-----------|--------|-------------------|----------------|
| Business Impact | 20% | 4 | 0.80 |
| AI Innovation & Depth | 20% | 4 | 0.80 |
| Technical Excellence | 20% | 4 | 0.80 |
| Enterprise Architecture & Integration | 15% | 4 | 0.60 |
| User Experience | 10% | 4 | 0.40 |
| Scalability, Security & Cost | 10% | 4 | 0.40 |
| Presentation | 5% | 4 | 0.20 |
| **Total** | **100%** | | **4.00 / 5.00** |

> **Interpretation:** The first review scores a consistent 4 across all dimensions. There is no single weak dimension; the gaps are uniform and honest — synthetic data, future AI components not yet implemented, and deployment verification conditional on credentials. This is a defensible "solid core, transparent limitations" position rather than an overclaimed one.

## Honest limitations reflected in the score

| Limitation | Affected dimensions | Why it holds the score at 4 |
|------------|---------------------|-----------------------------|
| Synthetic data only (no live providers) | Business Impact, Enterprise Integration | Cannot claim "deploy Monday" against a real bureau. |
| OCR/LLM/RAG/agents are future scope | AI Innovation | The AI surface is intentionally thin; innovation is in the deterministic-evidence pattern, not model depth. |
| D1 adapter conditional on binding | Technical Excellence | Persistence is optional; in-memory is the tested default. |
| Deployment cost "unverified" without confirmed plan | Scalability, Security & Cost | No provider invoice is implied; local measurement only. |
| Landing page still maturing | User Experience, Presentation | The protected workbench is strong; the public surface is iterating. |

## What would move a dimension to 5

- **Business Impact → 5:** A live (licensed) bureau or bank adapter behind the same consent gate.
- **AI Innovation → 5:** Implemented evidence-constrained LLM explanation + RAG with citation metadata, with the deterministic fallback still passing.
- **Technical Excellence → 5:** Credentialed deployment with D1, full e2e + evaluate gates green, schema-drift check passing.
- **Enterprise Integration → 5:** A real provider integration (even read-only) through the defined adapter contract.
- **UX → 5:** Polished trust-first public landing + fully responsive workbench with keyboard/focus checks verified.
- **Scalability/Security/Cost → 5:** Confirmed Cloudflare plan with measured deployment cost and a green security scan.
- **Presentation → 5:** Rehearsed 8:00 run with backup screenshots and zero safety-language drift.
