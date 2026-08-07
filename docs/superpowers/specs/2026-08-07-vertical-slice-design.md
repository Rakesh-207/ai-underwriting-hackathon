# AI Underwriting Vertical Slice Design

**Status:** P0B design lock
**Date:** 2026-08-07
**Scope:** First evaluator-visible, simulation-only loan-application and underwriting workbench

## 1. Purpose and non-negotiable boundary

The first slice is a small React/Vite workbench that walks an evaluator through one synthetic applicant: baseline application data, purpose-specific consent, a clearly labelled alternative-data fixture, a deterministic score comparison, evidence, a behavior update, and a provenance/limitations review. It demonstrates an interpretable reliability signal; it is not a lending decision system.

The deterministic scorecard is the source of truth. The API calculates the score and its evidence before any optional explanation streaming begins. Streaming, if added during implementation, is limited to rendering an explanation panel and can never change `ScoreResult`, score bands, fraud review, provenance, or cost. The first slice is fully functional without an LLM, OCR, RAG, Agents SDK, Durable Objects, Vectorize, or live providers.

Safety invariants:

- All applicants and alternative data are synthetic fixtures in this slice.
- Alternative signals are excluded unless a valid receipt covers both the data category and purpose. Revocation excludes them on the next score.
- Only the allowlisted baseline fields and derived alternative fields are accepted. No credentials, precise address, protected traits, proxy traits, raw social content, scraped content, or live bank access is accepted or stored.
- Fraud output is a manual review signal with explainable flags; it is not an automatic outcome.
- Synthetic evaluation cohorts are diagnostic labels only and never enter scoring.
- Every public response has `schemaVersion`; every score has model, feature-registry, provenance, evidence, audit, and cost metadata.

The UI must use only these result terms: **simulation result**, **reliability score**, **risk band**, **manual review signal**, **alternative contribution**, and **consented signal**. Product copy must not imply a real-world outcome, offer, eligibility, pricing, limit, or lender action. A copy test scans rendered UI strings and source-owned UI copy against the project blocklist before release.

## 2. Architecture and slice data flow

```text
React/Vite Pages app
  |  VITE_API_BASE_URL + JSON fetches
  v
Hono API on one Cloudflare Worker
  |-- validation + purpose/consent guard
  |-- deterministic scorecard (source of truth)
  |-- rule-based anomaly review
  |-- evidence-constrained explanation renderer (optional stream, display only)
  |-- self-check + cost calculation
  `-- SimulationRepository
        |-- InMemorySimulationRepository (local/default)
        `-- D1SimulationRepository (deferred deployment adapter)
```

The browser owns navigation and presentation state only. The Worker owns request validation, consent enforcement, orchestration, scoring, explanation assembly, audit writes, and response streaming. The browser never computes or edits a score. A score response is complete JSON; an optional explanation stream is a separate display enhancement and is not a prerequisite for the journey.

The runtime boundary follows the v2 architecture records: typed cooperating units, not prompt-defined behavior. The first slice may implement only the deterministic units needed by this journey, but interfaces leave room for consent/policy guard, scorecard, anomaly review, evidence explanation, self-check, audit/cost writer, fairness evaluator, and RAG retrieval. RAG is separate from Supermemory. `LocalRagProvider` is the guaranteed future fallback; `CloudflareRagProvider` may use Workers AI and Vectorize only when those bindings exist.

The dependency gate is explicit: architecture/UI/RAG decisions precede shared contract lock; contract lock precedes implementation; score, API, UI, and evaluation lanes may proceed in parallel only after contracts freeze; API integration waits for score and agent interfaces; UI integration waits for API responses; screenshots and rehearsal wait for end-to-end integration.

## 3. UI information architecture

### 3.1 Application shell and navigation

Every post-entry screen uses a responsive shell:

- Header: product name `Underwriting Simulation Workbench`, environment pill `Synthetic demo`, and current simulation ID.
- Left navigation, in this exact order: `Overview | Consent | Applicant | Score | Behavior | Fairness | Audit`.
- Main content: page title, one-sentence purpose, simulation-only banner, page-specific content, and a next-step action.
- Right-side or bottom summary on wide screens: applicant ID, current reliability score, risk band, consent state, and last updated time.

`Fairness` is a diagnostic destination even though the eleven-step hero journey reaches it through the Audit/limitations review. It must state that its cohorts are synthetic evaluation labels. A disabled navigation item is never used; unavailable data is represented by an explicit empty state.

### 3.2 Eight screens and flow

