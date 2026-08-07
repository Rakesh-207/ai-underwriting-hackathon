import type { BehaviorEventType, ConsentPurpose, DataSource } from '@underwriting/shared';

export interface ValidationResult<T> {
  value?: T;
  fieldErrors: Record<string, string[]>;
}

const purposes = new Set<ConsentPurpose>([
  'application_baseline',
  'alternative_cashflow',
  'behavior_updates',
  'fraud_screening',
]);
const eventTypes = new Set<BehaviorEventType>([
  'income_observation',
  'payment_observation',
  'savings_observation',
]);

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type JsonObject = Record<string, unknown>;

export function requiredString(body: JsonObject, key: string): string | undefined {
  return typeof body[key] === 'string' && body[key].trim().length > 0 ? body[key] as string : undefined;
}

export function requiredStringArray(body: JsonObject, key: string): string[] | undefined {
  return Array.isArray(body[key]) && body[key].every((item) => typeof item === 'string') ? body[key] as string[] : undefined;
}

function addRequiredString(body: Record<string, unknown>, key: string, errors: Record<string, string[]>) {
  if (typeof body[key] !== 'string' || body[key].trim().length === 0) {
    errors[key] = [`${key} is required.`];
  }
}

export function parseJsonBody<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
}

export function validateConsent(body: unknown): ValidationResult<{
  simulationId: string;
  applicantId: string;
  purposes: ConsentPurpose[];
  categories: string[];
  source: DataSource;
}> {
  const errors: Record<string, string[]> = {};
  const input = parseJsonBody<Record<string, unknown>>(body) ?? {};
  addRequiredString(input, 'simulationId', errors);
  addRequiredString(input, 'applicantId', errors);
  if (!Array.isArray(input.purposes) || input.purposes.length === 0 || input.purposes.some((item) => typeof item !== 'string' || !purposes.has(item as ConsentPurpose))) {
    errors.purposes = ['purposes must contain at least one allowed purpose.'];
  }
  const categories = Array.isArray(input.categories) && input.categories.every((item) => typeof item === 'string')
    ? input.categories as string[]
    : [];
  if (typeof input.source !== 'string' || !['synthetic_fixture', 'consented_manual_entry'].includes(input.source)) {
    errors.source = ['source must be synthetic_fixture or consented_manual_entry.'];
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    fieldErrors: {},
    value: {
      simulationId: input.simulationId as string,
      applicantId: input.applicantId as string,
      purposes: input.purposes as ConsentPurpose[],
      categories,
      source: input.source as DataSource,
    },
  };
}

export function validateBehavior(body: unknown): ValidationResult<{
  simulationId: string;
  applicantId: string;
  eventType: BehaviorEventType;
  value: number;
  consentId: string;
}> {
  const errors: Record<string, string[]> = {};
  const input = parseJsonBody<Record<string, unknown>>(body) ?? {};
  addRequiredString(input, 'simulationId', errors);
  addRequiredString(input, 'applicantId', errors);
  addRequiredString(input, 'consentId', errors);
  if (typeof input.eventType !== 'string' || !eventTypes.has(input.eventType as BehaviorEventType)) {
    errors.eventType = ['eventType must be a supported behavior event.'];
  }
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) errors.value = ['value must be a finite number.'];
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    fieldErrors: {},
    value: {
      simulationId: input.simulationId as string,
      applicantId: input.applicantId as string,
      eventType: input.eventType as BehaviorEventType,
      value: input.value as number,
      consentId: input.consentId as string,
    },
  };
}

export function validateSimulation(body: unknown): ValidationResult<{ simulationId: string }> {
  const errors: Record<string, string[]> = {};
  const input = parseJsonBody<Record<string, unknown>>(body) ?? {};
  addRequiredString(input, 'simulationId', errors);
  return Object.keys(errors).length > 0
    ? { fieldErrors: errors }
    : { fieldErrors: {}, value: { simulationId: input.simulationId as string } };
}
