# Cost-per-Decision Model

**Status:** First review (deterministic slice)
**Date:** 2026-08-07

> **Honesty rules.** This model separates **measured/quoted** costs from **assumptions**. The first review is deterministic and runs on Cloudflare's edge; its per-decision cost is dominated by Worker requests and (optionally) D1 writes. **No provider invoice is fabricated.** Where a price is not confirmed against an active account/plan, it is labelled `unverified`. Future-mode numbers (GPU inference, embeddings/RAG) are explicitly **assumptions** and must be re-verified before any adoption decision.

## Formula

```
costPerDecision = model_compute + data_access + storage_write + explanation
```

| Component | Definition |
|-----------|------------|
| `model_compute` | Cost of running the deterministic scorecard (Worker CPU time). |
| `data_access` | Cost of fetching external data. **Zero** in this slice — no bureau/bank/social calls. |
| `storage_write` | Cost of persisting the consent receipt, score, behavior update, and audit event. Zero on in-memory; metered on D1. |
| `explanation` | Cost of generating the plain-language explanation. **Zero** in this slice — deterministic template rendering, no LLM. |

The API response exposes this as `costEstimate` (canonical type `CostBreakdown`) with `basis: 'local_measurement' | 'runtime_estimate'`, `currency: 'USD'`, and a measured `modelComputeMs`. It does **not** claim a provider invoice.

---

## Mode 1: Deterministic Cloudflare-only (CURRENT — implemented)

This is the first-review architecture: React/Vite on Cloudflare Pages + Hono Worker + optional D1. No LLM, OCR, RAG, or live provider.

### Per-decision component costs

| Component | First-review value | Source |
|-----------|-------------------|--------|
| `model_compute` | Deterministic scorecard, ~3 ms CPU time per `POST /api/score` (local measurement). Cost derived from Workers CPU pricing below. | Measured (basis: `local_measurement`) |
| `data_access` | **$0** — no external data call; synthetic fixtures only. | By design |
| `storage_write` | 0 (in-memory) or metered D1 rows written (optional binding). | Conditional |
| `explanation` | **$0** — deterministic template rendering, no LLM. | By design |

### Deriving the compute cost from official Cloudflare pricing

Workers CPU time pricing (official, accessed 2026-08-07):

| Plan | Included CPU time | Overage rate |
|------|-------------------|-------------|
| Workers Free | 10 ms CPU per invocation (no duration charge) | — (hard cap) |
| Workers Paid ($5/mo base) | 30 million CPU-ms/month included | +$0.02 per additional million CPU-ms |