| Screen | Purpose | Primary content | Primary action |
|---|---|---|---|
| Landing / simulation entry | Establish scope and begin a demo | Product purpose, synthetic-data badge, simulation-only banner, privacy boundary, fixture selector | `Run a consented simulation` |
| Applicant and baseline application | Choose and inspect the synthetic applicant | Applicant ID/display name, five allowed baseline fields, completeness indicator, baseline provenance | `Review consent` |
| Consent | Capture purpose-bound affirmative consent | Purpose cards, categories, source, retention, revocation behavior, checkboxes | `Grant selected consent` |
| Alternative-data fixture | Load the synthetic dynamic signals | Fixture ID, four derived signals, source label, fixture version, no-live-integration note | `Compare simulation result` |
| Score comparison | Show baseline vs dynamic result | Baseline score, alternative contribution, dynamic score, risk band, score meaning, manual review signal | `View evidence` |
| Evidence detail | Explain every contribution | Evidence ledger, direction, points, normalized value, source, receipt ID, explanation text | `Apply behavior update` |
| Behavior update | Recompute after a consented event | Event form, before/after scores, delta, changed evidence, consent check | `Review audit` |
| Audit / provenance / limitations | Close the loop and disclose limits | Audit timeline, receipt IDs, provenance, model/registry versions, cost estimate, limitations, fairness link | `Open fairness diagnostic` |

### 3.3 Eleven-step journey mapping

1. Landing page → Landing / simulation entry.
2. Start a consented simulation → Landing action creates a client-side pending simulation and opens Applicant.
3. Load a synthetic applicant → Applicant fixture selector and `GET /api/demo/applicants`.
4. Show traditional baseline data → Applicant baseline card.
5. Grant consent for alternative data → Consent screen and `POST /api/consent`.
6. Load a synthetic alternative-data fixture → Alternative-data fixture screen; fixture is local/demo data, not OCR or a live integration.
7. Show baseline versus dynamic score → Score comparison and `POST /api/score`.
8. Show evidence-backed explanation → Evidence detail, using only `evidence[]` and provenance from `ScoreResult`.
9. Apply a behavior update → Behavior form and `POST /api/behavior`.
10. Show changed score and evidence → Behavior result plus refreshed Score/Evidence views.
11. Show provenance, limitations, and simulation-only language → Audit screen, global banner, and limitations panel; fairness diagnostic is linked from here.

## 4. Visible copy and safety language

### 4.1 Exact global and entry copy

The following strings are locked for the first slice:

```text
Underwriting Simulation Workbench
Synthetic demo · No live applicant data
Simulation only. This workbench demonstrates how consented signals can complement a traditional application baseline. It does not produce a real lending outcome.
Reliability score: a bounded 0–100 simulation index. Higher values indicate stronger demonstrated reliability within this synthetic demo; the score is not a probability.
Risk band: a descriptive simulation grouping, not a real-world determination.
Manual review signal: an explainable anomaly indicator for human inspection. It is not an automatic outcome.
Run a consented simulation
All data in this demo is synthetic fixture data. No credentials, live bank access, scraping, precise location, protected traits, or social content are used.
```

### 4.2 Consent copy

```text
Consent is purpose-bound
Choose each purpose separately. Only selected, valid purposes may contribute signals to this simulation.
I understand that this synthetic signal may be used for the selected simulation purpose.
Source: synthetic fixture
Retention: demo session
Revocation: you can revoke this consent at any time; the next simulation result will exclude the affected signal.
No live account connection is requested or supported.
Grant selected consent
```

Purposes shown as separate cards are `application_baseline`, `alternative_cashflow`, `behavior_updates`, and `fraud_screening`. Baseline use is disclosed even though baseline fields are fixture data. The alternative card names its categories and explains that the fixture contains derived values only.

### 4.3 Provenance and limitations copy

Each score shows:

```text
Provenance
Source: synthetic_fixture
Fixture: hero-applicant-v1
Consent receipts used: <receipt IDs or “None — baseline-only result”>
Purpose used: <purpose names>
Model version: scorecard-v1
Feature registry: registry-v1
Generated: <ISO timestamp rendered in the viewer’s locale with the ISO value available to assistive technology>
```

The limitations panel shows:

```text
Limitations
This is a synthetic simulation result, not a real-world lending outcome.
Alternative data is a labelled synthetic fixture. OCR, live bank access, bureau access, and social-data integrations are not present.
The deterministic score is a bounded reliability index, not a probability or universal standard.
The manual review signal is a diagnostic flag and does not make an automatic outcome.
Fairness is shown only as a synthetic parity diagnostic. Small synthetic cohorts do not establish production fairness, legal compliance, causality, or the absence of proxy effects.
Deployment cost is reported as an estimate from measured local/runtime components; no provider invoice is implied.
```

### 4.4 Required copy behavior in states

No success state may suggest that the simulation is a real-world action. Use `Simulation result updated`, `Consent receipt created`, `Evidence loaded`, and `Behavior update applied`. No error state should expose stack traces, provider credentials, raw payloads, or unredacted personal data.

## 5. Fields and validation

### 5.1 Allowed profile data

