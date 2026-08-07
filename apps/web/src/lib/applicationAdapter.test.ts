import { beforeEach, expect, test } from 'vitest';
import { createApplicationAdapter, type ApplicationDraft } from './applicationAdapter.ts';

const draft: ApplicationDraft = {
  applicantName: 'Example applicant', address: 'Demo address', employmentType: 'Salaried', employer: 'Example employer', jobTitle: 'Analyst', employmentTenure: 24, monthlyIncome: 8000, monthlyObligations: 2200, educationCredential: 'Bachelor degree', requestedAmount: 18000, repaymentTenure: 24, bureauScore: 720, purpose: 'Home improvement', sources: {
    accountAggregator: { consent: false, state: 'Not connected' }, employmentDigiLocker: { consent: false, state: 'Not connected' }, educationDigiLocker: { consent: false, state: 'Not connected' }, professional: { consent: false, state: 'Not connected' },
  },
};

beforeEach(() => localStorage.clear());

test('starts empty and only creates the example after an explicit action', () => {
  const adapter = createApplicationAdapter();
  expect(adapter.list()).toHaveLength(0);
  const example = adapter.createSyntheticExample();
  expect(example.example).toBe(true);
  expect(example.review?.score.riskBand).toBe('strong');
});

test('declining optional sources still allows a baseline assessment', () => {
  const adapter = createApplicationAdapter();
  const record = adapter.review(draft);
  expect(record.status).toBe('Reviewed');
  expect(record.review?.alternativeAvailable).toBe(false);
  expect(record.review?.score.baselineScore).toBe(record.review?.score.dynamicScore);
});

test('connector consent is local metadata and can be revoked', () => {
  const adapter = createApplicationAdapter();
  const connected = adapter.updateSource(adapter.saveDraft(draft).id, 'employmentDigiLocker', true);
  expect(connected.draft.sources.employmentDigiLocker.state).toBe('Connected');
  const revoked = adapter.updateSource(connected.id, 'employmentDigiLocker', false);
  expect(revoked.draft.sources.employmentDigiLocker.state).toBe('Not connected');
  expect(localStorage.getItem('synthetic-loan-applications-v2')).toContain('employmentDigiLocker');
});

test('unknown IDs are not replaced by the example fixture', () => {
  expect(createApplicationAdapter().get('unknown')).toBeNull();
});
