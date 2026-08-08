import type {
  ApplicantProfile,
  AuditEvent,
  BehaviorUpdate,
  ConsentReceipt,
  ScoreResult,
} from '@underwriting/shared';
import type {
  ApplicationBaseline,
  DeclaredEmployment,
} from '@underwriting/engine';
import type { RawProviderResponse, RawAccountAggregatorData, RawDigiLockerEmploymentData, RawDigiLockerEducationData } from '@underwriting/shared';

export type StoredProviderResponse =
  | RawProviderResponse<RawAccountAggregatorData>
  | RawProviderResponse<RawDigiLockerEmploymentData>
  | RawProviderResponse<RawDigiLockerEducationData>;

export interface SimulationRecord {
  simulationId: string;
  clerkUserId: string;
  applicantId: string;
  application: ApplicationBaseline;
  declaredEmployment?: DeclaredEmployment;
  behaviorUpdates: BehaviorUpdate[];
  latestScore: ScoreResult | null;
  providers: Partial<Record<'account_aggregator' | 'digilocker_employment' | 'digilocker_education', StoredProviderResponse>>;
}

export interface SimulationRepository {
  getSimulation(simulationId: string): SimulationRecord | undefined;
  listSimulations(): SimulationRecord[];
  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string): SimulationRecord;
  saveApplication(simulationId: string, application: ApplicationBaseline, declaredEmployment?: DeclaredEmployment): SimulationRecord | undefined;
  listApplicants(): ApplicantProfile[];
  getConsent(consentId: string): ConsentReceipt | undefined;
  listConsents(simulationId: string): ConsentReceipt[];
  saveConsent(receipt: ConsentReceipt): void;
  saveBehavior(update: BehaviorUpdate): void;
  saveScore(result: ScoreResult): void;
  saveProvider(simulationId: string, source: keyof SimulationRecord['providers'], response: StoredProviderResponse): void;
  addAudit(event: AuditEvent): void;
  listAudit(simulationId: string): AuditEvent[];
}

const applicants: ApplicantProfile[] = [
  {
    applicantId: 'app-hero', displayName: 'Synthetic Applicant A',
    baseline: { bureauScore: 720, monthlyIncome: 95000, monthlyDebt: 25000, employmentMonths: 48, applicationCompleteness: 0.95 },
    alternative: { cashflowStability: 0.82, incomeConsistency: 0.88, savingsBufferMonths: 4.2, onTimePaymentRate: 0.94 }, provenance: [],
  },
  {
    applicantId: 'app-review', displayName: 'Synthetic Applicant B',
    baseline: { bureauScore: 650, monthlyIncome: 70000, monthlyDebt: 35000, employmentMonths: 18, applicationCompleteness: 0.8 },
    alternative: { cashflowStability: 0.52, incomeConsistency: 0.58, savingsBufferMonths: 1.1, onTimePaymentRate: 0.63 }, provenance: [],
  },
];

function defaultApplication(applicantId: string): ApplicationBaseline {
  const applicant = applicants.find((item) => item.applicantId === applicantId) ?? applicants[0];
  return {
    bureauScore: applicant.baseline.bureauScore,
    monthlyIncome: applicant.baseline.monthlyIncome,
    monthlyObligations: applicant.baseline.monthlyDebt,
    requestedAmount: 120000,
    loanTenureMonths: 12,
  };
}

export class InMemorySimulationRepository implements SimulationRepository {
  private readonly simulations = new Map<string, SimulationRecord>();
  private readonly consents = new Map<string, ConsentReceipt>();
  private readonly audits = new Map<string, AuditEvent[]>();