| Field | Type and validation | Display |
|---|---|---|
| `applicantId` | string; synthetic ID pattern `app-[a-z0-9-]+`; required | Synthetic applicant ID |
| `displayName` | string; 1–80 chars; fixture-only | Synthetic display name |
| `bureauScore` | integer; 0–1000; required | Synthetic bureau-like score |
| `monthlyIncome` | integer; 0–1,000,000; required | Monthly income (demo units) |
| `monthlyDebt` | integer; 0–1,000,000; required and not greater than 10× income | Monthly debt (demo units) |
| `employmentMonths` | integer; 0–600; required | Employment duration |
| `applicationCompleteness` | number; 0–1 inclusive; required | Application completeness |

Alternative fixture fields are derived and consent-gated: `cashflowStability`, `incomeConsistency`, `savingsBufferMonths`, and `onTimePaymentRate`. The first two and last are numbers in `[0,1]`; `savingsBufferMonths` is an integer in `[0,24]`. The fixture requires `source: synthetic_fixture`, a fixture ID/version, and no free-form content. Unknown fields fail closed.

### 5.2 Forms

| Form | Fields | Validation and submit behavior |
|---|---|---|
| Simulation entry | `applicantId` select; optional fixture version select | Must select a listed fixture; disabled submit while loading; fixture lookup failure preserves retry. |
| Consent | one boolean per purpose; read-only source/category/retention metadata | At least `application_baseline` and one intended dynamic purpose must be selected to continue; the API revalidates every purpose. Unchecked dynamic purpose produces baseline-only mode. |
| Alternative fixture | fixture ID/version read-only; signal preview read-only | Must match the selected synthetic applicant and an active receipt; otherwise show `Consent required for this signal` and do not call score. |
| Behavior update | `eventType` enum `income_observation`, `payment_observation`, or `savings_observation`; `value` number; `observedAt` ISO date-time; `source` fixed `synthetic_fixture` | Value must be finite and within the event-specific documented range; date-time must be valid and not outside the demo fixture window; API confirms consent for `behavior_updates`. |

The control character shown in the event enum above is not part of the public value set; the actual allowed values are the three names separated by a TypeScript union. UI options render as `Income observation`, `Payment observation`, and `Savings observation`.

### 5.3 Error envelope and UI errors

All API failures use:

```ts
interface ErrorEnvelope {
  schemaVersion: string;
  errorCode: 'VALIDATION_ERROR' | 'CONSENT_REQUIRED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';
  message: string;
  fieldErrors: Record<string, string[]>;
  requestId: string;
}
```

Field errors render beside the field and in a summary with an anchor link. `CONSENT_REQUIRED` renders the consent card and a direct link to Consent. `NOT_FOUND` renders a retry/fixture selector. `CONFLICT` explains stale simulation state and offers reload. `INTERNAL_ERROR` gives a request ID and safe retry text only. Loading and submit buttons are idempotency-safe at the UI level by disabling duplicate submits.

## 6. Screen states

Every screen has loading, error, empty, and success treatment; the global simulation banner remains visible in all states.

| Screen | Loading | Error | Empty | Success |
|---|---|---|---|---|
| Landing | Fixture catalog skeleton | Catalog unavailable + retry | `No synthetic fixtures are available.` | Entry CTA and boundary copy |
| Applicant | Applicant card skeleton | Applicant lookup error + selector | `Choose a synthetic applicant to begin.` | Baseline fields and provenance |
| Consent | Purpose-card skeleton | Receipt error with request ID | No receipt: unchecked cards and explanation | Receipt IDs, granted purposes, next action |
| Alternative fixture | Signal-card skeleton | Fixture mismatch/consent error | `No alternative fixture is selected; continue with a baseline-only result.` | Fixture version and consented signals |
| Score | Score cards and ledger skeleton | Safe API error and retry | Baseline-only result is valid empty alternative state | Baseline/dynamic cards, band, delta, fraud review |
| Evidence | Ledger skeleton | Evidence fetch error | `No scored alternative signals were used.` | Complete contribution ledger and explanations |
| Behavior | Form skeleton | Field/API errors | `No behavior updates yet.` | Before/after scores, delta, changed evidence |
| Audit | Timeline skeleton | Audit retrieval error | `No audit events have been recorded.` | Timeline, provenance, cost, limitations, fairness link |

## 7. Responsive behavior

Breakpoints are mobile `<640px`, tablet `640–1023px`, and desktop `>=1024px`.

- Desktop: 240px persistent left navigation, content max-width 1200px, score comparison as two equal cards plus delta rail, evidence table with all columns.
- Tablet: 208px collapsible navigation, content padding 24px, score cards in two columns when space allows, evidence source/receipt fields may wrap beneath each row.
- Mobile: navigation becomes a top menu/drawer with the same order and labels; content padding 16px; all cards stack; score comparison becomes baseline → contribution → dynamic vertical flow; evidence becomes stacked cards; tables become labelled definition lists; forms use full-width controls.
- At all sizes: keyboard focus is visible, actions have 44px minimum targets, banners are not color-only, and horizontal overflow is prohibited. Long receipt IDs wrap or reveal via accessible copy control.

