import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIDENCE_FLOOR,
  DEFAULT_ENTROPY_GATE,
  entropyBits,
  gatedChoice,
  JEV_MODEL,
  PriorityGate,
  stubAnswerer,
  type GatedChoiceOption,
  type GatedChoiceOptions,
  type GatedChoiceResult,
  type JevAnswer,
  type JevPriority,
  type JevQuestion,
  type PriorityGateOptions,
} from "../src/jev.ts";

describe("entropyBits and gatedChoice", () => {
  it("computes Shannon entropy in bits across uniform, peaked, and skewed distributions", () => {
    expect(DEFAULT_ENTROPY_GATE).toBe(1.0);
    expect(DEFAULT_CONFIDENCE_FLOOR).toBe(0.5);
    expect(entropyBits({ a: 1, b: 0, c: 0 })).toBeCloseTo(0, 6);
    expect(entropyBits({ a: 0.5, b: 0.5 })).toBeCloseTo(1, 6);
    expect(entropyBits({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 })).toBeCloseTo(2, 6);
  });

  it("returns confident when entropy is below threshold and top probability clears floor", () => {
    const q: JevQuestion = {
      type: "choice",
      instructions: "Platform?",
      criteria: { app: "Mobile app", web: "Web app", site: "Marketing site" },
    };
    const a: JevAnswer = {
      type: "choice",
      choice: "app",
      probabilities: { app: 0.85, web: 0.1, site: 0.05 },
    };
    const opts: GatedChoiceOptions = { maxEntropyBits: 1.0, minConfidence: 0.5 };
    const res: GatedChoiceResult = gatedChoice(q, a, opts);
    expect(res.status).toBe("confident");
    expect(res.value).toBe("app");
    expect(res.entropy).toBeLessThan(1.0);
    const first: GatedChoiceOption = res.options[0]!;
    expect(first).toEqual({ value: "app", p: 0.85 });
  });

  it("returns ask with top-3 candidates when entropy exceeds threshold, unless pinned or noAsk", () => {
    const q: JevQuestion = {
      type: "choice",
      instructions: "Platform?",
      criteria: { app: "Mobile", web: "Web", site: "Site", watch: "Watch" },
    };
    const a: JevAnswer = {
      type: "choice",
      choice: "app",
      probabilities: { app: 0.34, web: 0.31, site: 0.25, watch: 0.1 },
    };
    const asked = gatedChoice(q, a);
    expect(asked.status).toBe("ask");
    expect(asked.value).toBe("app");
    expect(asked.entropy).toBeGreaterThan(1.0);
    expect(asked.options).toHaveLength(3);
    expect(asked.options.map((o) => o.value)).toEqual(["app", "web", "site"]);

    const silenced = gatedChoice(q, a, { noAsk: true });
    expect(silenced.status).toBe("confident");
    expect(silenced.value).toBe("app");

    const pinned = gatedChoice(q, a, { pinned: "web" });
    expect(pinned.status).toBe("pinned");
    expect(pinned.value).toBe("web");
    expect(pinned.p).toBeCloseTo(0.31, 5);
  });
});

describe("PriorityGate", () => {
  it("serves queued high-priority calls ahead of queued normal-priority calls", async () => {
    const gateOpts: PriorityGateOptions = { maxConcurrent: 1, maxRetries: 1, baseDelayMs: 1 };
    const gate = new PriorityGate(gateOpts);
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const p1 = gate.run("normal", async () => {
      order.push("normal-1-start");
      await firstBlocked;
      order.push("normal-1-end");
      return "n1";
    });
    const p2 = gate.run("normal", async () => {
      order.push("normal-2");
      return "n2";
    });
    const highLane: JevPriority = "high";
    const p3 = gate.run(highLane, async () => {
      order.push("high-1");
      return "h1";
    });

    releaseFirst();
    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual(["n1", "n2", "h1"]);
    expect(order).toEqual(["normal-1-start", "normal-1-end", "high-1", "normal-2"]);
  });

  it("retries transient 429/529 errors and wraps an Answerer via asAnswerer", async () => {
    const gate = new PriorityGate({ maxConcurrent: 2, maxRetries: 2, baseDelayMs: 1 });
    let attempts = 0;
    const out = await gate.run("high", async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("Jev returned 429: rate limit exceeded");
      return "ok";
    });
    expect(out).toBe("ok");
    expect(attempts).toBe(2);

    const wrapped = gate.asAnswerer(stubAnswerer(7), "high");
    const ans = await wrapped.answer({
      model: JEV_MODEL,
      state: { request: "test" },
      questions: {
        platform: {
          type: "choice",
          instructions: "Platform?",
          criteria: { app: "Mobile", web: "Web" },
        },
      },
    });
    expect(ans.by).toBe("stub (seed 7)");
    expect(Object.keys(ans.response.answers.platform?.type === "choice" ? ans.response.answers.platform.probabilities : {})).toEqual(["app", "web"]);
  });
});
