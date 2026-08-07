import type {
  AlternativeDataSource,
  RawAccountAggregatorData,
  RawDigiLockerEducationData,
  RawDigiLockerEmploymentData,
  RawProviderResponse,
} from '@underwriting/shared';

export const PROTECTED_INPUT_FIELDS = [
  'gender',
  'caste',
  'religion',
  'race',
  'ethnicity',
  'collegePrestige',
  'collegeRanking',
  'institutionQuality',
  'fieldPrestige',
  'prestige',
  'ranking',
] as const;

const SCORE_MIN = 300;
const SCORE_MAX = 900;
const ALT_MAX_ADJUSTMENT = 120;

const BASELINE_WEIGHTS = {
  bureau: 300,
  affordability: 180,
  requestedAmount: 120,
} as const;

const ALTERNATIVE_WEIGHTS = {
  incomeConsistency: 25,
  cashFlowStability: 25,
  balanceTrend: 15,
  employmentConsistency: 20,
  accountActivityStability: 15,
  behaviorStability: 20,
} as const;

export type RiskBand = 'strong' | 'moderate' | 'watch' | 'high_attention';
export type EvidenceSource = 'application_baseline' | AlternativeDataSource | 'synthetic_behavior';
export type EvidenceDirection = 'supports' | 'reduces' | 'neutral';

export interface ApplicationBaseline {
  bureauScore: number;
  monthlyIncome: number;
  monthlyObligations: number;
  requestedAmount: number;
  loanTenureMonths: number;
}

export interface DeclaredEmployment {
  employer: string;
}

export interface BehaviorUpdate {
  updateId: string;
  eventType: 'income_observation' | 'payment_observation' | 'savings_observation';
  value: number;
  observedAt: string;
  source: 'synthetic_behavior';
  consentReference: string;
  provenance: string;
}

export interface ConsentReceiptMetadata {
  source: AlternativeDataSource | 'synthetic_behavior';
  consentReference: string;
  purpose: string;
  timestamp: string;
  provenanceReferences: string[];
}

export interface UnderwritingEngineInput {
  applicantId: string;
  application: ApplicationBaseline;
  declaredEmployment?: DeclaredEmployment;
  accountAggregator?: RawProviderResponse<RawAccountAggregatorData>;
  employment?: RawProviderResponse<RawDigiLockerEmploymentData>;
  education?: RawProviderResponse<RawDigiLockerEducationData>;
  behaviorUpdates: BehaviorUpdate[];
  consentReceipts?: ConsentReceiptMetadata[];
}

export interface NormalizedUnderwritingFeatures {
  bureauScore: number;
  paymentBurden: number;
  requestedAmountToTermIncome: number;
  incomeConsistency: number | null;
  cashFlowStability: number | null;
  balanceTrend: number | null;
  employmentConsistency: number | null;
  accountActivityStability: number | null;
  behaviorStability: number | null;
  educationVerified: boolean | null;
  sourceReferences: string[];
  consentReferences: string[];
}

export interface ScoreEvidence {
  id: string;
  label: string;
  direction: EvidenceDirection;
  source: EvidenceSource;
  consentReference: string;
  provenance: string;
  scoreContribution: number;
  explanation: string;
}

export interface AnomalyFlag {
  id: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  source: EvidenceSource;
  consentReference: string;
  provenance: string;
  scoreDelta?: number;
}

export interface UnderwritingScoreResult {
  applicantId: string;
  scoreId: string;
  baselineScore: number;
  dynamicScore: number;
  alternativeContribution: number;
  riskBand: RiskBand;
  features: NormalizedUnderwritingFeatures;
  evidence: ScoreEvidence[];
  anomalies: AnomalyFlag[];
  generatedAt: string;
}

export class ProtectedInputError extends Error {
  constructor(field: string) {
    super(`Protected or proxy field is not accepted as a scoring input: ${field}`);
    this.name = 'ProtectedInputError';
  }
}

