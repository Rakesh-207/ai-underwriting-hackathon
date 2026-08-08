import {
  scoreApplication,
  type UnderwritingEngineInput,
  type UnderwritingScoreResult,
} from '@underwriting/engine';

export const DEFAULT_THRESHOLDS = {
  minimumGroupSize: 10,
  maximumAbsoluteMeanScoreGap: 50,
  minimumAdverseImpactRatio: 0.8,
  diagnosticThreshold: 650,
} as const;

const REPORT_LABELS = ['synthetic', 'evaluation-only', 'not a lending decision'] as const;
const GROUPS = ['group_alpha', 'group_beta', 'group_gamma'] as const;
const GENERATED_AT = '2026-08-08T00:00:00.000Z';

export type SyntheticAuditGroup = (typeof GROUPS)[number];
export type EvaluationStatus = 'pass' | 'warn';

export interface SyntheticAuditApplicant {
  auditGroup: SyntheticAuditGroup;
  auditOnlyMetadata?: Record<string, string>;
  scoringInput: UnderwritingEngineInput;
}

export interface EvaluatedSyntheticApplicant {
  auditGroup: SyntheticAuditGroup;
  scoringInput: UnderwritingEngineInput;
  result: UnderwritingScoreResult;
  baselineResult: UnderwritingScoreResult;
  hasOptionalSignals: boolean;
}

export interface FairnessThresholds {
  minimumGroupSize: number;
  maximumAbsoluteMeanScoreGap: number;
  minimumAdverseImpactRatio: number;
  diagnosticThreshold?: number;
}

export interface RiskBandDistribution {
  strong: number;
  moderate: number;
  watch: number;
  high_attention: number;
}

export interface GroupMetric {
  auditGroup: SyntheticAuditGroup;
  labels: readonly ['synthetic', 'evaluation-only', 'not a lending decision'];
  sampleSize: number;
  sampleSizeWarning: string;
  scoreMean: number;
  scoreMedian: number;
  baselineScoreMean: number;
  baselineScoreMedian: number;
  scoreGapFromReference: number;
  absoluteMeanScoreGap: number;
  riskBandDistribution: RiskBandDistribution;
  diagnosticThreshold: number;
  diagnosticThresholdRate: number;
  adverseImpactRatio: number | null;
  optionalSignalMeanChange: number;
  optionalSourceRefusalCount: number;
}

export interface FairnessCheck {
  name: 'minimum group size' | 'absolute mean score gap' | 'adverse-impact ratio' | 'optional refusal baseline parity';
  status: EvaluationStatus;
  threshold: number | string;
  observed: number | string;
  explanation: string;
}

export interface FairnessReport {
  labels: typeof REPORT_LABELS;
  status: EvaluationStatus;
  thresholds: Required<FairnessThresholds>;
  formulas: {
    scoreMean: string;
    scoreMedian: string;
    scoreGap: string;
    diagnosticThresholdRate: string;
    adverseImpactRatio: string;
  };
  referenceGroup: SyntheticAuditGroup;
  groupMetrics: GroupMetric[];
  optionalSignalComparison: OptionalSignalComparison[];
  checks: FairnessCheck[];
  limitations: string[];
  generatedAt: string;
}

export interface OptionalSignalComparison {
  auditGroup: SyntheticAuditGroup;
  labels: typeof REPORT_LABELS;
  withoutOptionalMean: number;
  withOptionalMean: number;
  meanScoreChange: number;
  refusalCount: number;
  refusalBaselineParity: boolean;
}

export function evaluateSyntheticApplicant(applicant: SyntheticAuditApplicant): EvaluatedSyntheticApplicant {
  const scoringInput = stripAuditMetadata(applicant.scoringInput);
  const result = scoreApplication(scoringInput);
  const baselineResult = scoreApplication(withoutOptionalSignals(scoringInput));
  return { auditGroup: applicant.auditGroup, scoringInput, result, baselineResult, hasOptionalSignals: hasOptionalSignals(scoringInput) };
}

