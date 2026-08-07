# Compliance and Privacy Checklist

**Status:** First review (deterministic slice)
**Date:** 2026-08-07

> **DISCLAIMER.** This checklist is an engineering self-assessment for a simulation-only hackathon demo. It is **not legal advice**, not a compliance certification, and not a jurisdiction-specific determination. The demo does not make real lending decisions, does not process real personal data, and does not deploy to production. Sources cited are official/primary where available; regulatory texts are time-sensitive and must be re-checked before any production use.

> **Status legend.** ✅ Met · ⚠️ Partial · ❌ Not Met · 📋 Future (interface defined, not implemented in this slice)

## 1. Explicit consent (purpose-bound, affirmative action)

**Status: ✅ Met**

- Each `ConsentReceipt` binds to specific `purposes` (`application_baseline`, `alternative_cashflow`, `behavior_updates`, `fraud_screening`) and `categories`.
- Consent UI requires a separate affirmative action (checkbox) per purpose. The API revalidates every purpose server-side.
- No application or alternative data is fetched, displayed, scored, or persisted before a server-created receipt exists (pre-consent boundary, decision 11).
- The receipt carries a `receiptHash` for integrity re-verification.

**Maps to:** DPDP Act 2023 §6(1) — consent must be "free, specific, informed, unconditional and unambiguous with a clear affirmative action… limited to such personal data as is necessary for such specified purpose."