export function scoreApplication(input: UnderwritingEngineInput): UnderwritingScoreResult {
  assertNoProtectedInputs(input);
  const features = normalizeFeatures(input);
  const evidence: ScoreEvidence[] = [];

  const bureauContribution = round(clamp((input.application.bureauScore - 300) / 600, 0, 1) * BASELINE_WEIGHTS.bureau);
  const affordabilityContribution = round(clamp(1 - features.paymentBurden / 0.8, 0, 1) * BASELINE_WEIGHTS.affordability);
  const requestedAmountContribution = round(clamp(1 - features.requestedAmountToTermIncome, 0, 1) * BASELINE_WEIGHTS.requestedAmount);
  evidence.push(
    evidenceItem('bureau-score', 'Bureau score', bureauContribution, 'application_baseline', 'not_applicable', 'engine:application-baseline', `Bureau score contributes ${bureauContribution} points on the fixed baseline scale.`),
    evidenceItem('payment-burden', 'Affordability and payment burden', affordabilityContribution, 'application_baseline', 'not_applicable', 'engine:application-baseline', `Payment burden is ${(features.paymentBurden * 100).toFixed(1)}% of monthly income.`),
    evidenceItem('requested-amount', 'Requested amount and tenure', requestedAmountContribution, 'application_baseline', 'not_applicable', 'engine:application-baseline', 'Requested amount is compared with income over the requested tenure.'),
  );

  const baselineScore = boundScore(SCORE_MIN + sumContributions(evidence));
  const baselineBoundAdjustment = baselineScore - (SCORE_MIN + sumContributions(evidence));
  if (baselineBoundAdjustment !== 0) {
    evidence.push(evidenceItem('baseline-bound-adjustment', 'Baseline score bounds', baselineBoundAdjustment, 'application_baseline', 'not_applicable', 'engine:score-bounds', 'The baseline score was bounded to the documented score range.'));
  }

  const availableSignals = alternativeSignals(input, features);
  const signalWeight = availableSignals.reduce((total, signal) => total + signal.weight, 0);
  for (const signal of availableSignals) {
    const contribution = round(((signal.value - 0.5) * 2 * signal.weight * ALT_MAX_ADJUSTMENT) / signalWeight);
    evidence.push(evidenceItem(signal.id, signal.label, contribution, signal.source, signal.consentReference, signal.provenance, signal.explanation));
  }

  if (input.education) {
    evidence.push(evidenceItem('education-verification', 'Verified education record', 0, input.education.provenance.source, input.education.consent.consentReference, input.education.provenance.reference, features.educationVerified ? 'Education verification is retained as evidence and excluded from score calculation.' : 'Education record was received but is not verified; it is excluded from score calculation.'));
  }

  const anomalies = detectAnomalies(input, features);
  for (const anomaly of anomalies) {
    evidence.push(evidenceItem(anomaly.id, anomaly.id.replaceAll('-', ' '), anomaly.scoreDelta ?? 0, anomaly.source, anomaly.consentReference, anomaly.provenance, anomaly.explanation));
  }

  const rawDynamicScore = SCORE_MIN + sumContributions(evidence);
  const dynamicScore = boundScore(rawDynamicScore);
  const dynamicBoundAdjustment = dynamicScore - rawDynamicScore;
  if (dynamicBoundAdjustment !== 0) {
    evidence.push(evidenceItem('dynamic-bound-adjustment', 'Dynamic score bounds', dynamicBoundAdjustment, 'application_baseline', 'not_applicable', 'engine:score-bounds', 'The dynamic score was bounded to the documented score range.'));
  }

  return {
    applicantId: input.applicantId,
    scoreId: `score-${hash(JSON.stringify({ applicantId: input.applicantId, application: input.application, features, behaviorUpdates: input.behaviorUpdates, anomalies }))}`,
    baselineScore,
    dynamicScore,
    alternativeContribution: dynamicScore - baselineScore,
    riskBand: riskBandForScore(dynamicScore),
    features,
    evidence,
    anomalies,
    generatedAt: '2026-08-08T00:00:00.000Z',
  };
}

export function riskBandForScore(score: number): RiskBand {
  if (score >= 750) return 'strong';
  if (score >= 650) return 'moderate';
  if (score >= 550) return 'watch';
  return 'high_attention';
}

export function recalculateWithBehaviorUpdate(
  input: UnderwritingEngineInput,
  update: BehaviorUpdate,
): { input: UnderwritingEngineInput; result: UnderwritingScoreResult } {
  const nextInput: UnderwritingEngineInput = {
    ...input,
    behaviorUpdates: [...input.behaviorUpdates, { ...update }],
  };
  return { input: nextInput, result: scoreApplication(nextInput) };
}

