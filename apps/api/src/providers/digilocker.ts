import type {
  ConsentContext,
  RawDigiLockerData,
  RawProviderResponse,
  VerifiedEducationRecord,
  VerifiedEmploymentRecord,
} from '@underwriting/shared';
import { requireConsent } from './consent.ts';

const RETRIEVED_AT = '2026-08-08T10:06:00.000Z';

export class MockDigiLockerProvider {
  fetch(input: {
    recordType: 'employment';
    consent?: ConsentContext;
  }): RawProviderResponse<Extract<RawDigiLockerData, { recordType: 'employment' }>>;
  fetch(input: {
    recordType: 'education';
    consent?: ConsentContext;
  }): RawProviderResponse<Extract<RawDigiLockerData, { recordType: 'education' }>>;
  fetch(input: { recordType: 'employment' | 'education'; consent?: ConsentContext }): RawProviderResponse<RawDigiLockerData> {
    const source = input.recordType === 'employment' ? 'digilocker_employment' : 'digilocker_education';
    const scope = input.recordType === 'employment' ? 'employment_records' : 'education_records';
    const consent = requireConsent(input.consent, source, [scope]);
    const data = input.recordType === 'employment'
      ? { recordType: 'employment' as const, records: employmentRecords() }
      : { recordType: 'education' as const, records: educationRecords() };

    return {
      data,
      consent,
      provenance: {
        source,
        provider: 'mock-digilocker',
        reference: `digilocker:${input.recordType}:document-001`,
        retrievedAt: RETRIEVED_AT,
      },
    };
  }
}

function employmentRecords(): VerifiedEmploymentRecord[] {
  return [{
    documentId: 'employment-document-001',
    issuer: 'DigiLocker',
    employer: 'Acme Systems Pvt Ltd',
    role: 'Software Engineer',
    employmentType: 'full_time',
    startDate: '2022-06-01',
    endDate: null,
    verificationStatus: 'verified',
    issuedDate: '2026-07-01',
    provenanceReference: 'digilocker:employment:document-001',
  }];
}

function educationRecords(): VerifiedEducationRecord[] {
  return [{
    documentId: 'education-document-001',
    issuer: 'DigiLocker',
    credentialType: 'Bachelor of Technology',
    fieldOfStudy: 'Computer Science',
    institution: 'Example Technical University',
    completionYear: 2022,
    verificationStatus: 'verified',
    issuedDate: '2022-08-15',
    provenanceReference: 'digilocker:education:document-001',
  }];
}