  getSimulation(simulationId: string) { return this.simulations.get(simulationId); }
  listSimulations() { return [...this.simulations.values()]; }
  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string) {
    const existing = this.simulations.get(simulationId);
    if (existing) return existing;
    const record: SimulationRecord = {
      simulationId, clerkUserId, applicantId, application: defaultApplication(applicantId),
      behaviorUpdates: [], latestScore: null, providers: {},
    };
    this.simulations.set(simulationId, record);
    return record;
  }
  saveApplication(simulationId: string, application: ApplicationBaseline, declaredEmployment?: DeclaredEmployment) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return undefined;
    simulation.application = application;
    simulation.declaredEmployment = declaredEmployment;
    return simulation;
  }
  listApplicants() { return applicants.map((applicant) => structuredClone(applicant)); }
  getConsent(consentId: string) { return this.consents.get(consentId); }
  listConsents(simulationId: string) { return [...this.consents.values()].filter((item) => item.simulationId === simulationId); }
  saveConsent(receipt: ConsentReceipt) { this.consents.set(receipt.consentId, receipt); }
  saveBehavior(update: BehaviorUpdate) {
    const simulation = this.simulations.get(update.simulationId);
    if (simulation) simulation.behaviorUpdates.push(update);
  }
  saveScore(result: ScoreResult) {
    const simulation = this.simulations.get(result.simulationId);
    if (simulation) simulation.latestScore = result;
  }
  saveProvider(simulationId: string, source: keyof SimulationRecord['providers'], response: StoredProviderResponse) {
    const simulation = this.simulations.get(simulationId);
    if (simulation) simulation.providers[source] = response;
  }
  addAudit(event: AuditEvent) { this.audits.set(event.simulationId, [...(this.audits.get(event.simulationId) ?? []), event]); }
  listAudit(simulationId: string) { return this.audits.get(simulationId) ?? []; }
}

// D1 is not enabled in the checked-in Wrangler configuration. This adapter keeps
// a local read-through cache and writes each mutation to the documented tables.
export class D1SimulationRepository extends InMemorySimulationRepository {
  constructor(private readonly db: D1Database) { super(); }

  override ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string) {
    const record = super.ensureSimulation(simulationId, clerkUserId, applicantId);
    void this.db.prepare('INSERT INTO applications (simulation_id, clerk_user_id, applicant_id, application_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(simulation_id) DO NOTHING')
      .bind(simulationId, clerkUserId, applicantId, JSON.stringify(record.application), new Date().toISOString()).run();
    return record;
  }

  override saveApplication(simulationId: string, application: ApplicationBaseline, declaredEmployment?: DeclaredEmployment) {
    const record = super.saveApplication(simulationId, application, declaredEmployment);
    if (record) void this.db.prepare('UPDATE applications SET application_json = ?, declared_employment_json = ? WHERE simulation_id = ? AND clerk_user_id = ?')
      .bind(JSON.stringify(application), declaredEmployment ? JSON.stringify(declaredEmployment) : null, simulationId, record.clerkUserId).run();
    return record;
  }

  override saveConsent(receipt: ConsentReceipt) {
    super.saveConsent(receipt);
    void this.db.prepare('INSERT OR REPLACE INTO consent_receipts (consent_id, simulation_id, clerk_user_id, receipt_json, receipt_hash) VALUES (?, ?, ?, ?, ?)')
      .bind(receipt.consentId, receipt.simulationId, receipt.clerkUserId, JSON.stringify(receipt), receipt.receiptHash).run();
  }

  override saveBehavior(update: BehaviorUpdate) {
    super.saveBehavior(update);
    void this.db.prepare('INSERT INTO behavior_updates (update_id, simulation_id, applicant_id, consent_id, update_json) VALUES (?, ?, ?, ?, ?)')
      .bind(update.updateId, update.simulationId, update.applicantId, update.consentId, JSON.stringify(update)).run();
  }

  override saveScore(result: ScoreResult) {
    super.saveScore(result);
    void this.db.prepare('INSERT OR REPLACE INTO score_snapshots (score_id, simulation_id, applicant_id, score_json) VALUES (?, ?, ?, ?)')
      .bind(result.scoreId, result.simulationId, result.applicantId, JSON.stringify(result)).run();
  }

  override addAudit(event: AuditEvent) {
    super.addAudit(event);
    void this.db.prepare('INSERT INTO audit_events (event_id, simulation_id, applicant_id, clerk_user_id, event_json) VALUES (?, ?, ?, ?, ?)')
      .bind(event.eventId, event.simulationId, event.applicantId, event.clerkUserId, JSON.stringify(event)).run();
  }
}

export const repository = new InMemorySimulationRepository();
