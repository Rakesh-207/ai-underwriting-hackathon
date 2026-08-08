import type {
  ApplicantProfile,
  AuditEvent,
  BehaviorUpdate,
  ConsentReceipt,
  ScoreResult,
  RawAccountAggregatorData,
  RawDigiLockerEducationData,
  RawDigiLockerEmploymentData,
  RawProviderResponse,
} from '@underwriting/shared';
import type { ApplicationBaseline, DeclaredEmployment } from '@underwriting/engine';

export type ProviderSource = 'account_aggregator' | 'digilocker_employment' | 'digilocker_education';
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
  providers: Partial<Record<ProviderSource, StoredProviderResponse>>;
}

type MaybePromise<T> = T | Promise<T>;

export interface SimulationRepository {
  getSimulation(simulationId: string): MaybePromise<SimulationRecord | undefined>;
  listSimulations(): MaybePromise<SimulationRecord[]>;
  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string): MaybePromise<SimulationRecord>;
  saveApplication(simulationId: string, application: ApplicationBaseline, declaredEmployment?: DeclaredEmployment): MaybePromise<SimulationRecord | undefined>;
  listApplicants(): ApplicantProfile[];
  getConsent(consentId: string): MaybePromise<ConsentReceipt | undefined>;
  listConsents(simulationId: string): MaybePromise<ConsentReceipt[]>;
  saveConsent(receipt: ConsentReceipt): MaybePromise<void>;
  saveBehavior(update: BehaviorUpdate): MaybePromise<void>;
  saveScore(result: ScoreResult): MaybePromise<void>;
  saveProvider(simulationId: string, source: ProviderSource, response: StoredProviderResponse): MaybePromise<void>;
  addAudit(event: AuditEvent): MaybePromise<void>;
  listAudit(simulationId: string): MaybePromise<AuditEvent[]>;
}

