import { describe, expect, it, vi } from "vitest";
import {
  createExplanationAdapter,
  type ExplanationInput,
} from "../src/index.js";

const input: ExplanationInput = {
  score: 72,
  riskBand: "moderate",
  evidence: [
    {
      id: "income-stability",
      featureName: "income_stability",
      direction: "positive",
      magnitude: "high",
    },
    {
      id: "repayment-pattern",
      featureName: "repayment_pattern",
      direction: "negative",
      magnitude: "low",
    },
  ],
  anomalies: [{ id: "cashflow-gap", severity: "medium" }],
  behaviorScoreChange: { direction: "improved", magnitude: "low" },
  limitations: ["limited_history"],
  citationIds: ["policy-17"],
  retrievedContext: [
    {
      citationId: "policy-17",
      title: "Repayment consistency policy",
      text: "Recent repayment consistency is considered a positive signal.",
      sourceUrl: "https://policy.example.test/repayment",
    },
  ],
};

const modelResponse = (body: unknown): Response =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(body) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const validModelOutput = {
  reasons: [
    {
      evidenceId: "income-stability",
      text: "Stable income contributed positively to the result.",
    },
  ],
  citationIds: ["policy-17"],
};

describe("explanation adapter", () => {
  it("copies score and risk band from the engine input", async () => {
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      fetch: vi.fn().mockResolvedValue(
        modelResponse(validModelOutput),
      ),
    });

    const result = await adapter.explain(input);

    expect(result.score).toBe(input.score);
    expect(result.riskBand).toBe(input.riskBand);
    expect(result.reasons).toEqual(validModelOutput.reasons);
  });

  it.each(["strong", "moderate", "watch", "high_attention"] as const)(
    "accepts the deterministic engine risk band %s",
    async (riskBand) => {
      const adapter = createExplanationAdapter({
        baseUrl: "https://lfm.internal",
        fetch: vi.fn().mockResolvedValue(modelResponse(validModelOutput)),
      });

      await expect(adapter.explain({ ...input, riskBand })).resolves.toMatchObject({
        riskBand,
      });
    },
  );

  it("rejects applicant data and unknown input keys before calling the model", async () => {
    const fetch = vi.fn();
    const adapter = createExplanationAdapter({ baseUrl: "https://lfm.internal", fetch });

    await expect(
      adapter.explain({ ...input, name: "Ada Lovelace" } as ExplanationInput),
    ).rejects.toThrow(/redacted|unknown|applicant/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects retrieved context outside the approved corpus", async () => {
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      approvedCitationIds: new Set(["policy-18"]),
      fetch: vi.fn(),
    });

    await expect(adapter.explain(input)).rejects.toThrow(/approved corpus/i);
  });

  it("rejects model reasons with unknown, duplicate, or ungrounded IDs", async () => {
    for (const reasons of [
      [{ evidenceId: "invented", text: "Invented." }],
      [
        { evidenceId: "income-stability", text: "First." },
        { evidenceId: "income-stability", text: "Duplicate." },
      ],
      [{ evidenceId: "policy-17", text: "Citation is not evidence." }],
    ]) {
      const adapter = createExplanationAdapter({
        baseUrl: "https://lfm.internal",
        fetch: vi.fn().mockResolvedValue(modelResponse({ reasons, citationIds: [] })),
      });

      const result = await adapter.explain({ ...input, citationIds: [], retrievedContext: undefined });
      expect(result.trace.fallback).toBe(true);
      expect(result.reasons.every((reason) => reason.evidenceId !== "invented")).toBe(true);
    }
  });

  it("grounds model citations to supplied RAG citation IDs", async () => {
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      fetch: vi.fn().mockResolvedValue(
        modelResponse({ ...validModelOutput, citationIds: ["invented-policy"] }),
      ),
    });

    const result = await adapter.explain(input);

    expect(result.trace.fallback).toBe(true);
    expect(result.citationIds).toEqual(input.citationIds);
  });

  it("records only used evidence IDs in trace metadata", async () => {
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      fetch: vi.fn().mockResolvedValue(modelResponse(validModelOutput)),
    });

    const result = await adapter.explain(input);

    expect(result.trace.usedEvidenceIds).toEqual(["income-stability"]);
    expect(result.trace.model).toBe("lfm2.5-1.2b");
    expect(result.trace.fallback).toBe(false);
  });

  it("uses a deterministic fallback when the service times out", async () => {
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      timeoutMs: 1,
      fetch: vi.fn().mockImplementation((_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")));
        }),
      ),
    });

    const first = await adapter.explain(input);
    const second = await adapter.explain(input);

    expect(first.trace.fallback).toBe(true);
    expect(first.reasons).toEqual(second.reasons);
    expect(first.score).toBe(input.score);
    expect(first.riskBand).toBe(input.riskBand);
  });

  it("rejects malformed model output and does not log prompts or output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal",
      fetch: vi.fn().mockResolvedValue(
        modelResponse({ ...validModelOutput, score: 1, reasons: "not-an-array" }),
      ),
    });

    const result = await adapter.explain(input);

    expect(result.trace.fallback).toBe(true);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("sends the OpenAI-compatible non-streaming request shape", async () => {
    const fetch = vi.fn().mockResolvedValue(modelResponse(validModelOutput));
    const adapter = createExplanationAdapter({
      baseUrl: "https://lfm.internal/",
      apiKey: "secret",
      fetch,
    });

    await adapter.explain(input);

    expect(fetch).toHaveBeenCalledWith(
      "https://lfm.internal/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
        body: expect.any(String),
      }),
    );
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.stream).toBe(false);
    expect(request.temperature).toBeLessThanOrEqual(0.2);
    expect(request.max_tokens).toBeLessThanOrEqual(256);
    expect(request.messages.map((message: { role: string }) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(request.messages[1].content).not.toContain("Ada Lovelace");
  });
});
