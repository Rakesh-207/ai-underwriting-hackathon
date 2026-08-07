import type {
  ApplicantProfile,
  AuditEvent,
  BehaviorUpdate,
  ConsentReceipt,
  ScoreResult,
} from '@underwriting/shared';

export interface SimulationRecord {
  simulationId: string;
  clerkUserId: string;
  applicantId: string;
  behaviorUpdates: BehaviorUpdate[];
  latestScore: ScoreResult | null;
}

export interface SimulationRepository {
  getSimulation(simulationId: string): SimulationRecord | undefined;
  listSimulations(): SimulationRecord[];
  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string): SimulationRecord;
  listApplicants(): ApplicantProfile[];
  getConsent(consentId: string): ConsentReceipt | undefined;
  listConsents(simulationId: string): ConsentReceipt[];
  saveConsent(receipt: ConsentReceipt): void;
  saveBehavior(update: BehaviorUpdate): void;
  saveScore(result: ScoreResult): void;
  addAudit(event: AuditEvent): void;
  listAudit(simulationId: string): AuditEvent[];
}

const applicants: ApplicantProfile[] = [
  {
    applicantId: 'app-hero',
    displayName: 'Synthetic Applicant A',
    baseline: {
      bureauScore: 720,
      monthlyIncome: 95000,
      monthlyDebt: 25000,
      employmentMonths: 48,
      applicationCompleteness: 0.95,
    },
    alternative: {
      cashflowStability: 0.82,
      incomeConsistency: 0.88,
      savingsBufferMonths: 4.2,
      onTimePaymentRate: 0.94,
    },
    provenance: [],
  },
  {
    applicantId: 'app-review',
    displayName: 'Synthetic Applicant B',
    baseline: {
      bureauScore: 650,
      monthlyIncome: 70000,
      monthlyDebt: 35000,
      employmentMonths: 18,
      applicationCompleteness: 0.8,
    },
    alternative: {
      cashflowStability: 0.52,
      incomeConsistency: 0.58,
      savingsBufferMonths: 1.1,
      onTimePaymentRate: 0.63,
    },
    provenance: [],
  },
];

export class InMemorySimulationRepository implements SimulationRepository {
  private readonly simulations = new Map<string, SimulationRecord>();
  private readonly consents = new Map<string, ConsentReceipt>();
  private readonly audits = new Map<string, AuditEvent[]>();

  getSimulation(simulationId: string) { return this.simulations.get(simulationId); }
  listSimulations() { return [...this.simulations.values()]; }
  ensureSimulation(simulationId: string, clerkUserId: string, applicantId: string) {
    const existing = this.simulations.get(simulationId);
    if (existing) return existing;
    const record = { simulationId, clerkUserId, applicantId, behaviorUpdates: [], latestScore: null };
    this.simulations.set(simulationId, record);
    return record;
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
  addAudit(event: AuditEvent) { this.audits.set(event.simulationId, [...(this.audits.get(event.simulationId) ?? []), event]); }
  listAudit(simulationId: string) { return this.audits.get(simulationId) ?? []; }
}

// Deployment adapter placeholder. It intentionally remains inactive until a D1 binding is configured.
export class D1SimulationRepository implements SimulationRepository {
  constructor(db: D1Database) { void db; }
  private deferred(): never { throw new Error('D1 repository is deferred until a binding is configured'); }
  getSimulation(): SimulationRecord | undefined { return this.deferred(); }
  listSimulations(): SimulationRecord[] { return this.deferred(); }
  ensureSimulation(): SimulationRecord { return this.deferred(); }
  listApplicants(): ApplicantProfile[] { return this.deferred(); }
  getConsent(): ConsentReceipt | undefined { return this.deferred(); }
  listConsents(): ConsentReceipt[] { return this.deferred(); }
  saveConsent(): void { this.deferred(); }
  saveBehavior(): void { this.deferred(); }
  saveScore(): void { this.deferred(); }
  addAudit(): void { this.deferred(); }
  listAudit(): AuditEvent[] { return this.deferred(); }
}

export const repository = new InMemorySimulationRepository();