function normalizeFeatures(input: UnderwritingEngineInput): NormalizedUnderwritingFeatures {
  const { application } = input;
  const credits = input.accountAggregator?.data.transactions.filter((transaction) => transaction.type === 'credit') ?? [];
  const debits = input.accountAggregator?.data.transactions.filter((transaction) => transaction.type === 'debit') ?? [];
  const monthlyIncome = Math.max(application.monthlyIncome, 1);
  const expectedCredits = Math.max(1, Math.round(daysBetween(input.accountAggregator?.data.statementPeriod) / 30));
  const incomeConsistency = input.accountAggregator
    ? clamp((credits.filter((transaction) => /salary|income|payment/i.test(transaction.description)).length / expectedCredits), 0, 1)
    : null;
  const creditAmounts = credits.map((transaction) => transaction.amount);
  const averageCredit = average(creditAmounts);
  const creditVariance = averageCredit === 0 ? 0 : average(creditAmounts.map((amount) => Math.abs(amount - averageCredit))) / averageCredit;
  const cashFlowStability = input.accountAggregator ? clamp(1 - creditVariance, 0, 1) : null;
  const balanceDelta = input.accountAggregator ? input.accountAggregator.data.balance.closing - input.accountAggregator.data.balance.opening : 0;
  const balanceTrend = input.accountAggregator ? clamp(0.5 + balanceDelta / (monthlyIncome * 6), 0, 1) : null;
  const accountActivityStability = input.accountAggregator
    ? clamp(1 - Math.abs(credits.length - debits.length) / Math.max(credits.length + debits.length, 1), 0, 1)
    : null;
  const verifiedEmployer = input.employment?.data.records[0]?.employer;
  const employmentConsistency = input.employment
    ? input.declaredEmployment && verifiedEmployer
      ? normalizeText(input.declaredEmployment.employer) === normalizeText(verifiedEmployer) ? 1 : 0
      : 0.5
    : null;
  const behaviorStability = input.behaviorUpdates.length > 0 ? average(input.behaviorUpdates.map((update) => clamp(update.value, 0, 1))) : null;

  return {
    bureauScore: application.bureauScore,
    paymentBurden: (application.monthlyObligations + application.requestedAmount / Math.max(application.loanTenureMonths, 1)) / monthlyIncome,
    requestedAmountToTermIncome: application.requestedAmount / (monthlyIncome * Math.max(application.loanTenureMonths, 1)),
    incomeConsistency,
    cashFlowStability,
    balanceTrend,
    employmentConsistency,
    accountActivityStability,
    behaviorStability,
    educationVerified: input.education ? input.education.data.records.some((record) => record.verificationStatus === 'verified') : null,
    sourceReferences: unique([
      input.accountAggregator?.provenance.reference,
      input.employment?.provenance.reference,
      input.education?.provenance.reference,
      ...input.behaviorUpdates.map((update) => update.provenance),
    ]),
    consentReferences: unique([
      input.accountAggregator?.consent.consentReference,
      input.employment?.consent.consentReference,
      input.education?.consent.consentReference,
      ...input.behaviorUpdates.map((update) => update.consentReference),
    ]),
  };
}

interface AlternativeSignal {
  id: keyof typeof ALTERNATIVE_WEIGHTS;
  label: string;
  value: number;
  weight: number;
  source: EvidenceSource;
  consentReference: string;
  provenance: string;
  explanation: string;
}

function alternativeSignals(input: UnderwritingEngineInput, features: NormalizedUnderwritingFeatures): AlternativeSignal[] {
  const signals: AlternativeSignal[] = [];
  const account = input.accountAggregator;
  if (account && features.incomeConsistency !== null && features.cashFlowStability !== null && features.balanceTrend !== null && features.accountActivityStability !== null) {
    signals.push(
      signal('incomeConsistency', 'Income consistency', features.incomeConsistency, ALTERNATIVE_WEIGHTS.incomeConsistency, account.provenance.source, account, 'Synthetic account credits are compared with the statement period.'),
      signal('cashFlowStability', 'Cash-flow stability', features.cashFlowStability, ALTERNATIVE_WEIGHTS.cashFlowStability, account.provenance.source, account, 'Credit amount variation is normalized without calculating a lending KPI.'),
      signal('balanceTrend', 'Balance trend', features.balanceTrend, ALTERNATIVE_WEIGHTS.balanceTrend, account.provenance.source, account, 'Opening and closing balances provide a bounded trend signal.'),
      signal('accountActivityStability', 'Account activity stability', features.accountActivityStability, ALTERNATIVE_WEIGHTS.accountActivityStability, account.provenance.source, account, 'Credit and debit activity balance is used as a bounded stability signal.'),
    );
  }
  if (input.employment && features.employmentConsistency !== null) {
    signals.push(signal('employmentConsistency', 'Verified employment consistency', features.employmentConsistency, ALTERNATIVE_WEIGHTS.employmentConsistency, input.employment.provenance.source, input.employment, features.employmentConsistency === 1 ? 'Declared and verified employers match.' : 'Declared and verified employers do not match.'));
  }
  if (input.behaviorUpdates.length > 0 && features.behaviorStability !== null) {
    const update = input.behaviorUpdates[input.behaviorUpdates.length - 1];
    signals.push({ id: 'behaviorStability', label: 'Synthetic behavior stability', value: features.behaviorStability, weight: ALTERNATIVE_WEIGHTS.behaviorStability, source: 'synthetic_behavior', consentReference: update.consentReference, provenance: update.provenance, explanation: 'Behavior observations are recalculated through the same bounded scorecard.' });
  }
  return signals;
}

