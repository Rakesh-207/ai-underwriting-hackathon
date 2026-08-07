# Source Registry

**Status:** First review (deterministic slice)
**Date compiled:** 2026-08-07

Every factual claim about external services, regulations, frameworks, or pricing in the P0B documentation lane is mapped here to an official or primary source. **Source type legend:** Official = vendor/government primary site; Primary = canonical text; Standards = standards body.

> All URLs accessed 2026-08-07 unless noted. Regulatory and pricing texts are time-sensitive; re-verify before production use or budgeting.

## A. Regulatory and standards sources

| Claim | Source URL | Access Date | Source Type |
|-------|-----------|-------------|-------------|
| India DPDP Act 2023 — consent must be free, specific, informed, with clear affirmative action, limited to necessary data (§6(1)) | https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf | 2026-08-07 | Primary (statute) |
| India DPDP Act 2023 — right to withdraw consent at any time, ease comparable to granting (§6(4)); cease processing within reasonable time (§6(6)) | https://indiankanoon.org/doc/15072321/ | 2026-08-07 | Primary (statute) |
| India DPDP Act 2023 — official act metadata (Act 22 of 2023, MeitY) | https://www.indiacode.nic.in/handle/123456789/22037?locale=en | 2026-08-07 | Official |
| India DPDP Act 2023 — gazette publication | https://egazette.gov.in/WriteReadData/2023/248045.pdf | 2026-08-07 | Primary (gazette) |
| CFPB Circular 2022-03 — adverse-action notices required even for complex/black-box algorithms; reasons must relate to factors actually scored | https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/ | 2026-08-07 | Official |
| CFPB Circular 2022-03 — PDF full text | https://files.consumerfinance.gov/f/documents/cfpb_2022-03_circular_2022-05.pdf | 2026-08-07 | Official |
| CFPB news release on black-box credit models | https://www.consumerfinance.gov/about-us/newsroom/cfpb-acts-to-protect-the-public-from-black-box-credit-models-using-complex-algorithms/ | 2026-08-07 | Official |
| CFPB Innovation spotlight — adverse action notices with AI/ML models | https://www.consumerfinance.gov/about-us/blog/innovation-spotlight-providing-adverse-action-notices-when-using-ai-ml-models/ | 2026-08-07 | Official |
| CFPB Regulation B / 12 CFR Part 1002 — ECOA implementing rules, protected classes | https://www.consumerfinance.gov/rules-policy/regulations/1002/ | 2026-08-07 | Official |
| FTC Fair Credit Reporting Act overview | https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act | 2026-08-07 | Official |
| CFPB interagency statement on alternative data in credit underwriting | https://www.consumerfinance.gov/archive/newsroom/federal-regulators-issue-joint-statement-use-alternative-data-credit-underwriting/ | 2026-08-07 | Official |
| NIST AI Risk Management Framework 1.0 (Govern/Map/Measure/Manage) | https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf | 2026-08-07 | Standards (NIST) |
| NIST AI RMF landing page and Playbook | https://www.nist.gov/itl/ai-risk-management-framework | 2026-08-07 | Standards (NIST) |
| NIST AI RMF Core (AIRC) | https://airc.nist.gov/airmf-resources/airmf/5-sec-core/ | 2026-08-07 | Standards (NIST) |
| NIST AI RMF Playbook | https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook | 2026-08-07 | Standards (NIST) |
| NIST Privacy Framework | https://www.nist.gov/privacy-framework | 2026-08-07 | Standards (NIST) |

## B. Cloudflare platform and pricing sources

| Claim | Source URL | Access Date | Source Type |
|-------|-----------|-------------|-------------|
| Cloudflare Workers pricing — Free plan 100,000 req/day, 10ms CPU; Paid $5/mo, 10M req/mo included + $0.30/additional million, 30M CPU-ms included + $0.02/additional million | https://developers.cloudflare.com/workers/platform/pricing/ | 2026-08-07 | Official |
| Cloudflare Workers pricing — developer-platform plans page | https://www.cloudflare.com/plans/developer-platform/ | 2026-08-07 | Official |
| Cloudflare Workers limits — Free 100k req/day, 128MB memory, 10ms CPU; Paid 5min CPU | https://developers.cloudflare.com/workers/platform/limits/ | 2026-08-07 | Official |
| Cloudflare D1 pricing — Free 5M rows read/day, 100k rows written/day, 5GB storage; Paid 25B rows read/mo + $0.001/million, 50M rows written/mo + $1.00/million, 5GB + $0.75/GB-mo | https://developers.cloudflare.com/d1/platform/pricing/ | 2026-08-07 | Official |
| Cloudflare D1 FAQ — free tier always available; no egress charges | https://developers.cloudflare.com/d1/reference/faq/ | 2026-08-07 | Official |
| Cloudflare Pages — Free: 500 builds/mo, unlimited static requests, unlimited bandwidth, 20,000 files | https://pages.cloudflare.com/ | 2026-08-07 | Official |
| Cloudflare Pages limits — builds/concurrency per plan | https://developers.cloudflare.com/pages/platform/limits/ | 2026-08-07 | Official |
| Cloudflare billing — how charges accrue (Workers requests, CPU time, KV, D1) | https://developers.cloudflare.com/billing/understand/how-charges-accrue/ | 2026-08-07 | Official |
| Cloudflare Pages Hono deployment guide | https://developers.cloudflare.com/pages/framework-guides/deploy-a-hono-site/ | 2026-08-07 | Official |
| Hono Cloudflare Workers guide — typed bindings, module Worker export | https://hono.dev/docs/getting-started/cloudflare-workers | 2026-08-07 | Official |
| Cloudflare D1 migrations — versioned SQL files, local/remote workflow | https://developers.cloudflare.com/d1/reference/migrations/ | 2026-08-07 | Official |
| Cloudflare Workers AI / Vectorize (future RAG provider) — referenced for future architecture only | https://developers.cloudflare.com/workers-ai/ · https://developers.cloudflare.com/vectorize/ | 2026-08-07 | Official |