## 8. Design tokens and components

### 8.1 Tokens

```css
--color-bg: #f7f8fa;
--color-surface: #ffffff;
--color-ink: #172033;
--color-muted: #596579;
--color-border: #d9dee8;
--color-primary: #2457d6;
--color-primary-contrast: #ffffff;
--color-success: #19734a;
--color-warning: #9a5b00;
--color-danger: #b53a3a;
--color-info: #245b78;
--font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
--text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 1rem;
--text-lg: 1.25rem; --text-xl: 1.5rem; --text-2xl: 2rem;
--space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
--space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem;
--radius-sm: 0.375rem; --radius-md: 0.625rem; --radius-lg: 0.875rem;
```

Risk bands use a text label, icon/shape, and color; color is never the only indicator. Typography uses 12/14/16/20/24/32px scale, 1.4–1.6 line height, and semibold headings.

### 8.2 Component inventory

Use source-owned shadcn/ui primitives where they improve consistency: `Button`, `Badge`, `Card`, `Checkbox`, `Dialog`, `Drawer`, `Form`, `Input`, `Label`, `Progress`, `RadioGroup`, `Select`, `Separator`, `Sheet`, `Skeleton`, `Table`, `Tabs`, `Textarea` only if needed for read-only explanations, `Alert`, and `Tooltip`. Domain components are `SimulationBanner`, `AppShell`, `NavRail`, `ConsentPurposeCard`, `ApplicantBaselineCard`, `ScoreComparison`, `EvidenceLedger`, `BehaviorUpdateForm`, `FraudReviewCard`, `ProvenancePanel`, `LimitationsPanel`, and `AuditTimeline`.

## 9. Visual wireframes

### 9.1 Primary score flow

```text
+--------------------------------------------------------------------------------+
| Underwriting Simulation Workbench      Synthetic demo   simulation ID: sim-... |
+----------------------+---------------------------------------------------------+
| Overview              | SIMULATION ONLY banner                              |
| Consent               | Applicant: Synthetic Maya           [Audit trail]   |
| Applicant             |-----------------------------------------------------|
| Score                 | Baseline         Alternative contribution          |
| Behavior              | 72                +8                                 |
| Fairness              |-----------------------------------------------------|
| Audit                 | Dynamic reliability score                          |
|                      | 80  | stable risk band  | higher = stronger...       |
|                      |-----------------------------------------------------|
|                      | Evidence ledger                                     |
|                      | feature | value | points | source | receipt | text   |
|                      |-----------------------------------------------------|
|                      | [Apply behavior update]  [View provenance]          |
+----------------------+---------------------------------------------------------+
```

### 9.2 Consent screen

```text
+----------------------+-----------------------------------------------+
| nav                  | Consent is purpose-bound                       |
|                      | [ ] Application baseline                       |
|                      |     source · category · demo-session retention |
|                      | [ ] Alternative cashflow                       |
|                      |     synthetic fixture · revocation description |
|                      | [ ] Behavior updates   [ ] Fraud screening      |
|                      |                                               |
|                      | [Grant selected consent]                       |
+----------------------+-----------------------------------------------+
```

### 9.3 Audit/limitations screen

```text
+----------------------+-----------------------------------------------+
| nav                  | Audit, provenance, and limitations             |
|                      | Receipt and score timeline                     |
|                      | 09:31 Consent receipt created                 |
|                      | 09:32 Simulation result generated             |
|                      | 09:34 Behavior update applied                  |
|                      |                                               |
|                      | [Provenance panel] [Cost estimate]             |
|                      | Limitations                                    |
|                      | Synthetic simulation; no live integrations...  |
|                      | [Open synthetic parity diagnostic]             |
+----------------------+-----------------------------------------------+
```

## 10. TypeScript API contract

The public schema version is `1.0`. JSON examples use `schemaVersion: "1.0"`; timestamps are ISO 8601 UTC strings. IDs are opaque strings and examples are synthetic.

