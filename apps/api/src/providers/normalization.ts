import type {
  NormalizedAlternativeData,
  RawAccountAggregatorData,
  RawDigiLockerData,
  RawProviderResponse,
} from '@underwriting/shared';

export function normalizeAccountAggregatorData(
  response: RawProviderResponse<RawAccountAggregatorData>,
): NormalizedAlternativeData {
  return {
    source: response.provenance.source,
    employmentConsistency: 'not_applicable',
    educationCredentialConsistency: 'not_applicable',
    verificationStatus: 'not_applicable',
    evidence: response.data.transactions.map((transaction) => ({
      type: 'transaction',
      reference: transaction.transactionId,
      verificationStatus: 'observed',
    })),
    provenanceReferences: [response.provenance.reference],
    consentReferences: [response.consent.consentReference],
  };
}

export function normalizeDigiLockerData(
  responses: Array<RawProviderResponse<RawDigiLockerData>>,
): NormalizedAlternativeData {
  const employment = responses.flatMap(({ data }) => data.recordType === 'employment' ? data.records : []);
  const education = responses.flatMap(({ data }) => data.recordType === 'education' ? data.records : []);
  const evidence = [
    ...employment.map((record) => ({ type: 'employment' as const, reference: record.provenanceReference, verificationStatus: record.verificationStatus })),
    ...education.map((record) => ({ type: 'education' as const, reference: record.provenanceReference, verificationStatus: record.verificationStatus })),
  ];

  return {
    source: responses[0]?.provenance.source ?? 'digilocker_employment',
    employmentConsistency: consistency(employment.map((record) => `${record.employer}:${record.startDate}`)),
    educationCredentialConsistency: consistency(education.map((record) => `${record.institution}:${record.completionYear}`)),
    verificationStatus: verificationStatus(evidence.map((item) => item.verificationStatus)),
    evidence,
    provenanceReferences: responses.map((response) => response.provenance.reference),
    consentReferences: responses.map((response) => response.consent.consentReference),
  };
}

function consistency(values: string[]): 'consistent' | 'inconsistent' | 'not_applicable' {
  if (values.length === 0) return 'not_applicable';
  return new Set(values).size === 1 ? 'consistent' : 'inconsistent';
}

function verificationStatus(values: Array<'verified' | 'unverified' | 'observed'>): NormalizedAlternativeData['verificationStatus'] {
  if (values.length === 0) return 'not_applicable';
  if (values.every((value) => value === 'verified')) return 'verified';
  if (values.some((value) => value === 'verified')) return 'partially_verified';
  return 'unverified';
}