export function evaluateFairness(
  applicants: SyntheticAuditApplicant[],
  configuredThresholds: FairnessThresholds = DEFAULT_THRESHOLDS,
): FairnessReport {
  const thresholds: Required<FairnessThresholds> = {
    ...DEFAULT_THRESHOLDS,
    ...configuredThresholds,
  };
  const evaluated = applicants.map(evaluateSyntheticApplicant);
  const referenceGroup = referenceGroupFor(evaluated, thresholds.diagnosticThreshold);
  const referenceApplicants = evaluated.filter((applicant) => applicant.auditGroup === referenceGroup);
  const referenceMean = mean(referenceApplicants.map((applicant) => applicant.result.dynamicScore));
  const referenceThresholdRate = thresholdRate(referenceApplicants, thresholds.diagnosticThreshold);
  const groupMetrics = uniqueGroups(evaluated).map((auditGroup) => {
    const members = evaluated.filter((applicant) => applicant.auditGroup === auditGroup);
    const scores = members.map((applicant) => applicant.result.dynamicScore);
    const baselineScores = members.map((applicant) => applicant.baselineResult.dynamicScore);
    const meanScore = mean(scores);
    return {
      auditGroup,
      labels: REPORT_LABELS,
      sampleSize: members.length,
      sampleSizeWarning: members.length < thresholds.minimumGroupSize
        ? `Insufficient sample size: ${members.length} is below the synthetic diagnostic minimum of ${thresholds.minimumGroupSize}.`
        : 'Sample size meets the synthetic diagnostic minimum; it is not evidence of statistical power.',
      scoreMean: round(meanScore),
      scoreMedian: median(scores),
      baselineScoreMean: round(mean(baselineScores)),
      baselineScoreMedian: median(baselineScores),
      scoreGapFromReference: round(meanScore - referenceMean),
      absoluteMeanScoreGap: round(Math.abs(meanScore - referenceMean)),
      riskBandDistribution: distribution(members),
      diagnosticThreshold: thresholds.diagnosticThreshold,
      diagnosticThresholdRate: roundRate(thresholdRate(members, thresholds.diagnosticThreshold)),
      adverseImpactRatio: referenceThresholdRate === 0 ? null : roundRatio(thresholdRate(members, thresholds.diagnosticThreshold) / referenceThresholdRate),
      optionalSignalMeanChange: round(mean(members.map((applicant) => applicant.result.dynamicScore - applicant.baselineResult.dynamicScore))),
      optionalSourceRefusalCount: members.filter((applicant) => !applicant.hasOptionalSignals).length,
    };
  });
  const optionalSignalComparison = uniqueGroups(evaluated).map((auditGroup) => {
    const members = evaluated.filter((applicant) => applicant.auditGroup === auditGroup);
    const refusalMembers = members.filter((applicant) => !applicant.hasOptionalSignals);
    return {
      auditGroup,
      labels: REPORT_LABELS,
      withoutOptionalMean: round(mean(members.map((applicant) => applicant.baselineResult.dynamicScore))),
      withOptionalMean: round(mean(members.map((applicant) => applicant.result.dynamicScore))),
      meanScoreChange: round(mean(members.map((applicant) => applicant.result.dynamicScore - applicant.baselineResult.dynamicScore))),
      refusalCount: refusalMembers.length,
      refusalBaselineParity: refusalMembers.every((applicant) => applicant.result.dynamicScore === applicant.baselineResult.dynamicScore),
    };
  });
  const checks = createChecks(groupMetrics, optionalSignalComparison, thresholds);
  return {
    labels: REPORT_LABELS,
    status: checks.some((check) => check.status === 'warn') ? 'warn' : 'pass',
    thresholds,
    formulas: {
      scoreMean: 'sum of dynamic scores / group sample size',
      scoreMedian: 'middle ordered dynamic score, or midpoint of two middle scores',
      scoreGap: 'group dynamic score mean - reference-group dynamic score mean',
      diagnosticThresholdRate: 'count(dynamic score >= diagnostic threshold) / group sample size',
      adverseImpactRatio: 'group diagnostic threshold rate / reference-group diagnostic threshold rate; screening diagnostic only',
    },
    referenceGroup,
    groupMetrics,
    optionalSignalComparison,
    checks,
    limitations: [
      'Synthetic audit labels are evaluation metadata only and are never scoring features.',
      'This report is evaluation-only and is not a lending decision.',
      'The adverse-impact ratio is an illustrative four-fifths screening diagnostic, not a legal guarantee or legal conclusion.',
      'Small groups are explicitly marked insufficient sample size; these results are not evidence of statistical power.',
      'Synthetic cohorts cannot establish real-world fairness, causality, validity, or compliance.',
      'A difference with optional signals can reflect the synthetic signal distribution; refusal is compared with the same applicant baseline.',
    ],
    generatedAt: GENERATED_AT,
  };
}