```ts
type SchemaVersion = '1.0';
type DataSource = 'synthetic_fixture' | 'consented_manual_entry';
type ConsentPurpose = 'application_baseline' | 'alternative_cashflow' | 'behavior_updates' | 'fraud_screening';
type RiskBand = 'watch' | 'guarded' | 'stable' | 'strong';

interface ProvenanceRecord {
  source: DataSource;
  fixtureId: string;
  fixtureVersion: string;
  category: string;
  purpose: ConsentPurpose;
  consentId: string | null;
  capturedAt: string;
}

interface ApplicantProfile {
  applicantId: string;
  displayName: string;
  baseline: {
    bureauScore: number;
    monthlyIncome: number;
    monthlyDebt: number;
    employmentMonths: number;
    applicationCompleteness: number;
  };
  alternative: {
    cashflowStability: number;
    incomeConsistency: number;
    savingsBufferMonths: number;
    onTimePaymentRate: number;
  } | null;
  provenance: ProvenanceRecord[];
}

interface ConsentReceipt {
  schemaVersion: SchemaVersion;
  consentId: string;
  simulationId: string;
  applicantId: string;
  purposes: ConsentPurpose[];
  categories: string[];
  source: DataSource;
  status: 'granted' | 'revoked';
  grantedAt: string;
  revokedAt: string | null;
  retention: 'demo_session';
  receiptHash: string;
}

interface ScoreRequest {
  schemaVersion: SchemaVersion;
  simulationId: string;
  applicant: ApplicantProfile;
  consentReceipts: ConsentReceipt[];
  behaviorUpdates: BehaviorUpdate[];
  mode: 'baseline_only' | 'consented_dynamic';
}

interface EvidenceItem {
  featureKey: string;
  label: string;
  normalizedValue: number | boolean;
  signedPoints: number;
  direction: 'supports' | 'reduces' | 'neutral';
  source: DataSource;
  consentId: string | null;
  explanation: string;
  provenanceRef: string;
}

interface FraudReview {
  status: 'clear' | 'review' | 'high_review';
  flags: Array<{ ruleKey: string; severity: 'low' | 'medium' | 'high'; explanation: string }>;
  action: 'manual_review' | 'none';
  ruleVersion: string;
}

interface CostEstimate {
  modelComputeMs: number;
  dataAccess: 0;
  storageWrite: 0 | 1;
  explanation: 0;
  currency: 'USD';
  estimatedAmount: number;
  basis: 'local_measurement' | 'runtime_estimate';
}

interface ScoreResult {
  schemaVersion: SchemaVersion;
  simulationId: string;
  scoreId: string;
  applicantId: string;
  baselineScore: number;
  alternativeContribution: number;
  dynamicScore: number;
  riskBand: RiskBand;
  scoreMeaning: 'higher_is_stronger_reliability';
  evidence: EvidenceItem[];
  provenance: ProvenanceRecord[];
  fraudReview: FraudReview;
  modelVersion: string;
  featureRegistryVersion: string;
  generatedAt: string;
  auditEventId: string;
  costEstimate: CostEstimate;
}

interface BehaviorUpdate {
  updateId: string;
  simulationId: string;
  applicantId: string;
  eventType: 'income_observation' | 'payment_observation' | 'savings_observation';
  value: number;
  observedAt: string;
  source: DataSource;
  consentId: string;
}

interface AuditEvent {
  schemaVersion: SchemaVersion;
  eventId: string;
  simulationId: string;
  applicantId: string;
  eventType: 'consent' | 'score' | 'behavior_update' | 'fairness' | 'validation_failure';
  occurredAt: string;
  modelVersion: string | null;
  featureRegistryVersion: string | null;
  consentIds: string[];
  provenanceRefs: string[];
  detail: Record<string, string | number | boolean>;
}

interface ErrorEnvelope {
  schemaVersion: SchemaVersion;
  errorCode: 'VALIDATION_ERROR' | 'CONSENT_REQUIRED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';
  message: string;
  fieldErrors: Record<string, string[]>;
  requestId: string;
}
```

### 10.1 `GET /api/health`

Response `200`:

```json
{
  "schemaVersion": "1.0",
  "status": "ok",
  "service": "underwriting-simulation-api",
  "repository": "memory",
  "modelVersion": "scorecard-v1",
  "generatedAt": "2026-08-07T09:31:00.000Z"
}
```

### 10.2 `GET /api/demo/applicants`

Response `200`:

```json
{
  "schemaVersion": "1.0",
  "applicants": [
    {
      "applicantId": "app-maya-001",
      "displayName": "Synthetic Maya",
      "fixtureId": "hero-applicant-v1",
      "source": "synthetic_fixture"
    }
  ],
  "generatedAt": "2026-08-07T09:31:00.000Z"
}
```

### 10.3 `POST /api/consent`

Request:

```json
{
  "schemaVersion": "1.0",
  "simulationId": "sim-001",
  "applicantId": "app-maya-001",
  "purposes": ["application_baseline", "alternative_cashflow", "behavior_updates", "fraud_screening"],
  "categories": ["baseline_application", "derived_cashflow", "synthetic_behavior"],
  "source": "synthetic_fixture",
  "retention": "demo_session"
}
```

Response `201`:

```json
{
  "schemaVersion": "1.0",
  "receipt": {
    "schemaVersion": "1.0",
    "consentId": "con-001",
    "simulationId": "sim-001",
    "applicantId": "app-maya-001",
    "purposes": ["application_baseline", "alternative_cashflow", "behavior_updates", "fraud_screening"],
    "categories": ["baseline_application", "derived_cashflow", "synthetic_behavior"],
    "source": "synthetic_fixture",
    "status": "granted",
    "grantedAt": "2026-08-07T09:32:00.000Z",
    "revokedAt": null,
    "retention": "demo_session",
    "receiptHash": "sha256:demo-receipt-001"
  },
  "auditEventId": "aud-001",
  "generatedAt": "2026-08-07T09:32:00.000Z"
}
```

