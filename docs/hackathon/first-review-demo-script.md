# First Review Demo Script (8 Minutes)

**Status:** First review (deterministic slice)
**Date:** 2026-08-07
**Audience:** Hackathon evaluators
**Total runtime:** 8:00 (hard limit)

> **Scope honesty.** This script describes exactly what is implemented in the first review. The slice is **deterministic-only**: Clerk authentication, explicit consent, synthetic fixtures, a deterministic TypeScript scorecard, structured evidence, rule-based anomaly review, behavior updates, and a synthetic parity diagnostic. **OCR, LLM explanation generation, embedding models, RAG, self-hosted inference, real provider integrations, and autonomous agents are NOT implemented.** If any of those are mentioned, they are explicitly labelled `Future scope` and are never demonstrated as working.

## Pre-demo checklist (run before the clock starts)

- [ ] Local dev servers running (Pages + Worker) or deployment URL reachable.
- [ ] `GET /api/health` returns `{ "status": "ok", "repository": "memory" | "d1", "modelVersion": "scorecard-v1" }`.
- [ ] Hero fixture `app-maya-001` and anomaly fixture loaded.
- [ ] Browser at 1280×800, console closed, Clerk session signed out.
- [ ] Backup screenshots captured in case of network failure.
- [ ] Timer visible to the presenter.

## Demo timeline

| Time | Segment | What to Show | Talking Points |
|------|---------|--------------|----------------|
| 0:00–0:30 | Clerk sign-in | Navigate to `/app`. Clerk sign-in screen renders. Complete sign-in (test principal in fixture mode, or real Clerk account). Land on `/app/overview`. | "Authentication is required before any simulation data is touched. We use Clerk — identity is separate from consent. Signing in does not grant access to any applicant data." Emphasise the pre-consent boundary: no application or alternative data loads before a receipt exists. |
| 0:30–1:00 | Explicit consent | Open `/app/consent`. Show four purpose cards: `application_baseline`, `alternative_cashflow`, `behavior_updates`, `fraud_screening`. Each card shows data categories, source (`synthetic_fixture`), demo-session retention, and revocation text. Check each purpose (affirmative action). Click **Grant selected consent**. Show the returned receipt with `consentId`, `receiptHash`, and `status: granted`. | "Consent is purpose-bound and per-category. The API creates a server-side receipt with a hash. Nothing is inferred — every purpose is an explicit affirmative action. Revocation is first-class: the next score excludes the signal." |
| 1:00–1:45 | Synthetic application | Open `/app/applicant`. Show `app-maya-001` ("Synthetic Maya"). Display exactly the five allowlisted baseline fields: `bureauScore` (e.g. 680), `monthlyIncome`, `monthlyDebt`, `employmentMonths`, `applicationCompleteness`. Provenance row reads `source: synthetic_fixture`, `fixtureId: hero-applicant-v1`. | "All applicants are synthetic. We use pseudonymous IDs — no real PII. The feature registry rejects protected traits and proxy-like fields at the schema boundary. These five baseline fields are the traditional application/bureau signal." |
| 1:45–2:45 | Bureau/salary-based baseline score | Open `/app/score`. With baseline-only context, show the **baseline reliability score** (e.g. 72/100), risk band (`stable`), and `scoreMeaning: higher_is_stronger_reliability`. Explain the 0–100 bounded index is not a probability. Show the baseline evidence ledger rows. | "The deterministic scorecard is the source of truth. This is a bounded 0–100 reliability index — higher means stronger demonstrated reliability. It is explicitly not a probability and not a bank's credit score. Bands are fixed and visible: watch, guarded, stable, strong." |
| 2:45–3:45 | Dynamic score with consented alternative data | Still on `/app/score`, toggle to consented-dynamic mode (the valid receipt from step 2 is already attached). Show the score recompute with the four consented alternative signals: `cashflowStability`, `incomeConsistency`, `savingsBufferMonths`, `onTimePaymentRate`. Baseline (72) → Dynamic (80). Show the **+8 alternative contribution** and the updated band. | "Because we have a valid receipt covering `alternative_cashflow`, the dynamic score adds the consented alternative contribution. The score formula is transparent: 65% baseline weight, 35% alternative weight, minus a capped anomaly adjustment. Without consent, this contribution is exactly zero — baseline-only." |
| 3:45–4:30 | Evidence explanation | Open the evidence ledger / detail panel. Walk through each `EvidenceItem`: `featureKey`, `label`, `normalizedValue`, `signedPoints`, `direction` (supports/reduces/neutral), `source`, `consentId`, `explanation`. Point out that every explanation sentence is generated from the same structured row — no LLM invented a reason. | "Every point is traceable. The explanation is rendered from the structured evidence — a template reads the signed points and direction. An LLM is not used in the decision path in this slice. If an LLM is ever enabled, it may only verbalize evidence that already exists here; it cannot add a factor." |
| 4:30–5:15 | Anomaly review signal | Trigger the anomaly fixture (income/expense mismatch, duplicate application burst, or impossible event sequence). The `FraudReview` card updates to `status: review` or `high_review` with flags and `action: manual_review`. **Emphasise:** the anomaly does not change the risk score silently and does not auto-deny. | "This is a separate, rule-based path. Anomalies produce a manual-review signal with explainable flags — they never silently change the score or make an outcome decision. This is a review signal, not an automatic denial. The rules are deterministic and versioned (`anomaly-v1`)." |
| 5:15–6:15 | Behavior update | Open `/app/behavior`. Apply a consented behavior event (e.g. `payment_observation`, value 0.98). The API checks the `behavior_updates` purpose on the receipt, recomputes the score, and returns before/after. Show: before = 80, after = 82, delta = +2. Show the `changedEvidence` row. | "A behavior update is a consent-checked event that recomputes the score. The consent receipt must cover `behavior_updates`; a revoked receipt returns `CONSENT_REQUIRED`. The before/after delta and the exact changed evidence are returned in one response." |
| 6:15–6:45 | Changed score (post-update) | Back on `/app/score`, the score now reads 82 with the updated evidence ledger reflecting the new payment observation. Risk band remains `stable`. Provenance now includes the behavior update reference. | "The score moved because of a consented, observed behavior event — not because of a hidden model change. The evidence ledger shows exactly which feature moved and by how many points." |
| 6:45–7:45 | Audit and fairness view | Open `/app/audit`. Show the audit timeline: consent receipt created → score generated → behavior update applied. Each event has model version, feature registry version, consent IDs, provenance refs, and cost estimate. Then open `/app/fairness`: synthetic parity diagnostic on evaluation-only cohorts (`cohort_alpha`, `cohort_beta`). Show selection-rate ratio, adverse-impact ratio, and the sample-size warning. | "Every action is auditable. The fairness view is a synthetic parity diagnostic — cohort labels are evaluation-only and never model inputs. Small synthetic cohorts do not establish production fairness, legal compliance, or absence of proxy effects. This is an engineering safety diagnostic, not a legal conclusion." |
| 7:45–8:00 | Closing | Summarise: simulation-only, consented alternative data, deterministic evidence, separate anomaly review, auditability, cost-per-decision. State explicitly what is NOT implemented (OCR, LLM, RAG, live providers). Point to the cost model and limitations docs. | "This is a simulation, not a lending decision. Cost per decision is near-zero on Cloudflare's free tier — see the cost model. OCR, LLM, and RAG are future scope. The deterministic core works without them." |

