export type AlternativeDataSource =
  | 'account_aggregator'
  | 'digilocker_employment'
  | 'digilocker_education'
  | 'professional_presence';

export type ConsentScope =
  | 'account_transactions'
  | 'employment_records'
  | 'education_records'
  | 'professional_presence';

export type AlternativeDataPurpose =
  | 'cashflow_analysis'
  | 'employment_verification'
  | 'education_verification'
  | 'professional_presence_verification';

export interface ConsentContext {
  source: AlternativeDataSource;
  purpose: AlternativeDataPurpose;
  scopes: ConsentScope[];
  timestamp: string;
  consentReference: string;
}

export interface ProviderProvenance {
  source: AlternativeDataSource;
  provider: string;
  reference: string;
  retrievedAt: string;
}

export interface RawProviderResponse<T> {
  data: T;
  provenance: ProviderProvenance;
  consent: ConsentContext;
}

export interface AccountTransaction {
  transactionId: string;
  postedAt: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  balanceAfter: number;
}

export interface RawAccountAggregatorData {
  syntheticAccountId: string;
  statementPeriod: { from: string; to: string };
  transactions: AccountTransaction[];
  balance: { opening: number; closing: number; currency: 'INR' };
}

export interface VerifiedEmploymentRecord {
  documentId: string;
  issuer: string;
  employer: string;
  role: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  startDate: string;
  endDate: string | null;
  verificationStatus: 'verified' | 'unverified';
  issuedDate: string;
  provenanceReference: string;
}

export interface VerifiedEducationRecord {
  documentId: string;
  issuer: string;
  credentialType: string;
  fieldOfStudy: string;
  institution: string;
  completionYear: number;
  verificationStatus: 'verified' | 'unverified';
  issuedDate: string;
  provenanceReference: string;
}

export interface RawDigiLockerEmploymentData {
  recordType: 'employment';
  records: VerifiedEmploymentRecord[];
}

export interface RawDigiLockerEducationData {
  recordType: 'education';
  records: VerifiedEducationRecord[];
}

export type RawDigiLockerData = RawDigiLockerEmploymentData | RawDigiLockerEducationData;

export interface NormalizedEvidence {
  type: 'transaction' | 'employment' | 'education';
  reference: string;
  verificationStatus: 'verified' | 'unverified' | 'observed';
}

export interface NormalizedAlternativeData {
  source: AlternativeDataSource;
  employmentConsistency: 'consistent' | 'inconsistent' | 'not_applicable';
  educationCredentialConsistency: 'consistent' | 'inconsistent' | 'not_applicable';
  verificationStatus: 'verified' | 'partially_verified' | 'unverified' | 'not_applicable';
  evidence: NormalizedEvidence[];
  provenanceReferences: string[];
  consentReferences: string[];
}