### 10.4 `POST /api/score`

Request:

```json
{
  "schemaVersion": "1.0",
  "simulationId": "sim-001",
  "applicant": {
    "applicantId": "app-maya-001",
    "displayName": "Synthetic Maya",
    "baseline": {
      "bureauScore": 680,
      "monthlyIncome": 8000,
      "monthlyDebt": 2200,
      "employmentMonths": 42,
      "applicationCompleteness": 0.96
    },
    "alternative": {
      "cashflowStability": 0.82,
      "incomeConsistency": 0.88,
      "savingsBufferMonths": 4,
      "onTimePaymentRate": 0.94
    },
    "provenance": [{
      "source": "synthetic_fixture",
      "fixtureId": "alternative-cashflow-v1",
      "fixtureVersion": "1.0",
      "category": "derived_cashflow",
      "purpose": "alternative_cashflow",
      "consentId": "con-001",
      "capturedAt": "2026-08-07T09:32:00.000Z"
    }]
  },
  "consentReceipts": [{
    "schemaVersion": "1.0",
    "consentId": "con-001",
    "simulationId": "sim-001",
    "applicantId": "app-maya-001",
    "purposes": ["application_baseline", "alternative_cashflow", "behavior_updates", "fraud_screening"],
    "categories": ["baseline_application", "derived_cashflow", "synthetic_behavior"],
    "source": "synthetic_fixture",
    "status": "granted",
    "grantedAt": "2026-08-07T09:32:00.000Z",
    "revokedAt": null,
    "retention": "demo_session",
    "receiptHash": "sha256:demo-receipt-001"
  }],
  "behaviorUpdates": [],
  "mode": "consented_dynamic"
}
```

Response `200`:

```json
{
  "schemaVersion": "1.0",
  "simulationId": "sim-001",
  "scoreId": "score-001",
  "applicantId": "app-maya-001",
  "baselineScore": 72,
  "alternativeContribution": 8,
  "dynamicScore": 80,
  "riskBand": "stable",
  "scoreMeaning": "higher_is_stronger_reliability",
  "evidence": [{
    "featureKey": "incomeConsistency",
    "label": "Income consistency",
    "normalizedValue": 0.88,
    "signedPoints": 3,
    "direction": "supports",
    "source": "synthetic_fixture",
    "consentId": "con-001",
    "explanation": "The synthetic income-consistency signal added 3 points to this simulation result.",
    "provenanceRef": "alternative-cashflow-v1:incomeConsistency"
  }],
  "provenance": [{
    "source": "synthetic_fixture",
    "fixtureId": "alternative-cashflow-v1",
    "fixtureVersion": "1.0",
    "category": "derived_cashflow",
    "purpose": "alternative_cashflow",
    "consentId": "con-001",
    "capturedAt": "2026-08-07T09:32:00.000Z"
  }],
  "fraudReview": {"status": "clear", "flags": [], "action": "none", "ruleVersion": "anomaly-v1"},
  "modelVersion": "scorecard-v1",
  "featureRegistryVersion": "registry-v1",
  "generatedAt": "2026-08-07T09:33:00.000Z",
  "auditEventId": "aud-002",
  "costEstimate": {"modelComputeMs": 3, "dataAccess": 0, "storageWrite": 0, "explanation": 0, "currency": "USD", "estimatedAmount": 0, "basis": "local_measurement"}
}
```

Without a valid matching receipt, the same route returns `alternativeContribution: 0`, `mode` is effectively baseline-only, alternative evidence is absent, and provenance explicitly says no consented alternative signal was used. The API must reject a client that tries to claim dynamic mode while omitting required consent rather than silently accepting a mismatch.

### 10.5 `POST /api/behavior`

Request:

```json
{
  "schemaVersion": "1.0",
  "simulationId": "sim-001",
  "applicantId": "app-maya-001",
  "eventType": "payment_observation",
  "value": 0.98,
  "observedAt": "2026-08-07T09:35:00.000Z",
  "source": "synthetic_fixture",
  "consentId": "con-001"
}
```

Response `200`:

```json
{
  "schemaVersion": "1.0",
  "update": {"updateId": "upd-001", "simulationId": "sim-001", "applicantId": "app-maya-001", "eventType": "payment_observation", "value": 0.98, "observedAt": "2026-08-07T09:35:00.000Z", "source": "synthetic_fixture", "consentId": "con-001"},
  "before": {"scoreId": "score-001", "dynamicScore": 80, "alternativeContribution": 8, "riskBand": "stable"},
  "after": {"scoreId": "score-002", "dynamicScore": 82, "alternativeContribution": 10, "riskBand": "stable"},
  "delta": 2,
  "changedEvidence": [{"featureKey": "onTimePaymentRate", "signedPoints": 2, "direction": "supports", "explanation": "The new synthetic payment observation changed the contribution by 2 points."}],
  "auditEventId": "aud-003",
  "generatedAt": "2026-08-07T09:35:01.000Z"
}
```

