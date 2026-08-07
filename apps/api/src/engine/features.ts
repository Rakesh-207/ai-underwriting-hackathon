export const FEATURE_REGISTRY_VERSION = 'feature-registry-v1';

export const baselineFeatures = [
  { key: 'bureauScore', label: 'Bureau score', weight: 0.42 },
  { key: 'incomeToDebt', label: 'Income-to-debt ratio', weight: 0.2 },
  { key: 'employmentMonths', label: 'Employment history', weight: 0.18 },
  { key: 'applicationCompleteness', label: 'Application completeness', weight: 0.2 },
] as const;

export const alternativeFeatures = [
  { key: 'cashflowStability', label: 'Cashflow stability', weight: 0.3 },
  { key: 'incomeConsistency', label: 'Income consistency', weight: 0.25 },
  { key: 'savingsBufferMonths', label: 'Savings buffer', weight: 0.2 },
  { key: 'onTimePaymentRate', label: 'On-time payment rate', weight: 0.25 },
] as const;
