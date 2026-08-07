// AI Underwriting Hackathon — Shared Type Contracts
//
// Schema versioning: the auth-and-routing contract governs authenticated API
// surfaces at schemaVersion "1.1" (all responses — success and error alike).
// The companion vertical-slice design governs its own pre-auth surfaces at
// "1.0". Both versions are exported here; the API layer selects the version
// it emits based on the route. See docs/superpowers/specs/2026-08-07-auth-and-routing-contract.md
// section 3.2 ("the response schema version '1.1' applies to all responses
// under this contract").

export const API_SCHEMA_VERSION = '1.1' as const;
export const API_SCHEMA_VERSION_PRE_AUTH = '1.0' as const;

export type SchemaVersion = typeof API_SCHEMA_VERSION;
export type SchemaVersionPreAuth = typeof API_SCHEMA_VERSION_PRE_AUTH;
export type AnySchemaVersion = SchemaVersion | SchemaVersionPreAuth;

export type DataSource = 'synthetic_fixture' | 'consented_manual_entry';

export type ConsentPurpose =
  | 'application_baseline'
  | 'alternative_cashflow'
  | 'behavior_updates'
  | 'fraud_screening';

export type RiskBand = 'watch' | 'guarded' | 'stable' | 'strong';

export type ConsentIdentityProvider = 'clerk';

export interface ProvenanceRecord {
  source: DataSource;
  fixtureId: string;
  fixtureVersion: string;
  category: string;
  purpose: ConsentPurpose;
  consentId: string | null;
  capturedAt: string;
}

export interface ApplicantBaseline {
  bureauScore: number;
  monthlyIncome: number;
  monthlyDebt: number;
  employmentMonths: number;
  applicationCompleteness: number;
}

export interface ApplicantAlternative {
  cashflowStability: number;
  incomeConsistency: number;
  savingsBufferMonths: number;
  onTimePaymentRate: number;
}

export interface ApplicantProfile {
  applicantId: string;
  displayName: string;
  baseline: ApplicantBaseline;
  alternative: ApplicantAlternative | null;
  provenance: ProvenanceRecord[];
}

export interface ConsentReceipt {
  schemaVersion: AnySchemaVersion;
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
  identityProvider: ConsentIdentityProvider;
  clerkUserId: string;
}

export type BehaviorEventType =
  | 'income_observation'
  | 'payment_observation'
  | 'savings_observation';

export interface BehaviorUpdate {
  updateId: string;
  simulationId: string;
  applicantId: string;
  eventType: BehaviorEventType;
  value: number;
  observedAt: string;
  source: DataSource;
  consentId: string;
}

export interface ScoreRequest {
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  applicant: ApplicantProfile;
  consentReceipts: ConsentReceipt[];
  behaviorUpdates: BehaviorUpdate[];
  mode: 'baseline_only' | 'consented_dynamic';
}

export interface EvidenceItem {
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

export interface FraudReviewFlag {
  ruleKey: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface FraudReview {
  status: 'clear' | 'review' | 'high_review';
  flags: FraudReviewFlag[];
  action: 'manual_review' | 'none';
  ruleVersion: string;
}

export interface CostBreakdown {
  modelComputeMs: number;
  dataAccess: 0;
  storageWrite: 0 | 1;
  explanation: 0;
  currency: 'USD';
  estimatedAmount: number;
  basis: 'local_measurement' | 'runtime_estimate';
}

export type CostEstimate = CostBreakdown;

export interface ScoreResult {
  schemaVersion: AnySchemaVersion;
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
  costEstimate: CostBreakdown;
}

export interface FairnessCohortRow {
  cohort: string;
  sampleCount: number;
  strongOrStableRate: number;
  outcomeRate: number | null;
  selectionRateRatio: number | null;
  adverseImpactRatio: number | null;
  sampleSizeWarning: string | null;
}

export interface FairnessReport {
  schemaVersion: AnySchemaVersion;
  reportId: string;
  simulationId: string;
  datasetVersion: string;
  modelVersion: string;
  referenceCohort: string;
  cohorts: FairnessCohortRow[];
  limitations: string[];
  generatedAt: string;
  auditEventId: string;
}

export interface AuditEvent {
  schemaVersion: AnySchemaVersion;
  eventId: string;
  simulationId: string;
  applicantId: string;
  clerkUserId: string;
  eventType: 'consent' | 'score' | 'behavior_update' | 'fairness' | 'validation_failure';
  occurredAt: string;
  modelVersion: string | null;
  featureRegistryVersion: string | null;
  consentIds: string[];
  provenanceRefs: string[];
  detail: Record<string, string | number | boolean>;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONSENT_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  schemaVersion: '1.1';
  errorCode: ErrorCode;
  message: string;
  fieldErrors: Record<string, string[]>;
  requestId: string;
}

// Authenticated principal, derived by middleware only — never from the body.
export interface AuthenticatedPrincipal {
  clerkUserId: string;
}

export interface AuthenticatedRequest {
  principal: AuthenticatedPrincipal;
}

// API response envelopes
export interface HealthResponse {
  schemaVersion: AnySchemaVersion;
  status: 'ok';
  service: 'underwriting-simulation-api';
  repository: 'memory' | 'd1';
  modelVersion: string;
  generatedAt: string;
}

export interface ConsentResponse {
  schemaVersion: AnySchemaVersion;
  receipt: ConsentReceipt;
  auditEventId: string;
  generatedAt: string;
}

export interface ConsentRevokeResponse {
  schemaVersion: AnySchemaVersion;
  receipt: ConsentReceipt;
  auditEventId: string;
  generatedAt: string;
}

export interface ApplicantsResponse {
  schemaVersion: AnySchemaVersion;
  applicants: Array<{
    applicantId: string;
    displayName: string;
    fixtureId: string;
    source: DataSource;
    baseline: ApplicantBaseline;
    alternative: ApplicantAlternative | null;
    provenance: ProvenanceRecord[];
  }>;
  generatedAt: string;
}

// Streaming event names (display-only, explanation panel).
export type ExplanationStreamEvent =
  | 'explanation.started'
  | 'explanation.token'
  | 'explanation.completed'
  | 'explanation.error'
  | 'stream.closed';

export interface ExplanationStartedEvent {
  type: 'explanation.started';
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  requestId: string;
}

export interface ExplanationTokenEvent {
  type: 'explanation.token';
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  requestId: string;
  textChunk: string;
}

export interface ExplanationCompletedEvent {
  type: 'explanation.completed';
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  requestId: string;
}

export interface ExplanationErrorEvent {
  type: 'explanation.error';
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  requestId: string;
  errorCode: ErrorCode;
  message: string;
}

export interface StreamClosedEvent {
  type: 'stream.closed';
  schemaVersion: AnySchemaVersion;
  simulationId: string;
  requestId: string;
}