### 10.6 `GET /api/audit/:simulationId`

Response `200`:

```json
{
  "schemaVersion": "1.0",
  "simulationId": "sim-001",
  "events": [
    {"schemaVersion": "1.0", "eventId": "aud-001", "simulationId": "sim-001", "applicantId": "app-maya-001", "eventType": "consent", "occurredAt": "2026-08-07T09:32:00.000Z", "modelVersion": null, "featureRegistryVersion": null, "consentIds": ["con-001"], "provenanceRefs": [], "detail": {"status": "granted"}},
    {"schemaVersion": "1.0", "eventId": "aud-002", "simulationId": "sim-001", "applicantId": "app-maya-001", "eventType": "score", "occurredAt": "2026-08-07T09:33:00.000Z", "modelVersion": "scorecard-v1", "featureRegistryVersion": "registry-v1", "consentIds": ["con-001"], "provenanceRefs": ["alternative-cashflow-v1:incomeConsistency"], "detail": {"dynamicScore": 80, "alternativeContribution": 8}},
    {"schemaVersion": "1.0", "eventId": "aud-003", "simulationId": "sim-001", "applicantId": "app-maya-001", "eventType": "behavior_update", "occurredAt": "2026-08-07T09:35:01.000Z", "modelVersion": "scorecard-v1", "featureRegistryVersion": "registry-v1", "consentIds": ["con-001"], "provenanceRefs": ["alternative-cashflow-v1:onTimePaymentRate"], "detail": {"delta": 2}}
  ],
  "generatedAt": "2026-08-07T09:36:00.000Z"
}
```

## 11. Storage boundary

The route layer depends on this repository interface and does not know whether storage is memory or D1:

```ts
interface SimulationRepository {
  saveConsent(receipt: ConsentReceipt): Promise<void>;
  saveScore(result: ScoreResult): Promise<void>;
  saveBehaviorUpdate(update: BehaviorUpdate): Promise<void>;
  saveAuditEvent(event: AuditEvent): Promise<void>;
  getSimulation(simulationId: string): Promise<{
    simulationId: string;
    receipts: ConsentReceipt[];
    scores: ScoreResult[];
    behaviorUpdates: BehaviorUpdate[];
    auditEvents: AuditEvent[];
  } | null>;
}
```

The first implementation is `InMemorySimulationRepository`, scoped to the Worker instance and suitable for local development/tests. It is deterministic, resettable per test, and stores only typed derived records. No D1 migration is created in this design task.

The deferred D1 adapter stores only:

- consent receipts, including status, purpose/category list, timestamps, retention, and receipt hash;
- audit events for consent mutations, scores, behavior updates, fairness runs, and validation failures;
- simulation snapshots containing typed score/provenance/evidence summaries needed to reproduce the demo;
- agent trace events containing typed stage, timing, version, and outcome metadata, with redacted payloads.

D1 must not store credentials, raw bank data, raw social content, scraped content, protected/proxy traits, or unnecessary raw applicant content. `saveScore` persists evidence and provenance summaries sufficient for audit, not an unbounded request dump. If no Cloudflare credentials/binding exists, the Worker uses memory and reports `repository: "memory"`; this is a supported local mode, not a deployment failure.

## 12. Deferred extension points

Interfaces are defined now so future adapters cannot alter the vertical-slice contract. No implementation or dependency on these interfaces is required for the first slice.

```ts
interface ExtractedSignals {
  source: 'synthetic_fixture' | 'consented_manual_entry';
  signals: Record<string, number | boolean>;
  provenance: ProvenanceRecord[];
}

interface DocumentExtractor {
  extractStatement(input: { documentRef: string; consentId: string }): Promise<ExtractedSignals>;
}

interface RetrievedChunk {
  documentId: string;
  text: string;
  sourceUrl: string;
  version: string;
  citation: string;
}

interface Retriever {
  search(query: string, filters?: { topic?: string; version?: string }): Promise<RetrievedChunk[]>;
}

interface SimulationResult extends ScoreResult {
  explanation?: { text: string; citations: RetrievedChunk[] };
}

interface UnderwritingSessionAgent {
  runSimulation(input: ScoreRequest): Promise<SimulationResult>;
}
```

Future implementation choices are Cloudflare Agents SDK for typed orchestration, Durable Objects for durable session coordination, Workers AI and Vectorize for `CloudflareRagProvider`, and OCR behind `DocumentExtractor`. `LocalRagProvider` remains the guaranteed fallback and the corpus contains only versioned policies, feature registry, scorecard definitions, fairness methodology, limitations, and official-source summaries with URLs. No applicant data enters the corpus. None of these extensions blocks the first UI/API slice.