const applicants: ApplicantProfile[] = [
  {
    applicantId: 'app-hero',
    displayName: 'Synthetic Applicant A',
    baseline: { bureauScore: 720, monthlyIncome: 95000, monthlyDebt: 25000, employmentMonths: 48, applicationCompleteness: 0.95 },
    alternative: { cashflowStability: 0.82, incomeConsistency: 0.88, savingsBufferMonths: 4.2, onTimePaymentRate: 0.94 },
    provenance: [],
  },
  {
    applicantId: 'app-review',
    displayName: 'Synthetic Applicant B',
    baseline: { bureauScore: 650, monthlyIncome: 70000, monthlyDebt: 35000, employmentMonths: 18, applicationCompleteness: 0.8 },
    alternative: { cashflowStability: 0.52, incomeConsistency: 0.58, savingsBufferMonths: 1.1, onTimePaymentRate: 0.63 },
    provenance: [],
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
  protected readonly simulations = new Map<string, SimulationRecord>();
  protected readonly consents = new Map<string, ConsentReceipt>();
  protected readonly audits = new Map<string, AuditEvent[]>();

  getSimulation(simulationId: string) { return this.simulations.get(simulationId); }
  listSimulations() { return [...this.simulations.values()]; }

  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string) {
    const existing = this.simulations.get(simulationId);
    if (existing) return existing;
    const record: SimulationRecord = {
      simulationId,
      clerkUserId,
      applicantId,
      application: defaultApplication(applicantId),
      behaviorUpdates: [],
      latestScore: null,
      providers: {},
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
    if (simulation && !simulation.behaviorUpdates.some((item) => item.updateId === update.updateId)) simulation.behaviorUpdates.push(update);
  }

  saveScore(result: ScoreResult) {
    const simulation = this.simulations.get(result.simulationId);
    if (simulation) simulation.latestScore = result;
  }

  saveProvider(simulationId: string, source: ProviderSource, response: StoredProviderResponse) {
    const simulation = this.simulations.get(simulationId);
    if (simulation) simulation.providers[source] = response;
  }

  addAudit(event: AuditEvent) { this.audits.set(event.simulationId, [...(this.audits.get(event.simulationId) ?? []), event]); }
  listAudit(simulationId: string) { return this.audits.get(simulationId) ?? []; }
}

interface ApplicationRow extends JsonRow {
  simulation_id: string;
  clerk_user_id: string;
  applicant_id: string;
  application_json: string;
  declared_employment_json: string | null;
}

interface JsonRow { [key: string]: unknown; }

export class D1SimulationRepository implements SimulationRepository {
  constructor(private readonly db: D1Database) {}

  listApplicants() { return applicants.map((applicant) => structuredClone(applicant)); }

  private async first<T extends JsonRow>(query: string, ...args: unknown[]): Promise<T | null> {
    return this.db.prepare(query).bind(...args).first<T>();
  }

  private async all<T extends JsonRow>(query: string, ...args: unknown[]): Promise<T[]> {
    const result = await this.db.prepare(query).bind(...args).all<T>();
    return result.results ?? [];
  }

  private async run(query: string, ...args: unknown[]): Promise<void> {
    await this.db.prepare(query).bind(...args).run();
  }

  private async related(simulationId: string): Promise<Pick<SimulationRecord, 'behaviorUpdates' | 'latestScore' | 'providers'>> {
    const [behaviorRows, scoreRow, providerRows] = await Promise.all([
      this.all<{ update_json: string }>('SELECT update_json FROM behavior_updates WHERE simulation_id = ? ORDER BY update_id', simulationId),
      this.first<{ score_json: string }>('SELECT score_json FROM score_snapshots WHERE simulation_id = ? ORDER BY score_id DESC LIMIT 1', simulationId),
      this.all<{ source: ProviderSource; provider_json: string }>('SELECT source, provider_json FROM provider_snapshots WHERE simulation_id = ?', simulationId),
    ]);
    const providers: Partial<Record<ProviderSource, StoredProviderResponse>> = {};
    for (const row of providerRows) providers[row.source] = JSON.parse(row.provider_json) as StoredProviderResponse;
    return {
      behaviorUpdates: behaviorRows.map((row) => JSON.parse(row.update_json) as BehaviorUpdate),
      latestScore: scoreRow ? JSON.parse(scoreRow.score_json) as ScoreResult : null,
      providers,
    };
  }

  private toRecord(row: ApplicationRow, related: Pick<SimulationRecord, 'behaviorUpdates' | 'latestScore' | 'providers'>): SimulationRecord {
    return {
      simulationId: row.simulation_id,
      clerkUserId: row.clerk_user_id,
      applicantId: row.applicant_id,
      application: JSON.parse(row.application_json) as ApplicationBaseline,
      declaredEmployment: row.declared_employment_json ? JSON.parse(row.declared_employment_json) as DeclaredEmployment : undefined,
      ...related,
    };
  }

  async getSimulation(simulationId: string) {
    const row = await this.first<ApplicationRow>('SELECT simulation_id, clerk_user_id, applicant_id, application_json, declared_employment_json FROM applications WHERE simulation_id = ?', simulationId);
    return row ? this.toRecord(row, await this.related(simulationId)) : undefined;
  }

  async listSimulations() {
    const rows = await this.all<ApplicationRow>('SELECT simulation_id, clerk_user_id, applicant_id, application_json, declared_employment_json FROM applications');
    return Promise.all(rows.map(async (row) => this.toRecord(row, await this.related(row.simulation_id))));
  }

  async ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string) {
    const existing = await this.getSimulation(simulationId);
    if (existing) return existing;
    const application = defaultApplication(applicantId);
    await this.run('INSERT INTO applications (simulation_id, clerk_user_id, applicant_id, application_json, declared_employment_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', simulationId, clerkUserId, applicantId, JSON.stringify(application), null, new Date().toISOString());
    return { simulationId, clerkUserId, applicantId, application, behaviorUpdates: [], latestScore: null, providers: {} } satisfies SimulationRecord;
  }

  async saveApplication(simulationId: string, application: ApplicationBaseline, declaredEmployment?: DeclaredEmployment) {
    const existing = await this.getSimulation(simulationId);
    if (!existing) return undefined;
    await this.run('UPDATE applications SET application_json = ?, declared_employment_json = ? WHERE simulation_id = ? AND clerk_user_id = ?', JSON.stringify(application), declaredEmployment ? JSON.stringify(declaredEmployment) : null, simulationId, existing.clerkUserId);
    return { ...existing, application, declaredEmployment };
  }

  async getConsent(consentId: string) {
    const row = await this.first<{ receipt_json: string }>('SELECT receipt_json FROM consent_receipts WHERE consent_id = ?', consentId);
    return row ? JSON.parse(row.receipt_json) as ConsentReceipt : undefined;
  }

  async listConsents(simulationId: string) {
    const rows = await this.all<{ receipt_json: string }>('SELECT receipt_json FROM consent_receipts WHERE simulation_id = ?', simulationId);
    return rows.map((row) => JSON.parse(row.receipt_json) as ConsentReceipt);
  }

  async saveConsent(receipt: ConsentReceipt) {
    await this.run('INSERT OR REPLACE INTO consent_receipts (consent_id, simulation_id, clerk_user_id, receipt_json, receipt_hash) VALUES (?, ?, ?, ?, ?)', receipt.consentId, receipt.simulationId, receipt.clerkUserId, JSON.stringify(receipt), receipt.receiptHash);
  }

  async saveBehavior(update: BehaviorUpdate) {
    await this.run('INSERT INTO behavior_updates (update_id, simulation_id, applicant_id, consent_id, update_json) VALUES (?, ?, ?, ?, ?)', update.updateId, update.simulationId, update.applicantId, update.consentId, JSON.stringify(update));
  }

  async saveScore(result: ScoreResult) {
    await this.run('INSERT OR REPLACE INTO score_snapshots (score_id, simulation_id, applicant_id, score_json) VALUES (?, ?, ?, ?)', result.scoreId, result.simulationId, result.applicantId, JSON.stringify(result));
  }

  async saveProvider(simulationId: string, source: ProviderSource, response: StoredProviderResponse) {
    await this.run('INSERT OR REPLACE INTO provider_snapshots (simulation_id, source, provider_json) VALUES (?, ?, ?)', simulationId, source, JSON.stringify(response));
  }

  async addAudit(event: AuditEvent) {
    await this.run('INSERT INTO audit_events (event_id, simulation_id, applicant_id, clerk_user_id, event_json) VALUES (?, ?, ?, ?, ?)', event.eventId, event.simulationId, event.applicantId, event.clerkUserId, JSON.stringify(event));
  }

  async listAudit(simulationId: string) {
    const rows = await this.all<{ event_json: string }>('SELECT event_json FROM audit_events WHERE simulation_id = ? ORDER BY event_id', simulationId);
    return rows.map((row) => JSON.parse(row.event_json) as AuditEvent);
  }
}

export const repository = new InMemorySimulationRepository();

export function repositoryFor(env: { DB?: D1Database }): SimulationRepository {
  return env.DB ? new D1SimulationRepository(env.DB) : repository;
}
