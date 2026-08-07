import type { ApplicantProfile, FraudReview } from '@underwriting/shared';

export function fraudReview(applicant: ApplicantProfile): FraudReview {
  const flags: FraudReview['flags'] = [];
  if (applicant.baseline.bureauScore < 300) flags.push({ ruleKey: 'bureau-score-range', severity: 'high', explanation: 'The synthetic bureau score is below the supported range.' });
  if (applicant.baseline.monthlyDebt > applicant.baseline.monthlyIncome * 2) flags.push({ ruleKey: 'income-debt-extreme', severity: 'medium', explanation: 'Synthetic debt is unusually high relative to monthly income.' });
  if (applicant.baseline.applicationCompleteness < 0.5) flags.push({ ruleKey: 'application-incomplete', severity: 'low', explanation: 'The synthetic application is missing a material portion of baseline fields.' });
  const status = flags.some((flag) => flag.severity === 'high') ? 'high_review' : flags.length > 0 ? 'review' : 'clear';
  return { status, flags, action: flags.length > 0 ? 'manual_review' : 'none', ruleVersion: 'fraud-rules-v1' };
}
