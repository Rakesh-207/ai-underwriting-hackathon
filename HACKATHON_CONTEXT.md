# AI Underwriting Hackathon Context

## Mission

Build a working MVP for **AI-Driven Dynamic Underwriting Using Alternative Data** by the hackathon deadline: tomorrow at 18:00 IST.

The product is a **simulation and evaluation tool**, not a lending decision system. It must demonstrate how consented alternative signals can complement a traditional application/bureau baseline while remaining interpretable, auditable, privacy-preserving, and fairness-tested.

## Non-negotiable safety boundaries

- Synthetic applicants are the default. Any data from a team member must be explicitly volunteered and consented for this demo.
- No scraping, covert collection, inferred identity, or unconsented data.
- Do not collect credentials, raw bank logins, contact lists, precise location, protected traits, or proxy features.
- Protected traits and proxies are not model inputs. Offline fairness cohorts are synthetic labels used only to test whether the score behaves differently across test strata; they are never used in scoring.
- Never present a real lending approval, denial, price, limit, or eligibility decision.
- The deterministic/interpretable score engine is the source of truth.
- Any language model, if ever enabled, may only verbalize a structured evidence payload. It must not invent factors, values, or reasons. The MVP should work without an LLM.
- Fraud/anomaly output is a review signal, not an automatic denial.

## Role boundaries

- Hermes: STEWARD ONLY. Coordinate and dispatch work; do not research, audit, implement, or make technical decisions.
- Codex: research, architecture, compliance analysis, schema decisions, integration, verification, and final audit.
- OpenCode: implementation in isolated worktrees with disjoint write scopes.
- Use Orca orchestration for supervised parallel work. Do not substitute generic agent mesh for Orca.
- Worker model requirement: gpt-5.6-luna with medium effort. Never use gpt-5.5/high or the agent mesh.

## Current state

- Local project path: `/Users/ayya/developer/ai_hackathon`
- This directory owns an independent Git repository. The parent `/Users/ayya/developer` repository is out of scope.
- GitHub remote: pending GitHub re-authentication and private repository creation.
- Supermemory profile/container: unavailable in the current tool context. Treat this file as the source-of-truth fallback; never write to Orvyn memory.

## Proposed MVP contract

The first locked contract should include these entities and flows:

1. `ConsentReceipt`: applicant pseudonymous ID, consent ID, purposes, data categories, source, granted/revoked state, timestamp, retention, and receipt hash.
2. `ApplicantProfile`: synthetic or explicitly consented source label, baseline application/bureau fields, consented alternative fields, and no protected/proxy inputs.
3. `ScoreRequest` / `ScoreResult`: baseline score, alternative contribution, dynamic score, risk band, fraud review status, structured evidence, provenance, audit event ID, and estimated cost per decision.
4. `BehaviorUpdate`: a consent-checked event that recomputes the score and returns the before/after delta.
5. `FairnessReport`: synthetic evaluation-cohort counts, selection/risk rates, adverse-impact ratio, and limitations; no cohort label enters the model.

## Architecture decision summary

- Frontend: small static Pages app; a single demo flow is more important than a broad product shell.
- API: Hono on a Cloudflare Worker with explicit `/api/*` routes and typed bindings.
- Persistence: D1 for consent receipts, audit events, and demo snapshots if deployment credentials are available; pure in-memory/fixture repository for local tests and a no-D1 fallback.
- Model: deterministic weighted point score with contribution-level evidence and fixed band thresholds; no opaque model and no model-serving dependency.
- Fairness: deterministic offline evaluator over synthetic cohorts, rendered as a warning/diagnostic dashboard.
- Deployment: separate Pages frontend and Worker API; no auth, billing, queues, or unrelated infrastructure.

## Gate before implementation

Do not start broad implementation until the architecture/compliance memo is accepted and the shared TypeScript/JSON schemas, route list, feature allowlist, and acceptance tests are locked.
