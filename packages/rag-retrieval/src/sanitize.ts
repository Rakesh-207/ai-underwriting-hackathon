import { RAG_TOPICS, type RagTopic, type SanitizedRagQuery } from './types';

const QUERY_KEYS = new Set(['featureKeys', 'anomalyTypes', 'behaviorChangeCategories', 'explanationQuestion', 'allowedCorpusTopics']);
const FORBIDDEN_TERMS = /(?:name|address|email|phone|telephone|account\s*(?:number|no)|salary|employer|institution|college|university|transaction|uploaded\s*(?:document|file)|consent\s*(?:receipt|contents?)|gender|caste|religion|race|ethnicity|nationality|disability|age|income\s*amount|₹|\$\s*\d|\b\d{7,}\b)/i;
const FORBIDDEN_IDENTIFIER_TERMS = /(?:name|address|email|phone|telephone|account|salary|employer|institution|college|university|uploaded|document|consent|gender|caste|religion|race|ethnicity|nationality|disability|age)/i;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{8,}\d)/;

export class RagQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RagQueryValidationError';
  }
}

export function createSanitizedQuery(input: unknown): SanitizedRagQuery {
  if (!isRecord(input)) throw new RagQueryValidationError('RAG query must be an object.');
  for (const key of Object.keys(input)) {
    if (!QUERY_KEYS.has(key)) throw new RagQueryValidationError(`RAG query field is not allowed: ${key}`);
  }
  const featureKeys = identifierArray(input.featureKeys, 'featureKeys');
  const anomalyTypes = identifierArray(input.anomalyTypes, 'anomalyTypes');
  const behaviorChangeCategories = identifierArray(input.behaviorChangeCategories, 'behaviorChangeCategories');
  const explanationQuestion = requiredString(input.explanationQuestion, 'explanationQuestion');
  const allowedCorpusTopics = topicArray(input.allowedCorpusTopics);
  if (containsForbiddenData(explanationQuestion)) {
    throw new RagQueryValidationError('RAG query contains applicant data or a prohibited field.');
  }
  return Object.freeze({
    featureKeys: Object.freeze(featureKeys),
    anomalyTypes: Object.freeze(anomalyTypes),
    behaviorChangeCategories: Object.freeze(behaviorChangeCategories),
    explanationQuestion,
    allowedCorpusTopics: Object.freeze(allowedCorpusTopics),
  });
}

export function queryText(query: SanitizedRagQuery): string {
  return [
    `Feature keys: ${query.featureKeys.join(', ') || 'none'}`,
    `Anomaly types: ${query.anomalyTypes.join(', ') || 'none'}`,
    `Behavior-change categories: ${query.behaviorChangeCategories.join(', ') || 'none'}`,
    `Explanation question: ${query.explanationQuestion}`,
  ].join('\n');
}

function identifierArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(item.trim()) || FORBIDDEN_IDENTIFIER_TERMS.test(item))) {
    throw new RagQueryValidationError(`${field} must be an array of safe feature or category keys.`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

function topicArray(value: unknown): RagTopic[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !RAG_TOPICS.includes(item as RagTopic))) {
    throw new RagQueryValidationError('allowedCorpusTopics must contain only supported corpus topics.');
  }
  return [...new Set(value as RagTopic[])];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new RagQueryValidationError(`${field} must be a non-empty string.`);
  return value.trim();
}

function containsForbiddenData(value: string): boolean {
  return FORBIDDEN_TERMS.test(value) || EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