export function createSyntheticAuditCohorts(): SyntheticAuditApplicant[] {
  return GROUPS.flatMap((auditGroup, groupIndex) => Array.from({ length: 12 }, (_, index) => {
    const applicantNumber = groupIndex * 12 + index;
    const bureauScore = 540 + groupIndex * 110 + (index % 4) * 12;
    const scoringInput: UnderwritingEngineInput = {
      applicantId: `synthetic-${String(applicantNumber + 1).padStart(2, '0')}`,
      application: {
        bureauScore,
        monthlyIncome: 100_000,
        monthlyObligations: 20_000,
        requestedAmount: 300_000,
        loanTenureMonths: 24,
      },
      behaviorUpdates: [],
    };
    if (index % 2 === 0) {
      scoringInput.accountAggregator = syntheticAccount(scoringInput.applicantId, index);
    }
    return {
      auditGroup,
      auditOnlyMetadata: { cohortVersion: 'synthetic-fairness-v1' },
      scoringInput,
    };
  }));
}

function stripAuditMetadata(input: UnderwritingEngineInput): UnderwritingEngineInput {
  return {
    applicantId: input.applicantId,
    application: { ...input.application },
    declaredEmployment: input.declaredEmployment ? { ...input.declaredEmployment } : undefined,
    accountAggregator: input.accountAggregator ? { ...input.accountAggregator } : undefined,
    employment: input.employment ? { ...input.employment } : undefined,
    education: input.education ? { ...input.education } : undefined,
    behaviorUpdates: input.behaviorUpdates.map((update) => ({ ...update })),
    consentReceipts: input.consentReceipts?.map((receipt) => ({ ...receipt })),
  };
}

function withoutOptionalSignals(input: UnderwritingEngineInput): UnderwritingEngineInput {
  return {
    applicantId: input.applicantId,
    application: { ...input.application },
    declaredEmployment: input.declaredEmployment ? { ...input.declaredEmployment } : undefined,
    behaviorUpdates: [],
  };
}

function syntheticAccount(applicantId: string, index: number): NonNullable<UnderwritingEngineInput['accountAggregator']> {
  return {
    data: {
      syntheticAccountId: `account-${applicantId}`,
      statementPeriod: { from: '2026-01-01', to: '2026-03-31' },
      transactions: [
        { transactionId: `${applicantId}-credit`, postedAt: '2026-02-01', type: 'credit', amount: 100_000 + index * 1_000, description: 'synthetic income', balanceAfter: 130_000 },
        { transactionId: `${applicantId}-debit`, postedAt: '2026-02-10', type: 'debit', amount: 20_000, description: 'synthetic obligation', balanceAfter: 110_000 },
      ],
      balance: { opening: 100_000, closing: 110_000, currency: 'INR' },
    },
    provenance: { source: 'account_aggregator', provider: 'synthetic-audit-provider', reference: `audit:${applicantId}`, retrievedAt: GENERATED_AT },
    consent: { source: 'account_aggregator', purpose: 'cashflow_analysis', scopes: ['account_transactions'], timestamp: GENERATED_AT, consentReference: `consent:${applicantId}` },
  };
}

