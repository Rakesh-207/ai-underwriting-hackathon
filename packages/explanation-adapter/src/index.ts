export const RISK_BANDS = ["strong", "moderate", "watch", "high_attention"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

const DIRECTIONS = ["positive", "negative", "neutral"] as const;
const MAGNITUDES = ["low", "medium", "high"] as const;
const LIMITATIONS = [
  "limited_history",
  "missing_consent_source",
  "stale_data",
  "insufficient_signals",
] as const;
const MODEL_NAME = "lfm2.5-1.2b";
const DEFAULT_TIMEOUT_MS = 2_500;
const MAX_TOKENS = 192;
const MAX_INPUT_TEXT_LENGTH = 1_000;

type Direction = (typeof DIRECTIONS)[number];
type Magnitude = (typeof MAGNITUDES)[number];
type Limitation = (typeof LIMITATIONS)[number];

export interface ExplanationEvidence {
  id: string;
  featureName: string;
  direction: Direction;
  magnitude: Magnitude;
}

export interface ExplanationAnomaly {
  id: string;
  severity: Magnitude;
}

export interface RetrievedContextEntry {
  citationId: string;
  title: string;
  text: string;
  sourceUrl: string;
}

export interface ExplanationInput {
  score: number;
  riskBand: RiskBand;
  evidence: ExplanationEvidence[];
  anomalies: ExplanationAnomaly[];
  behaviorScoreChange: {
    direction: "improved" | "declined" | "unchanged";
    magnitude: Magnitude;
  };
  limitations: Limitation[];
  citationIds: string[];
  retrievedContext?: RetrievedContextEntry[];
}

export interface ExplanationReason {
  evidenceId: string;
  text: string;
}

export interface ExplanationTrace {
  model: string;
  latencyMs: number;
  fallback: boolean;
  usedEvidenceIds: string[];
}

export interface ExplanationOutput {
  score: number;
  riskBand: RiskBand;
  reasons: ExplanationReason[];
  citationIds: string[];
  trace: ExplanationTrace;
}

interface ModelOutput {
  reasons: ExplanationReason[];
  citationIds: string[];
}

export interface ExplanationAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  approvedCitationIds?: ReadonlySet<string>;
  fetch?: typeof fetch;
}

export interface ExplanationAdapter {
  explain(input: ExplanationInput): Promise<ExplanationOutput>;
}

type FallbackReason = "timeout" | "request_failed" | "invalid_model_output";

const TOP_LEVEL_KEYS = [
  "score",
  "riskBand",
  "evidence",
  "anomalies",
  "behaviorScoreChange",
  "limitations",
  "citationIds",
  "retrievedContext",
];
const EVIDENCE_KEYS = ["id", "featureName", "direction", "magnitude"];
const ANOMALY_KEYS = ["id", "severity"];
const BEHAVIOR_KEYS = ["direction", "magnitude"];
const CONTEXT_KEYS = ["citationId", "title", "text", "sourceUrl"];

const PII_OR_PROTECTED_TEXT =
  /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d ()-]{7,}\d|\b(?:account|transaction|document|employer|institution|school|college|university|address|phone|email|gender|race|religion|caste|ethnicity|nationality|disability|postcode|postal|zip)\b)/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_FEATURE_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new Error(`Invalid ${label}: unknown field ${key}`);
    }
  }
}

function assertEnum<T extends string>(value: unknown, values: readonly T[], label: string): asserts value is T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertSafeIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertNoApplicantData(value: unknown, label: string): void {
  if (typeof value === "string" && PII_OR_PROTECTED_TEXT.test(value)) {
    throw new Error(`Redacted input contains applicant data in ${label}`);
  }
  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (PII_OR_PROTECTED_TEXT.test(key)) {
        throw new Error(`Redacted input contains protected field ${key}`);
      }
      assertNoApplicantData(nestedValue, `${label}.${key}`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoApplicantData(item, `${label}[${index}]`));
  }
}

