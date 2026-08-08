import { describe, expect, it } from 'vitest';
import { ProtectedInputError, scoreApplication, type UnderwritingEngineInput } from '@underwriting/engine';
import {
  DEFAULT_THRESHOLDS,
  createSyntheticAuditCohorts,
  evaluateFairness,
  evaluateSyntheticApplicant,
  type SyntheticAuditApplicant,
} from '../src/index';

function inputFor(applicantId: string, bureauScore = 700): UnderwritingEngineInput {
  return {
    applicantId,
    application: {
      bureauScore,
      monthlyIncome: 100_000,
      monthlyObligations: 20_000,
      requestedAmount: 300_000,
      loanTenureMonths: 24,
    },
    behaviorUpdates: [],
  };
}

describe('fairness evaluation', () => {
  it('strips audit metadata before scoring', () => {
    const applicant: SyntheticAuditApplicant = {
      auditGroup: 'group_alpha',
      auditOnlyMetadata: { syntheticLabel: 'evaluation-only' },
      scoringInput: inputFor('same-input'),
    };

    const result = evaluateSyntheticApplicant(applicant);

    expect(result.scoringInput).not.toHaveProperty('auditGroup');
    expect(result.scoringInput).not.toHaveProperty('auditOnlyMetadata');
    expect(result.result.applicantId).toBe('same-input');
  });

  it('gives identical non-audit inputs identical scores across audit groups', () => {
    const first = evaluateSyntheticApplicant({ auditGroup: 'group_alpha', scoringInput: inputFor('same-input') });
    const second = evaluateSyntheticApplicant({ auditGroup: 'group_beta', scoringInput: inputFor('same-input') });

    expect(first.result.dynamicScore).toBe(second.result.dynamicScore);
    expect(first.result.riskBand).toBe(second.result.riskBand);
  });

  it('does not penalize optional-source refusal relative to baseline', () => {
    const withoutConsent = evaluateSyntheticApplicant({ auditGroup: 'group_alpha', scoringInput: inputFor('refused-source') });
    const withConsent = evaluateSyntheticApplicant({
      auditGroup: 'group_beta',
      scoringInput: {
        ...inputFor('refused-source'),
        accountAggregator: undefined,
      },
    });

    expect(withoutConsent.result.baselineScore).toBe(withConsent.result.baselineScore);
    expect(withoutConsent.result.dynamicScore).toBe(withoutConsent.result.baselineScore);
  });

  it('produces a deterministic report with sample warnings and formulas', () => {
    const cohorts = createSyntheticAuditCohorts();
    const first = evaluateFairness(cohorts);
    const second = evaluateFairness(cohorts);

    expect(first).toEqual(second);
    expect(first.labels).toEqual(['synthetic', 'evaluation-only', 'not a lending decision']);
    expect(first.formulas.adverseImpactRatio).toContain('threshold rate');
    expect(first.groupMetrics.every((group) => group.sampleSizeWarning)).toBe(true);
    expect(first.groupMetrics.some((group) => group.adverseImpactRatio !== null)).toBe(true);
  });

  it('surfaces disparities instead of hiding them', () => {
    const report = evaluateFairness([
      { auditGroup: 'group_alpha', scoringInput: inputFor('high', 850) },
      { auditGroup: 'group_beta', scoringInput: inputFor('low', 350) },
    ], { ...DEFAULT_THRESHOLDS, minimumGroupSize: 1 });

    expect(report.status).toBe('warn');
    expect(report.checks.some((check) => check.name === 'absolute mean score gap' && check.status === 'warn')).toBe(true);
    expect(report.groupMetrics.find((group) => group.auditGroup === 'group_beta')?.absoluteMeanScoreGap).not.toBe(0);
  });

  it('rejects protected and proxy fields before scoring', () => {
    expect(() => scoreApplication({
      ...inputFor('protected'),
      applicantId: 'protected',
      application: { ...inputFor('protected').application, collegePrestige: 10 },
    } as never)).toThrow(ProtectedInputError);
    expect(() => evaluateSyntheticApplicant({
      auditGroup: 'group_alpha',
      scoringInput: { ...inputFor('proxy'), declaredEmployment: { employer: 'Example' } },
      auditOnlyMetadata: { address: 'proxy metadata' },
    })).not.toThrow();
    expect(() => evaluateSyntheticApplicant({
      auditGroup: 'group_alpha',
      scoringInput: { ...inputFor('protected'), application: { ...inputFor('protected').application, collegePrestige: 10 } } as never,
    })).toThrow(ProtectedInputError);
  });

  it('does not emit real-decision language', () => {
    const reportText = JSON.stringify(evaluateFairness(createSyntheticAuditCohorts()));

    expect(reportText).not.toMatch(/\b(approve|reject|eligible|decline)\b/i);
  });
});