function uniqueGroups(applicants: EvaluatedSyntheticApplicant[]): SyntheticAuditGroup[] {
  return [...new Set(applicants.map((applicant) => applicant.auditGroup))].sort();
}

function referenceGroupFor(applicants: EvaluatedSyntheticApplicant[], threshold: number): SyntheticAuditGroup {
  return uniqueGroups(applicants).sort((left, right) => {
    const leftRate = thresholdRate(applicants.filter((applicant) => applicant.auditGroup === left), threshold);
    const rightRate = thresholdRate(applicants.filter((applicant) => applicant.auditGroup === right), threshold);
    return rightRate - leftRate || left.localeCompare(right);
  })[0] ?? GROUPS[0];
}

function hasOptionalSignals(input: UnderwritingEngineInput): boolean {
  return Boolean(input.accountAggregator || input.employment || input.education || input.behaviorUpdates.length > 0);
}

function distribution(applicants: EvaluatedSyntheticApplicant[]): RiskBandDistribution {
  return applicants.reduce<RiskBandDistribution>((counts, applicant) => {
    counts[applicant.result.riskBand] += 1;
    return counts;
  }, { strong: 0, moderate: 0, watch: 0, high_attention: 0 });
}

function thresholdRate(applicants: EvaluatedSyntheticApplicant[], threshold: number): number {
  return applicants.length === 0 ? 0 : applicants.filter((applicant) => applicant.result.dynamicScore >= threshold).length / applicants.length;
}

function createChecks(metrics: GroupMetric[], comparisons: OptionalSignalComparison[], thresholds: Required<FairnessThresholds>): FairnessCheck[] {
  const largestGap = Math.max(...metrics.map((metric) => metric.absoluteMeanScoreGap), 0);
  const lowestRatio = Math.min(...metrics.map((metric) => metric.adverseImpactRatio ?? 0));
  return [
    {
      name: 'minimum group size',
      status: metrics.every((metric) => metric.sampleSize >= thresholds.minimumGroupSize) ? 'pass' : 'warn',
      threshold: thresholds.minimumGroupSize,
      observed: Math.min(...metrics.map((metric) => metric.sampleSize), 0),
      explanation: 'Groups below the minimum are reported with an insufficient sample size warning.',
    },
    {
      name: 'absolute mean score gap',
      status: largestGap <= thresholds.maximumAbsoluteMeanScoreGap ? 'pass' : 'warn',
      threshold: thresholds.maximumAbsoluteMeanScoreGap,
      observed: largestGap,
      explanation: 'Synthetic diagnostic comparison of group dynamic-score means against the reference group.',
    },
    {
      name: 'adverse-impact ratio',
      status: lowestRatio >= thresholds.minimumAdverseImpactRatio ? 'pass' : 'warn',
      threshold: thresholds.minimumAdverseImpactRatio,
      observed: lowestRatio,
      explanation: 'Illustrative threshold-rate ratio screening diagnostic; not a legal guarantee.',
    },
    {
      name: 'optional refusal baseline parity',
      status: comparisons.every((comparison) => comparison.refusalBaselineParity) ? 'pass' : 'warn',
      threshold: 'refusal score equals same applicant baseline score',
      observed: comparisons.every((comparison) => comparison.refusalBaselineParity) ? 'equal' : 'different',
      explanation: 'Refusing optional sources leaves the same applicant baseline unchanged.',
    },
  ];
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return round(value);
}

function roundRatio(value: number): number {
  return round(value);
}