## Backup talking points (if time allows / Q&A)

- **Revocation demo (if asked):** Revoke `con-001` via `POST /api/consent/:consentId/revoke`, then re-run the score → baseline-only with `alternativeContribution: 0` and provenance explaining the signal was excluded. A behavior update using the revoked receipt returns `CONSENT_REQUIRED`. Re-revoking returns `409 CONFLICT`.
- **Cross-user isolation (if asked):** A verified Clerk user can only see their own simulations/receipts. Cross-user access returns `403 FORBIDDEN` and writes a redacted audit failure event.
- **Copy test (if asked):** A release copy scan checks rendered UI strings against a blocklist. No "approve", "deny", "eligible", "rate", "limit" lending-outcome language appears.

## Things never to say during the demo

- "The AI approved/denied this applicant." → It did not. It produced a simulation band and a review signal.
- "This is the applicant's real credit score." → It is a synthetic reliability index, not a bureau score.
- "The model learned…" → The scorecard uses fixed, published constants, not learned weights.
- "We scrape…" → No scraping. No live data access. Fixtures only.
- "The LLM explained…" → No LLM in the decision path in this slice. Template rendering only.

## What is explicitly future scope (state if asked, never demo as working)

| Future component | Status | Notes |
|------------------|--------|-------|
| OCR document extraction | Future | `DocumentExtractor` interface is defined; no implementation. |
| LLM explanation generation | Future | Explanation is deterministic template rendering only. An LLM, if ever enabled, may only verbalize existing evidence. |
| Embedding models + RAG | Future | `LocalRagProvider` fallback is designed; `CloudflareRagProvider` would use Workers AI + Vectorize. No corpus is live. |
| Self-hosted model inference | Future | Not present. Scorecard is pure TypeScript. |
| Real provider integrations (bureau, bank, payroll) | Future | Adapter contracts (`BureauAdapter`, etc.) are defined. No live credentials. |
| Autonomous agents | Future | Typed agent interfaces are sketched. No autonomous agent runtime in this slice. |

## Timing budget summary

| Block | Seconds | Cumulative |
|-------|---------|------------|
| Clerk sign-in | 30 | 0:30 |
| Consent | 30 | 1:00 |
| Applicant | 45 | 1:45 |
| Baseline score | 60 | 2:45 |
| Dynamic score | 60 | 3:45 |
| Evidence | 45 | 4:30 |
| Anomaly | 45 | 5:15 |
| Behavior update | 60 | 6:15 |
| Changed score | 30 | 6:45 |
| Audit + fairness | 60 | 7:45 |
| Closing | 15 | 8:00 |
| **Total** | **480** | **8:00** |

Leave a 10–15 second buffer by trimming the closing remarks if any earlier segment runs long. Never cut the consent, evidence, or anomaly segments — they carry the safety story.