The explanation boundary is evidence-constrained: input is `ScoreResult.evidence`, score metadata, provenance, and optionally retrieved approved passages; output is a display string with citations. The renderer may not invent a factor, value, or reason and cannot write back to the score.

## 13. Deployment contract

- Frontend: React/Vite static build deployed to Cloudflare Pages.
- API: Hono module Worker deployed separately to Cloudflare Workers.
- Configuration: frontend receives the Worker API base URL from `VITE_API_BASE_URL`; no API URL is hard-coded in source-owned UI components.
- Local development: Pages/Vite uses synthetic fixtures; Worker uses the in-memory repository; no Cloudflare credentials, external provider keys, OCR, RAG, or LLM key is needed.
- Deployment: Cloudflare credentials are optional for local development and required for Pages/Worker deployment. D1 is conditional on a verified binding/account and is not a prerequisite for the first local demo.
- CORS: Worker permits the configured local origin and deployed Pages origin only; failures use `ErrorEnvelope`.
- Release identity: health response reports service, repository mode, model version, schema version, and generation time without secret values.
- Cost: `CostEstimate` reports measured/estimated model compute, zero external data access, storage write basis, and zero explanation cost for the deterministic first slice; it does not claim a provider invoice.

## 14. Acceptance criteria

The first deployed slice is accepted only when all criteria below are testable and pass in a clean local run, with deployment checks repeated when credentials are available.

1. Landing renders the exact simulation-only banner, synthetic-data boundary, and `Run a consented simulation` CTA.
2. Applicant screen renders a listed synthetic applicant and exactly the five allowed baseline fields; forbidden data categories are absent.
3. Consent screen presents separate purposes, categories, source, demo-session retention, and revocation behavior; a receipt is visible after a successful API response.
4. Alternative-data screen labels the fixture synthetic, shows its version and derived signals, and states that OCR/live integrations are not present.
5. Score screen displays `baselineScore`, `alternativeContribution`, `dynamicScore`, `riskBand`, score meaning, fraud review, and generated time from one API response; the dynamic value is the deterministic baseline plus consented contribution with documented anomaly behavior.
6. Evidence screen displays every scored feature with label, normalized value, signed points, direction, source, receipt ID, provenance reference, and explanation; no explanation claim lacks a matching evidence item.
7. Behavior update accepts a valid consented fixture event, returns before/after values and delta, and visibly changes the score/evidence when the fixture is designed to change it.
8. Audit screen renders consent, score, and behavior events with receipt IDs, provenance, model version, feature-registry version, cost estimate, and limitations.
9. Fairness destination renders synthetic parity diagnostic language and limitations; cohort labels are not sent as model features.
10. Every required route returns JSON with `schemaVersion`, the documented status code, and the documented response shape; invalid requests return `ErrorEnvelope` and a request ID.
11. A score request without valid alternative consent produces a visible baseline-only result with zero alternative contribution and an explicit provenance explanation.
12. Revoking a receipt causes the next score to exclude affected alternative evidence and contribution; the audit trail records the mutation.
13. Loading, error, empty, and success states exist for all eight screens; safe retry does not duplicate consent, behavior, or audit actions.
14. Responsive checks pass at mobile, tablet, and desktop breakpoints with usable navigation, no horizontal overflow, and keyboard-visible focus.
15. A copy scan finds no forbidden lending-outcome language in rendered UI strings or source-owned UI copy. The approved language includes simulation result, reliability score, risk band, manual review signal, alternative contribution, and consented signal.
16. The first slice deploys and runs without OCR, RAG, Agents SDK, Durable Objects, Vectorize, Workers AI, LLM calls, or live data providers. Their absence is reported as an intentional scope boundary.
17. A local run succeeds with no Cloudflare credentials using fixtures and the in-memory repository; a credentialed deployment, if performed, separately verifies Pages rendering, Worker health, score, behavior, and audit endpoints.

## 15. Design decisions and exclusions

This design chooses a single hero flow with a broad enough shell to expose fairness and audit without building a multi-tenant product. The score is bounded and deterministic; explanation streaming is display-only. The v2 API/storage decision places all orchestration in one Worker and restricts D1 to consent, audit, snapshots, and redacted trace events. The v2 RAG decision keeps runtime retrieval separate from Supermemory and makes local fallback mandatory. The v2 phase graph makes this design a prerequisite to contract lock and implementation dispatch.

Explicitly excluded from this slice: real bureau/bank/payroll/telco/social providers, scraping, credentials, identity verification, protected/proxy inputs, production lending outcomes, authentication, billing, queues, notifications, model training, opaque model serving, OCR, live browsing, and any persistence migration. These are extension or product decisions, not hidden implementation assumptions.
