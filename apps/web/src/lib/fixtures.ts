import type { ApplicantProfile, AuditEvent, ConsentReceipt, FairnessReport, ScoreResult, BehaviorUpdate } from '@underwriting/shared';

export const simulationId = 'sim-synthetic-001';
export const applicant: ApplicantProfile = {
  applicantId: 'applicant-synthetic-001', displayName: 'Synthetic Applicant A',
  baseline: { bureauScore: 742, monthlyIncome: 92000, monthlyDebt: 28000, employmentMonths: 46, applicationCompleteness: 0.96 },
  alternative: { cashflowStability: 0.84, incomeConsistency: 0.9, savingsBufferMonths: 3.2, onTimePaymentRate: 0.94 },
  provenance: [
    { source: 'synthetic_fixture', fixtureId: 'fixture-applicant-001', fixtureVersion: 'v1', category: 'bureau_and_salary', purpose: 'application_baseline', consentId: 'consent-baseline-001', capturedAt: '2026-08-07T10:00:00.000Z' },
    { source: 'synthetic_fixture', fixtureId: 'fixture-cashflow-001', fixtureVersion: 'v1', category: 'cashflow', purpose: 'alternative_cashflow', consentId: 'consent-cashflow-001', capturedAt: '2026-08-07T10:00:00.000Z' },
  ],
};

const baseReceipt = (purpose: ConsentReceipt['purposes'][number], id: string): ConsentReceipt => ({
  schemaVersion: '1.1', consentId: id, simulationId, applicantId: applicant.applicantId,
  purposes: [purpose], categories: [purpose === 'application_baseline' ? 'bureau_and_salary' : purpose], source: 'synthetic_fixture',
  status: 'granted', grantedAt: '2026-08-07T10:00:00.000Z', revokedAt: null, retention: 'demo_session', receiptHash: `sha256:${id}`, identityProvider: 'clerk', clerkUserId: 'demo-user-1',
});

export const consentReceipts: ConsentReceipt[] = [
  baseReceipt('application_baseline', 'consent-baseline-001'), baseReceipt('alternative_cashflow', 'consent-cashflow-001'),
  baseReceipt('behavior_updates', 'consent-behavior-001'), baseReceipt('fraud_screening', 'consent-fraud-001'),
];

export const score: ScoreResult = {
  schemaVersion: '1.1', simulationId, scoreId: 'score-synthetic-001', applicantId: applicant.applicantId,
  baselineScore: 78, alternativeContribution: 8, dynamicScore: 86, riskBand: 'strong', scoreMeaning: 'higher_is_stronger_reliability',
  evidence: [
    { featureKey: 'bureau_score', label: 'Bureau score', normalizedValue: 0.86, signedPoints: 18, direction: 'supports', source: 'synthetic_fixture', consentId: 'consent-baseline-001', explanation: 'The synthetic bureau score is above the scorecard reference range.', provenanceRef: 'fixture-applicant-001' },
    { featureKey: 'income_debt_ratio', label: 'Income to debt ratio', normalizedValue: 0.7, signedPoints: 11, direction: 'supports', source: 'synthetic_fixture', consentId: 'consent-baseline-001', explanation: 'Monthly salary comfortably exceeds synthetic monthly debt.', provenanceRef: 'fixture-applicant-001' },
    { featureKey: 'cashflow_stability', label: 'Cashflow stability', normalizedValue: 0.84, signedPoints: 5, direction: 'supports', source: 'synthetic_fixture', consentId: 'consent-cashflow-001', explanation: 'Consented synthetic cashflow observations are consistent.', provenanceRef: 'fixture-cashflow-001' },
    { featureKey: 'recent_variance', label: 'Recent variance', normalizedValue: 0.2, signedPoints: -2, direction: 'reduces', source: 'synthetic_fixture', consentId: 'consent-cashflow-001', explanation: 'A small recent variance reduces the dynamic contribution.', provenanceRef: 'fixture-cashflow-001' },
  ], provenance: applicant.provenance, fraudReview: { status: 'review', flags: [{ ruleKey: 'velocity_change', severity: 'low', explanation: 'A synthetic observation changed faster than the demo threshold.' }], action: 'manual_review', ruleVersion: 'fraud-rules-v1' }, modelVersion: 'scorecard-v1', featureRegistryVersion: 'feature-registry-v1', generatedAt: '2026-08-07T10:01:00.000Z', auditEventId: 'audit-score-001', costEstimate: { modelComputeMs: 3, dataAccess: 0, storageWrite: 1, explanation: 0, currency: 'USD', estimatedAmount: 0.0001, basis: 'local_measurement' },
};

export const behaviorUpdate: BehaviorUpdate = { updateId: 'behavior-001', simulationId, applicantId: applicant.applicantId, eventType: 'income_observation', value: 96000, observedAt: '2026-08-07T10:02:00.000Z', source: 'synthetic_fixture', consentId: 'consent-behavior-001' };
export const fairness: FairnessReport = { schemaVersion: '1.1', reportId: 'fairness-001', simulationId, datasetVersion: 'synthetic-cohorts-v1', modelVersion: 'scorecard-v1', referenceCohort: 'reference', generatedAt: '2026-08-07T10:03:00.000Z', auditEventId: 'audit-fairness-001', cohorts: [
  { cohort: 'reference', sampleCount: 80, strongOrStableRate: 0.74, outcomeRate: null, selectionRateRatio: 1, adverseImpactRatio: 1, sampleSizeWarning: null },
  { cohort: 'synthetic-cohort-b', sampleCount: 12, strongOrStableRate: 0.67, outcomeRate: null, selectionRateRatio: 0.91, adverseImpactRatio: 0.91, sampleSizeWarning: 'Small synthetic sample; treat as directional only.' },
] , limitations: ['Cohorts are synthetic evaluation labels, never model inputs.', 'No real-world outcome labels are available in this simulation.', 'Small samples can make ratios unstable.'] };
export const auditEvents: AuditEvent[] = [
  { schemaVersion: '1.1', eventId: 'audit-consent-001', simulationId, applicantId: applicant.applicantId, clerkUserId: 'demo-user-1', eventType: 'consent', occurredAt: '2026-08-07T10:00:00.000Z', modelVersion: null, featureRegistryVersion: null, consentIds: ['consent-baseline-001', 'consent-cashflow-001'], provenanceRefs: ['fixture-applicant-001', 'fixture-cashflow-001'], detail: { action: 'granted', purposeCount: 2 } },
  { schemaVersion: '1.1', eventId: 'audit-score-001', simulationId, applicantId: applicant.applicantId, clerkUserId: 'demo-user-1', eventType: 'score', occurredAt: '2026-08-07T10:01:00.000Z', modelVersion: 'scorecard-v1', featureRegistryVersion: 'feature-registry-v1', consentIds: ['consent-baseline-001', 'consent-cashflow-001'], provenanceRefs: ['fixture-applicant-001', 'fixture-cashflow-001'], detail: { dynamicScore: 86, riskBand: 'strong' } },
];
