import type { EvidenceItem, ScoreRequest, ScoreResult } from '@underwriting/shared';
import { API_SCHEMA_VERSION } from '@underwriting/shared';
import { alternativeFeatures, baselineFeatures, FEATURE_REGISTRY_VERSION } from './features.ts';
import { fraudReview } from './fraud-rules.ts';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));
const band = (score: number): ScoreResult['riskBand'] => score < 550 ? 'watch' : score < 650 ? 'guarded' : score < 750 ? 'stable' : 'strong';
const stableId = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `score-${(hash >>> 0).toString(16)}`;
};

export function computeScore(request: ScoreRequest, generatedAt = '2026-01-01T00:00:00.000Z'): ScoreResult {
  const { baseline } = request.applicant;
  const debtRatio = baseline.monthlyIncome > 0 ? Math.max(0, Math.min(1, 1 - baseline.monthlyDebt / baseline.monthlyIncome)) : 0;
  const baselineInputs = [baseline.bureauScore / 900, debtRatio, Math.min(1, baseline.employmentMonths / 60), baseline.applicationCompleteness];
  const baselineScore = clamp(300 + 600 * baselineInputs.reduce((sum, value, index) => sum + value * baselineFeatures[index].weight, 0), 300, 900);
  const alternativeConsent = request.mode === 'consented_dynamic' && request.consentReceipts.some((receipt) => receipt.status === 'granted' && receipt.purposes.includes('alternative_cashflow'));
  const alternative = request.applicant.alternative;
  const altInputs = alternative ? [alternative.cashflowStability, alternative.incomeConsistency, Math.min(1, alternative.savingsBufferMonths / 6), alternative.onTimePaymentRate] : [0, 0, 0, 0];
  const alternativeContribution = alternativeConsent && alternative ? clamp(150 * altInputs.reduce((sum, value, index) => sum + value * alternativeFeatures[index].weight, 0), 0, 150) : 0;
  const behaviorContribution = request.mode === 'consented_dynamic'
    ? clamp(request.behaviorUpdates.reduce((sum, update) => sum + Math.max(0, Math.min(1, update.value)) * 30, 0), 0, 90)
    : 0;
  const dynamicScore = clamp(baselineScore + alternativeContribution + behaviorContribution, 300, 900);
  const evidence: EvidenceItem[] = baselineFeatures.map((feature, index) => ({
    featureKey: feature.key,
    label: feature.label,
    normalizedValue: baselineInputs[index],
    signedPoints: Math.round(600 * baselineInputs[index] * feature.weight),
    direction: baselineInputs[index] >= 0.5 ? 'supports' : 'reduces',
    source: 'synthetic_fixture',
    consentId: null,
    explanation: `${feature.label} contributed from structured synthetic baseline evidence.`,
    provenanceRef: `baseline:${feature.key}`,
  }));
  if (alternativeConsent && alternative) alternativeFeatures.forEach((feature, index) => evidence.push({
    featureKey: feature.key,
    label: feature.label,
    normalizedValue: altInputs[index],
    signedPoints: Math.round(150 * altInputs[index] * feature.weight),
    direction: altInputs[index] >= 0.5 ? 'supports' : 'reduces',
    source: 'synthetic_fixture',
    consentId: request.consentReceipts.find((receipt) => receipt.status === 'granted' && receipt.purposes.includes('alternative_cashflow'))?.consentId ?? null,
    explanation: `${feature.label} contributed from structured consented synthetic evidence.`,
    provenanceRef: `alternative:${feature.key}`,
  }));
  if (behaviorContribution > 0) request.behaviorUpdates.forEach((update) => evidence.push({
    featureKey: `behavior:${update.eventType}`,
    label: `${update.eventType} observation`,
    normalizedValue: Math.max(0, Math.min(1, update.value)),
    signedPoints: Math.round(Math.max(0, Math.min(1, update.value)) * 30),
    direction: update.value >= 0.5 ? 'supports' : 'reduces',
    source: update.source,
    consentId: update.consentId,
    explanation: 'The consented synthetic behavior observation was evaluated by the deterministic scorecard.',
    provenanceRef: `behavior:${update.updateId}`,
  }));
  const scoreId = stableId(JSON.stringify({ request, baselineScore, alternativeContribution, behaviorContribution }));
  return {
    schemaVersion: API_SCHEMA_VERSION,
    simulationId: request.simulationId,
    scoreId,
    applicantId: request.applicant.applicantId,
    baselineScore,
    alternativeContribution,
    dynamicScore,
    riskBand: band(dynamicScore),
    scoreMeaning: 'higher_is_stronger_reliability',
    evidence,
    provenance: request.applicant.provenance,
    fraudReview: fraudReview(request.applicant),
    modelVersion: 'scorecard-v1',
    featureRegistryVersion: FEATURE_REGISTRY_VERSION,
    generatedAt,
    auditEventId: `audit-${scoreId}`,
    costEstimate: { modelComputeMs: 0, dataAccess: 0, storageWrite: 1, explanation: 0, currency: 'USD', estimatedAmount: 0, basis: 'local_measurement' },
  };
}