## C. Authentication provider sources

| Claim | Source URL | Access Date | Source Type |
|-------|-----------|-------------|-------------|
| Clerk pricing — Hobby free (50,000 MRU/app), Pro $25/mo, Business $300/mo; MRU model explained | https://clerk.com/pricing | 2026-08-07 | Official |
| Clerk pricing explained — MRU vs MAU, plan tiers, overage rates ($0.02/MRU 50k–100k band) | https://clerk.com/articles/clerk-pricing-explained | 2026-08-07 | Official |
| Clerk changelog — 50,000 MRU free tier (Feb 5 2026) | https://clerk.com/changelog/2026-02-05-new-plans-more-value | 2026-08-07 | Official |
| Clerk documentation home | https://clerk.com/docs | 2026-08-07 | Official |

## D. Architecture and framework sources

| Claim | Source URL | Access Date | Source Type |
|-------|-----------|-------------|-------------|
| Hono framework — routing, middleware, Cloudflare bindings | https://hono.dev/ | 2026-08-07 | Official |
| React documentation | https://react.dev/ | 2026-08-07 | Official |
| Vite build tool | https://vite.dev/ | 2026-08-07 | Official |
| Vitest test runner | https://vitest.dev/ | 2026-08-07 | Official |
| Playwright end-to-end testing | https://playwright.dev/ | 2026-08-07 | Official |
| Zod schema validation | https://zod.dev/ | 2026-08-07 | Official |
| Tailwind CSS | https://tailwindcss.com/ | 2026-08-07 | Official |
| shadcn/ui component library | https://ui.shadcn.com/ | 2026-08-07 | Official |

## E. Internal project sources (repository)

These are the canonical internal documents that define the product contract. They are not external sources but are cited within the hackathon docs.

| Internal source | Path | Authoritative for |
|-----------------|------|-------------------|
| Hackathon context | `HACKATHON_CONTEXT.md` | Mission, safety boundaries, role boundaries |
| Architecture & compliance memo | `docs/ARCHITECTURE_COMPLIANCE_MEMO.md` | Score contract, feature allowlist, invariants, demo outline |
| MVP implementation plan | `docs/superpowers/plans/2026-08-07-ai-underwriting-mvp.md` | Phase roadmap, contract lock, lane write scopes |
| Vertical-slice design | `docs/superpowers/specs/2026-08-07-vertical-slice-design.md` (design branch) | UI screens, API contract, storage boundary, acceptance criteria |
| Auth & routing contract | `docs/superpowers/specs/2026-08-07-auth-and-routing-contract.md` | Clerk auth, ConsentReceipt identity fields, route auth matrix |

## F. Future-scope components (licensing/pricing placeholders)

The following are referenced in the future architecture but **not implemented** in the first review. Pricing claims for these are **assumptions** to be validated when the component is adopted; no measured cost exists.

| Future component | Reference | Notes |
|------------------|-----------|-------|
| Workers AI (embeddings/inference) | https://developers.cloudflare.com/workers-ai/platform/pricing/ | Pricing to be confirmed at adoption time |
| Vectorize (vector index) | https://developers.cloudflare.com/vectorize/platform/pricing/ | Pricing to be confirmed at adoption time |
| Self-hosted GPU inference | N/A — no vendor selected | ASSUMPTION only; no measured or quoted cost |
| Licensed bureau/bank/payroll providers | N/A — no provider contracted | Requires licensed access; no cost claim made |

## G. Gaps and placeholders

- **Codex research worker (Lane Task A) findings:** Supermemory confirms a parallel Codex research lane covered fairness/disparate-impact methodology and Indian DPDP analysis. Those findings informed the compliance checklist above; if a standalone Lane Task A artifact is committed later, it should be cross-linked here.
- **Cloudflare account plan:** The demo's deployment plan (Free vs Paid) is unverified pending credential confirmation. Per-decision cost in `cost-model.md` is therefore presented for both tiers and labelled "unverified" where appropriate.
- **Workers AI / Vectorize pricing:** URLs point to official pricing pages but specific per-unit numbers are intentionally not transcribed here because they change; they will be captured in `cost-model.md` only when the component is adopted and re-verified.
