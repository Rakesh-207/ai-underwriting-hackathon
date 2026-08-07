import type {
  ApplicantProfile,
  ApplicantsResponse,
  AuditEvent,
  ConsentReceipt,
  FairnessReport,
  ScoreResult,
} from '@underwriting/shared';

export interface SimulationSummary {
  applicantId: string;
  reliabilityScore: number | null;
  riskBand: ScoreResult['riskBand'] | null;
  consentState: ConsentReceipt['status'] | 'missing';
  lastUpdated: string | null;
}

export interface SimulationData {
  simulationId: string;
  summary: SimulationSummary;
  applicants: ApplicantsResponse['applicants'];
  applicant: ApplicantProfile | null;
  consent: ConsentReceipt | null;
  score: ScoreResult | null;
  fairness: FairnessReport | null;
  audit: AuditEvent[];
  loading: boolean;
  error: string | null;
}