function signal(
  id: keyof typeof ALTERNATIVE_WEIGHTS,
  label: string,
  value: number,
  weight: number,
  source: AlternativeDataSource,
  response: RawProviderResponse<RawAccountAggregatorData> | RawProviderResponse<RawDigiLockerEmploymentData>,
  explanation: string,
): AlternativeSignal {
  return { id, label, value, weight, source, consentReference: response.consent.consentReference, provenance: response.provenance.reference, explanation };
}

function detectAnomalies(input: UnderwritingEngineInput, features: NormalizedUnderwritingFeatures): AnomalyFlag[] {
  const account = input.accountAggregator;
  if (!account) return employmentAnomaly(input, features);
  const transactions = account.data.transactions;
  const flags: AnomalyFlag[] = [];
  const context = { source: account.provenance.source as EvidenceSource, consentReference: account.consent.consentReference, provenance: account.provenance.reference };
  const fingerprints = new Set<string>();
  if (transactions.some((transaction) => {
    const fingerprint = [transaction.postedAt, transaction.type, transaction.amount, transaction.description].join('|');
    if (fingerprints.has(fingerprint)) return true;
    fingerprints.add(fingerprint);
    return false;
  })) {
    flags.push({ id: 'duplicate-transaction', severity: 'medium', explanation: 'Two synthetic transactions share the same date, type, amount, and description.', ...context, scoreDelta: -10 });
  }
  if (transactions.some((transaction) => transaction.type === 'credit' && transaction.amount > input.application.monthlyIncome * 2)) {
    flags.push({ id: 'unusual-transaction-spike', severity: 'medium', explanation: 'A synthetic credit exceeds twice the declared monthly income.', ...context, scoreDelta: -15 });
  }
  if (Math.abs(account.data.balance.closing - account.data.balance.opening) > input.application.monthlyIncome * 3) {
    flags.push({ id: 'unexplained-balance-jump', severity: 'medium', explanation: 'The statement balance change is more than three times declared monthly income.', ...context, scoreDelta: -10 });
  }
  const credits = transactions.filter((transaction) => transaction.type === 'credit').map((transaction) => transaction.amount);
  if (credits.length > 1 && Math.max(...credits) > Math.min(...credits) * 3) {
    flags.push({ id: 'inconsistent-income-pattern', severity: 'low', explanation: 'Synthetic credit amounts vary by more than three times across the statement period.', ...context, scoreDelta: -10 });
  }
  if (transactions.some((transaction) => transaction.postedAt < account.data.statementPeriod.from || transaction.postedAt > account.data.statementPeriod.to)) {
    flags.push({ id: 'contradictory-transaction-date', severity: 'high', explanation: 'A synthetic transaction falls outside the statement period.', ...context, scoreDelta: -20 });
  }
  return [...flags, ...employmentAnomaly(input, features), ...employmentDateAnomalies(input)];
}

function employmentAnomaly(input: UnderwritingEngineInput, features: NormalizedUnderwritingFeatures): AnomalyFlag[] {
  if (!input.employment || features.employmentConsistency !== 0) return [];
  return [{
    id: 'employment-declaration-mismatch', severity: 'medium', explanation: 'Declared employment does not match the verified employment record.',
    source: input.employment.provenance.source, consentReference: input.employment.consent.consentReference, provenance: input.employment.provenance.reference, scoreDelta: -20,
  }];
}

function employmentDateAnomalies(input: UnderwritingEngineInput): AnomalyFlag[] {
  const record = input.employment?.data.records[0];
  if (!input.employment || !record || Date.parse(record.startDate) <= Date.parse(record.issuedDate) && (record.endDate === null || Date.parse(record.endDate) >= Date.parse(record.startDate))) return [];
  return [{
    id: 'contradictory-employment-date', severity: 'high', explanation: 'Verified employment dates contradict the document issue date or employment sequence.',
    source: input.employment.provenance.source, consentReference: input.employment.consent.consentReference, provenance: input.employment.provenance.reference, scoreDelta: -20,
  }];
}

function evidenceItem(id: string, label: string, scoreContribution: number, source: EvidenceSource, consentReference: string, provenance: string, explanation: string): ScoreEvidence {
  return { id, label, direction: scoreContribution > 0 ? 'supports' : scoreContribution < 0 ? 'reduces' : 'neutral', source, consentReference, provenance, scoreContribution, explanation };
}

function assertNoProtectedInputs(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if ((PROTECTED_INPUT_FIELDS as readonly string[]).includes(key)) throw new ProtectedInputError(path ? `${path}.${key}` : key);
    assertNoProtectedInputs(child, path ? `${path}.${key}` : key);
  }
}

function boundScore(score: number): number {
  return Math.round(clamp(score, SCORE_MIN, SCORE_MAX));
}

function sumContributions(items: ScoreEvidence[]): number {
  return items.reduce((total, item) => total + item.scoreContribution, 0);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function daysBetween(period: { from: string; to: string } | undefined): number {
  if (!period) return 30;
  return Math.max(30, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}