**Sources:** [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Developer-platform plans](https://www.cloudflare.com/plans/developer-platform/)

A single simulation decision at ~3 ms CPU:

- **Workers Free plan:** $0 — within the 10 ms/invocation cap; daily request allowance is 100,000/day shared across the Worker.
- **Workers Paid plan:** 3 ms is inside the 30M CPU-ms/month included allotment. Marginal overage (if exhausted) = 3 ms × $0.02 / 1,000,000 = **$0.00000006 per decision** — effectively zero.

### Request pricing (the dominant dimension at scale)

| Plan | Included requests | Overage rate |
|------|-------------------|-------------|
| Workers Free | 100,000 requests/day | — (returns Error 1027 when exceeded) |
| Workers Paid ($5/mo) | 10 million requests/month | +$0.30 per additional million |

A full demo journey is ~5–7 API requests (health, applicants, consent, score, behavior, fairness, audit). So one "decision journey" ≈ a handful of billable requests.

- **Free plan:** up to ~14,000–20,000 decision journeys/day within the 100k daily request cap, at **$0**.
- **Paid plan:** up to ~1.4–2 million decision journeys/month within the 10M monthly request allotment, at **$5/month flat**. Beyond that, each additional million requests costs $0.30 (i.e., ~$0.0000003–0.0000002 per request depending on journey length).

### Optional D1 storage write cost

D1 pricing (official, accessed 2026-08-07):

| Plan | Rows read | Rows written | Storage |
|------|-----------|--------------|---------|
| Free | 5 million/day | 100,000/day | 5 GB total |
| Paid | 25 billion/month included (+$0.001/million) | 50 million/month included (+$1.00/million) | 5 GB included (+$0.75/GB-mo) |

**Source:** [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/)

A single decision writes roughly: 1 consent receipt + 1 score record + 1 behavior update + a few audit events ≈ single-digit to low-tens of rows.

- **Free plan:** comfortably within 100,000 rows written/day → **$0**.
- **Paid plan:** well within 50 million rows written/month → **$0** marginal at demo scale.

### Pages hosting cost

| Plan | Static requests | Bandwidth | Builds |
|------|-----------------|-----------|--------|
| Free | Unlimited | Unlimited | 500/month, 1 concurrent |

**Source:** [Cloudflare Pages](https://pages.cloudflare.com/) · [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

The frontend is a static React/Vite build → **$0** on the Free plan with unlimited static requests and bandwidth.

### Bottom line — Mode 1 per-decision cost

| Scenario | model_compute | data_access | storage_write | explanation | **Total per decision** |
|----------|---------------|-------------|---------------|-------------|------------------------|
| Free plan, in-memory repo | $0 | $0 | $0 | $0 | **$0** |
| Free plan, D1 binding | $0 | $0 | $0 | $0 | **$0** |
| Paid plan ($5/mo), in-memory | ~$0 (within included CPU-ms) | $0 | $0 | $0 | **~$0 marginal** |
| Paid plan ($5/mo), D1 | ~$0 | $0 | ~$0 (within included rows) | $0 | **~$0 marginal** |

**Deployment plan status:** `unverified` — no Cloudflare account/plan is confirmed for this demo. If the deployment uses the Free plan, all of the above is $0. If a Paid plan is in use, the floor is $5/month regardless of decision volume. The API's `costEstimate.basis` reports `local_measurement` for compute timing and does **not** convert this into an invoice figure.

### Clerk authentication cost (per active demo user)

Clerk pricing (official, accessed 2026-08-07):

| Plan | Included Monthly Retained Users (MRU) | Overage |
|------|----------------------------------------|---------|
| Hobby | 50,000 MRU/app, free | — (grace period, then upgrade) |
| Pro | 50,000 MRU included ($25/mo) | $0.02/MRU (50k–100k band), graduated above |

**Sources:** [Clerk pricing](https://clerk.com/pricing) · [Clerk pricing explained](https://clerk.com/articles/clerk-pricing-explained)

For a hackathon demo with a small number of evaluator users, Clerk is **$0** on the Hobby tier (well under 50,000 MRU). Authentication cost per decision is therefore $0 at demo scale.

---

## Mode 2: Future self-hosted inference (NOT implemented — assumptions)

> The first review does **not** use self-hosted model inference. The scorecard is pure TypeScript. The numbers below are **assumptions** for planning only; no vendor is selected and no cost has been measured or quoted.

If a future phase self-hosted model inference (e.g., on a GPU server) to augment or replace part of the deterministic scorecard:

| Component | Assumed basis | Status |
|-----------|---------------|--------|
| GPU server rental | ASSUMPTION — would depend on vendor (e.g., Cloudflare Containers, Modal, a bare-metal GPU box), GPU class, utilization, and region. No vendor selected. | ❌ Unverified |
| Per-inference cost | ASSUMPTION — only derivable once a model size, batch profile, and vendor are chosen. | ❌ Unverified |
| `model_compute` impact | Would replace the ~$0 deterministic CPU-ms figure with a GPU-minute-based figure. | ❌ Unverified |

**Do not quote these numbers.** They exist only to document that the cost model has a placeholder for a future self-hosted-inference decision. When/if this mode is adopted, re-derive from the chosen vendor's official pricing page and record the access date in `source-registry.md`.

---

## Mode 3: Future embedding/RAG (NOT implemented — assumptions)

> The first review does **not** use embeddings or RAG. The `LocalRagProvider`/`CloudflareRagProvider` interfaces are designed but not implemented. The numbers below are **assumptions** based on official Cloudflare product pages but are not measured against an active account.

If a future phase enabled embedding + Vectorize + Workers AI for evidence-grounded explanation retrieval:

| Component | Reference pricing page | Status |
|-----------|------------------------|--------|
| Workers AI (embeddings/inference) | https://developers.cloudflare.com/workers-ai/platform/pricing/ | ❌ Assumption — per-token/per-image rates to be confirmed at adoption |
| Vectorize (vector index storage + queries) | https://developers.cloudflare.com/vectorize/platform/pricing/ | ❌ Assumption — dimensions, queried-units, and stored-nodes rates to be confirmed |
| LLM explanation generation (if enabled) | Would add an `explanation > 0` line item for the chosen model. | ❌ Assumption — vendor/model not selected |

**At adoption time**, the per-decision formula gains non-zero `explanation` and possibly a small `model_compute` uplift from the embedding call. The deterministic template fallback keeps `explanation = 0` as the guaranteed floor if the model is unavailable or validation fails.

---

## Summary

| Mode | Status | Per-decision cost | Basis |
|------|--------|-------------------|-------|
| **1. Deterministic Cloudflare-only** | ✅ Current / implemented | **$0** (Free plan) or ~$0 marginal (Paid plan, within included allotments) | Official Cloudflare pricing + local measurement |
| 2. Self-hosted inference | 📋 Future | **ASSUMPTION** — unverified | No vendor selected |
| 3. Embedding/RAG | 📋 Future | **ASSUMPTION** — unverified | Official pricing pages to be re-queried at adoption |

**What the demo reports:** `costEstimate` in the API response carries `modelComputeMs` (measured), `dataAccess: 0`, `explanation: 0`, a `storageWrite` basis flag, and `basis: 'local_measurement'`. It does not convert to a dollar invoice and does not invent provider costs. The deployment cost basis is reported as `unverified` if no Cloudflare plan is confirmed.

**What the demo does not claim:**
- A provider invoice.
- Measured GPU or embedding costs (none exist).
- A production cost guarantee (demo scale only).
- That future modes are free (they are unpriced assumptions).