**Source:** [DPDP Act 2023 full text (MeitY)](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf) · [India Code](https://www.indiacode.nic.in/handle/123456789/22037?locale=en)

## 2. Consent withdrawal (first-class action, removes contribution)

**Status: ✅ Met**

- `POST /api/consent/:consentId/revoke` is an explicit mutation: marks a granted receipt `revoked`, records `revokedAt`, writes an audit event, returns the updated receipt.
- After revocation, the next score excludes the affected alternative signals (`alternativeContribution: 0`), provenance explains the signal was excluded, and a behavior update using that receipt returns `CONSENT_REQUIRED`.
- Repeating revocation returns `409 CONFLICT` (idempotency-safe).
- Revocation does not erase the audit record (retention of the mutation trail).

**Maps to:** DPDP Act 2023 §6(4) — "right to withdraw her consent at any time, with the ease of doing so being comparable to the ease with which such consent was given"; §6(6) — Data Fiduciary must cease processing within a reasonable time.

**Source:** [DPDP Act 2023 §6 (indiankanoon)](https://indiankanoon.org/doc/15072321/)

## 3. Purpose limitation (each signal tagged to purpose)

**Status: ✅ Met**

- Every alternative feature is tagged to a `ConsentPurpose` and a `category` in `ProvenanceRecord`.
- The consent gate checks both purpose **and** category before allowing a signal to contribute to a score.
- A baseline-only result is a valid state when dynamic purposes are not consented.

**Maps to:** DPDP Act 2023 §6(1) illustration — consent is "limited to such personal data as is necessary for such specified purpose." Also aligns with NIST AI RMF Govern 1.1 (legal/regulatory requirements understood and documented).

**Source:** [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) · [DPDP Act 2023](https://www.indiacode.nic.in/handle/123456789/22037?locale=en)

## 4. Data minimization (pseudonymous IDs, no credentials, no raw data)

**Status: ✅ Met**

- Applicant identifiers are pseudonymous (`app-maya-001`), not real identities.
- No credentials, raw bank logins, contact lists, precise location, device fingerprints, raw social content, or protected traits are collected or stored.
- Receipts store only `identityProvider` and `clerkUserId` — not email, display name, access token, raw JWT, or Clerk private metadata.
- `saveScore` persists evidence and provenance summaries sufficient for audit, not an unbounded request dump.

**Maps to:** DPDP Act 2023 §6(1) (necessity) and the data-minimization principle; NIST Privacy Framework.

**Source:** [NIST Privacy Framework](https://www.nist.gov/privacy-framework)

## 5. Retention and deletion

**Status: ⚠️ Partial**

- The `ConsentReceipt.retention` field is `demo_session` — an explicit, short, demo-scoped retention label.
- The in-memory repository resets per test/local session; D1 (when used) stores only receipts, audit events, snapshots, and redacted trace events.
- **Gap:** There is no automated deletion scheduler or formal data-subject deletion request flow in this slice. Deletion is bounded by the demo-session retention label and manual teardown, not a production deletion pipeline. This is acceptable for a simulation demo; it would be a gap in production.

**Maps to:** DPDP Act 2023 §6(6) cease-processing obligation and the retention-minimization principle.

## 6. Provenance (every score records source, consent IDs, timestamps)

**Status: ✅ Met**

- Every `ScoreResult` includes `provenance[]`, `consentIds` used, `modelVersion`, `featureRegistryVersion`, `scoreId`, and `generatedAt`.
- Each `EvidenceItem` carries `source`, `consentId`, and `provenanceRef`.
- A baseline-only result explicitly records that no consented alternative signal was used.

**Maps to:** NIST AI RMF Measure 2.8 (transparency and accountability examined and documented) and Measure 2.9 (model explained, validated, documented).

**Source:** [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)

## 7. Audit trail (consent mutations, scores, behavior updates, fairness runs)

**Status: ✅ Met**

- Every consent grant, revocation, score, behavior update, fairness run, and validation failure writes an `AuditEvent` with `eventType`, `occurredAt`, `modelVersion`, `featureRegistryVersion`, `consentIds`, `provenanceRefs`, and redacted `detail`.
- `GET /api/audit/:simulationId` returns the full timeline (ownership-checked).
- Audit events are append-only; revocation does not erase history.

**Maps to:** NIST AI RMF Govern (documentation/transparency) and Measure (monitoring).

## 8. No scraping (no crawling, no covert collection)

**Status: ✅ Met**

- No web crawling, scraping, or covert collection occurs.
- All data is either `synthetic_fixture` or explicitly `consented_manual_entry`.
- Runtime web browsing is prohibited in the current and future architecture.

**Maps to:** Project safety boundary (HACKATHON_CONTEXT.md) — "No scraping, covert collection, inferred identity, or unconsented data."

## 9. No protected traits or proxy inference

**Status: ✅ Met**

- The feature registry is the enforcement point: it rejects names, age, gender, race, religion, disability, nationality, precise location, device fingerprint, social graph, and proxy-like fields.
- Unknown or disallowed fields fail closed (schema validation rejects).
- Fairness cohorts (`cohort_alpha`, `cohort_beta`) are synthetic evaluation labels and are **never** model inputs; they are not exposed as applicant fields.

**Maps to:** ECOA/Regulation B protected classes; DPDP Act protections; NIST AI RMF Measure 2.11 (fairness and bias evaluated).

**Source:** [CFPB Regulation B / 12 CFR Part 1002](https://www.consumerfinance.gov/rules-policy/regulations/1002/)

## 10. No real lending decision (simulation_band + review_signals only)

**Status: ✅ Met**

- The output is `riskScore` (0–100 reliability index) + `riskBand` (`watch`/`guarded`/`stable`/`strong`) + `fraudReview` (`clear`/`review`/`high_review` with `manual_review` action).
- The product never issues approve, deny, price, limit, or eligibility language.
- A release copy test scans rendered UI strings against a blocklist of lending-outcome terms.

**Maps to:** The demo deliberately stays below the ECOA adverse-action threshold by making **no credit decision at all**. This is the safest positioning: CFPB Circular 2022-03 makes clear that adverse-action notice obligations attach when a creditor takes adverse action — the simulation takes none.

**Source:** [CFPB Circular 2022-03](https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/)

## 11. Deterministic score as source of truth (LLM may only verbalize evidence)

**Status: ✅ Met**

- The deterministic TypeScript scorecard is the sole source of truth for `riskScore`, `riskBand`, evidence, anomaly adjustment, and cost.
- No agent, LLM, or future adapter may alter `riskScore`, `riskBand`, consent decisions, or score contributions.
- The score is calculated by deterministic code before any optional explanation rendering.

**Maps to:** CFPB Circular 2022-03 — creditors must be able to provide "specific and accurate reasons" tied to "factors actually considered or scored." A deterministic scorecard with a structured evidence ledger satisfies this by construction: every point is traceable to a feature.

**Source:** [CFPB Circular 2022-03 (PDF)](https://files.consumerfinance.gov/f/documents/cfpb_2022-03_circular_2022-05.pdf)

## 12. LLM explanation restricted to structured evidence (if LLM ever enabled)

**Status: 📋 Future**

- In the first review, **no LLM is used in the decision or explanation path.** Explanations are rendered by deterministic templates from `EvidenceItem` rows.
- The contract is pre-defined: if an LLM is ever enabled, it receives only `ScoreResult.evidence`, score metadata, provenance, a consent summary, a fraud-review result, and optionally retrieved approved passages. It returns a display string with citations. It may not invent a factor, value, or reason and cannot write back to the score.
- A deterministic template fallback remains the default if validation fails or a model is unavailable.

**Maps to:** CFPB Circular 2022-03 — "reasons disclosed must relate only to those factors actually scored." An evidence-constrained LLM that can only verbalize existing `evidence[]` cannot introduce a non-scored reason.

**Source:** [CFPB Innovation spotlight: adverse action notices with AI/ML](https://www.consumerfinance.gov/about-us/blog/innovation-spotlight-providing-adverse-action-notices-when-using-ai-ml-models/)

---

## Summary table

| # | Control | Status |
|---|---------|--------|
| 1 | Explicit consent (purpose-bound, affirmative action) | ✅ Met |
| 2 | Consent withdrawal (first-class, removes contribution) | ✅ Met |
| 3 | Purpose limitation (signal tagged to purpose) | ✅ Met |
| 4 | Data minimization (pseudonymous, no raw data) | ✅ Met |
| 5 | Retention and deletion | ⚠️ Partial (demo-session label; no automated deletion pipeline) |
| 6 | Provenance (source, consent IDs, timestamps) | ✅ Met |
| 7 | Audit trail (mutations, scores, updates, fairness) | ✅ Met |
| 8 | No scraping | ✅ Met |
| 9 | No protected traits or proxy inference | ✅ Met |
| 10 | No real lending decision | ✅ Met |
| 11 | Deterministic score as source of truth | ✅ Met |
| 12 | LLM explanation restricted to evidence (if enabled) | 📋 Future (contract defined; no LLM in slice) |

**Overall:** 10 Met · 1 Partial · 0 Not Met · 1 Future. The partial item (retention/deletion) is acceptable for a simulation demo and is explicitly flagged for production hardening.

## Fairness plan (synthetic parity diagnostic)

- Fairness is evaluated offline on fixed synthetic cohorts (`cohort_alpha`, `cohort_beta`). Cohort labels are evaluation-only test strata; they are **never** model inputs.
- Per cohort, the evaluator reports: sample count, strong/stable selection rate, outcome rate (where a synthetic outcome label exists), selection-rate ratio / adverse-impact ratio relative to the reference cohort, and a sample-size warning.
- The UI labels this a **synthetic parity diagnostic** and states that small synthetic cohorts do not establish production fairness, legal compliance, causality, or absence of proxy effects.
- This is an engineering safety diagnostic aligned with NIST AI RMF Measure 2.11 (fairness and bias evaluated and documented), **not** a legal disparate-impact conclusion.

**Source:** [NIST AI RMF 1.0, Measure function](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)

## Regulatory references (official sources)

| Framework | What it covers | Source |
|-----------|----------------|--------|
| DPDP Act 2023 (India) | Consent, purpose limitation, withdrawal, data minimization | [MeitY full text](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf) · [India Code](https://www.indiacode.nic.in/handle/123456789/22037?locale=en) |
| ECOA / Regulation B (US) | Adverse-action notices, protected classes, specific reasons | [12 CFR Part 1002](https://www.consumerfinance.gov/rules-policy/regulations/1002/) |
| CFPB Circular 2022-03 | Black-box models must still provide specific reasons | [Circular](https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/) |
| NIST AI RMF 1.0 | Govern/Map/Measure/Manage trustworthy AI | [NIST AI 100-1](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf) |
| NIST Privacy Framework | Privacy risk management | [nist.gov/privacy-framework](https://www.nist.gov/privacy-framework) |

All sources accessed 2026-08-07. Regulatory texts are time-sensitive; re-verify before production use.