function validateContext(
  context: unknown,
  citationIds: ReadonlySet<string>,
  approvedCitationIds: ReadonlySet<string>,
): RetrievedContextEntry[] {
  if (!Array.isArray(context)) {
    throw new Error("Invalid retrievedContext");
  }
  return context.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid retrievedContext entry ${index}`);
    }
    assertExactKeys(entry, CONTEXT_KEYS, `retrievedContext entry ${index}`);
    assertSafeIdentifier(entry.citationId, `retrievedContext entry ${index} citationId`);
    if (!citationIds.has(entry.citationId) || !approvedCitationIds.has(entry.citationId)) {
      throw new Error(`Retrieved context is outside the approved corpus: ${entry.citationId}`);
    }
    for (const field of ["title", "text"] as const) {
      if (typeof entry[field] !== "string" || entry[field].length === 0 || entry[field].length > MAX_INPUT_TEXT_LENGTH) {
        throw new Error(`Invalid retrievedContext ${field}`);
      }
    }
    if (typeof entry.sourceUrl !== "string" || !entry.sourceUrl.startsWith("https://")) {
      throw new Error("Invalid retrievedContext sourceUrl");
    }
    const title = entry.title as string;
    const text = entry.text as string;
    const sourceUrl = entry.sourceUrl as string;
    return {
      citationId: entry.citationId,
      title,
      text,
      sourceUrl,
    };
  });
}

function validateInput(input: ExplanationInput, approvedCorpus?: ReadonlySet<string>): ExplanationInput {
  if (!isRecord(input)) {
    throw new Error("Invalid redacted input");
  }
  assertExactKeys(input, TOP_LEVEL_KEYS, "redacted input");
  if (typeof input.score !== "number" || !Number.isFinite(input.score)) {
    throw new Error("Invalid score");
  }
  assertEnum(input.riskBand, RISK_BANDS, "riskBand");
  if (!Array.isArray(input.evidence) || !Array.isArray(input.anomalies) || !Array.isArray(input.citationIds)) {
    throw new Error("Invalid redacted evidence contract");
  }
  const evidence = input.evidence.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid evidence ${index}`);
    assertExactKeys(item, EVIDENCE_KEYS, `evidence ${index}`);
    assertSafeIdentifier(item.id, `evidence ${index} id`);
    if (typeof item.featureName !== "string" || !SAFE_FEATURE_NAME.test(item.featureName)) {
      throw new Error(`Invalid evidence ${index} featureName`);
    }
    assertEnum(item.direction, DIRECTIONS, `evidence ${index} direction`);
    assertEnum(item.magnitude, MAGNITUDES, `evidence ${index} magnitude`);
    return item as unknown as ExplanationEvidence;
  });
  const anomalies = input.anomalies.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid anomaly ${index}`);
    assertExactKeys(item, ANOMALY_KEYS, `anomaly ${index}`);
    assertSafeIdentifier(item.id, `anomaly ${index} id`);
    assertEnum(item.severity, MAGNITUDES, `anomaly ${index} severity`);
    return item as unknown as ExplanationAnomaly;
  });
  if (!isRecord(input.behaviorScoreChange)) throw new Error("Invalid behaviorScoreChange");
  assertExactKeys(input.behaviorScoreChange, BEHAVIOR_KEYS, "behaviorScoreChange");
  assertEnum(input.behaviorScoreChange.direction, ["improved", "declined", "unchanged"], "behavior direction");
  assertEnum(input.behaviorScoreChange.magnitude, MAGNITUDES, "behavior magnitude");
  for (const limitation of input.limitations) assertEnum(limitation, LIMITATIONS, "limitation");
  const citationIds = input.citationIds.map((id, index) => {
    assertSafeIdentifier(id, `citationIds[${index}]`);
    return id;
  });
  if (new Set(citationIds).size !== citationIds.length) throw new Error("Duplicate citation ID");
  const allowedCorpus = approvedCorpus ?? new Set(citationIds);
  const retrievedContext = input.retrievedContext
    ? validateContext(input.retrievedContext, new Set(citationIds), allowedCorpus)
    : undefined;
  assertNoApplicantData({ evidence, anomalies, behaviorScoreChange: input.behaviorScoreChange, limitations: input.limitations, citationIds, retrievedContext }, "input");
  return {
    score: input.score,
    riskBand: input.riskBand,
    evidence,
    anomalies,
    behaviorScoreChange: input.behaviorScoreChange,
    limitations: [...input.limitations],
    citationIds,
    retrievedContext,
  };
}

function parseModelOutput(value: unknown, evidenceIds: ReadonlySet<string>, citationIds: ReadonlySet<string>): ModelOutput {
  if (!isRecord(value)) throw new Error("Invalid model output");
  assertExactKeys(value, ["reasons", "citationIds"], "model output");
  if (!Array.isArray(value.reasons) || !Array.isArray(value.citationIds)) throw new Error("Invalid model output arrays");
  const seenEvidence = new Set<string>();
  const reasons = value.reasons.map((reason, index) => {
    if (!isRecord(reason)) throw new Error(`Invalid model reason ${index}`);
    assertExactKeys(reason, ["evidenceId", "text"], `model reason ${index}`);
    assertSafeIdentifier(reason.evidenceId, `model reason ${index} evidenceId`);
    if (!evidenceIds.has(reason.evidenceId) || seenEvidence.has(reason.evidenceId)) {
      throw new Error(`Ungrounded or duplicate model reason ID: ${reason.evidenceId}`);
    }
    if (typeof reason.text !== "string" || reason.text.length === 0 || reason.text.length > MAX_INPUT_TEXT_LENGTH) {
      throw new Error(`Invalid model reason ${index} text`);
    }
    seenEvidence.add(reason.evidenceId);
    return { evidenceId: reason.evidenceId, text: reason.text };
  });
  const outputCitationIds = value.citationIds.map((id, index) => {
    assertSafeIdentifier(id, `model citationIds[${index}]`);
    if (!citationIds.has(id)) throw new Error(`Ungrounded model citation ID: ${id}`);
    return id;
  });
  if (new Set(outputCitationIds).size !== outputCitationIds.length) throw new Error("Duplicate model citation ID");
  return { reasons, citationIds: outputCitationIds };
}

function fallback(input: ExplanationInput, trace: ExplanationTrace, _reason: FallbackReason): ExplanationOutput {
  const reasons: ExplanationReason[] = input.evidence.map((item) => ({
    evidenceId: item.id,
    text: `${item.featureName.replaceAll("_", " ")} was a ${item.magnitude} ${item.direction} signal.`,
  }));
  reasons.push(
    ...input.anomalies.map((item) => ({
      evidenceId: item.id,
      text: `A ${item.severity} severity anomaly was considered.`,
    })),
  );
  return {
    score: input.score,
    riskBand: input.riskBand,
    reasons,
    citationIds: input.citationIds,
    trace: { ...trace, fallback: true, usedEvidenceIds: reasons.map((item) => item.evidenceId) },
  };
}

function modelRequest(input: ExplanationInput): string {
  return JSON.stringify({
    score: input.score,
    riskBand: input.riskBand,
    evidence: input.evidence,
    anomalies: input.anomalies,
    behaviorScoreChange: input.behaviorScoreChange,
    limitations: input.limitations,
    citationIds: input.citationIds,
    retrievedContext: input.retrievedContext ?? [],
  });
}

export function createExplanationAdapter(config: ExplanationAdapterConfig): ExplanationAdapter {
  const request = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = config.model ?? MODEL_NAME;

  return {
    async explain(rawInput) {
      const input = validateInput(rawInput, config.approvedCitationIds);
      const evidenceIds = new Set([...input.evidence.map((item) => item.id), ...input.anomalies.map((item) => item.id)]);
      const citationIds = new Set(input.citationIds);
      const startedAt = Date.now();
      const trace: ExplanationTrace = { model, latencyMs: 0, fallback: false, usedEvidenceIds: [] };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(`${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            stream: false,
            temperature: 0.1,
            max_tokens: MAX_TOKENS,
            messages: [
              {
                role: "system",
                content:
                  "Return only JSON with reasons and citationIds. Every reason evidenceId must reference supplied evidence or anomaly IDs. Never add or alter score, risk band, or evidence.",
              },
              { role: "user", content: modelRequest(input) },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Explanation service returned ${response.status}`);
        const responseBody: unknown = await response.json();
        if (!isRecord(responseBody) || !Array.isArray(responseBody.choices) || responseBody.choices.length !== 1) {
          throw new Error("Invalid explanation service response");
        }
        const choice = responseBody.choices[0];
        if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
          throw new Error("Invalid explanation service message");
        }
        const parsed = parseModelOutput(JSON.parse(choice.message.content), evidenceIds, citationIds);
        trace.latencyMs = Date.now() - startedAt;
        trace.usedEvidenceIds = parsed.reasons.map((item) => item.evidenceId);
        return { score: input.score, riskBand: input.riskBand, ...parsed, trace };
      } catch (error) {
        trace.latencyMs = Date.now() - startedAt;
        const fallbackReason: FallbackReason = controller.signal.aborted
          ? "timeout"
          : error instanceof Error && error.message.startsWith("Invalid")
            ? "invalid_model_output"
            : "request_failed";
        return fallback(input, trace, fallbackReason);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
