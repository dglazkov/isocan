import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { JevQuestion, JevRequest } from "../src/jev.ts";
import { decisionToAnswer, jevToChoice, jevToDecision, localAnswered, localModel, LOCAL_MODELS, modelUrl, stateText, type LocalModel } from "../src/local-judge.ts";
import { fetchModel, fetchModelFile, listModels, modelPath, modelsDir } from "../src/modelstore.ts";

const pick: Extract<JevQuestion, { type: "choice" }> = {
  type: "choice",
  instructions: "Which act does the person want?",
  criteria: { rename: "Give the item a new title", move: "Put the item somewhere else", note: null },
};

describe("a Jev question in MediaPipe's words", () => {
  it("maps a choice to a ChoiceQuestion with the same keys, a null description becoming its key", () => {
    expect(jevToChoice(pick)).toEqual({
      instructions: "Which act does the person want?",
      criteria: { rename: "Give the item a new title", move: "Put the item somewhere else", note: "note" },
    });
    expect(jevToChoice(pick, { normalizePrior: true }).normalizePrior).toBe(true);
    expect("normalizePrior" in jevToChoice(pick)).toBe(false);
  });

  it("refuses a choice with nothing to choose between, in words", () => {
    expect(() => jevToChoice({ type: "choice", instructions: "x", criteria: { only: null } })).toThrow(/at least two options/);
  });

  it("maps a noul to a boolean (with its own false/true descriptions) and a score to a rubric", () => {
    expect(jevToDecision({ type: "noul", instructions: "The note is a question." })).toEqual({ kind: "boolean", question: { condition: "The note is a question." } });
    expect(jevToDecision({ type: "noul", instructions: "c", criteria: { true: "yes it is", false: "no it is not" } })).toEqual({
      kind: "boolean",
      question: { condition: "c", options: [{ label: "false", description: "no it is not" }, { label: "true", description: "yes it is" }] },
    });
    expect(jevToDecision({ type: "score", instructions: "How urgent?", criteria: ["low", "mid", "high"] })).toEqual({ kind: "score", question: { instructions: "How urgent?", rubric: ["low", "mid", "high"] } });
  });

  it("says a state as text: a string is itself, anything else its JSON", () => {
    expect(stateText("Acme note: ship it")).toBe("Acme note: ship it");
    expect(stateText({ title: "Test", n: 2 })).toBe('{"title":"Test","n":2}');
  });
});

describe("MediaPipe's answers in Jev's shape", () => {
  it("keeps a choice's whole distribution and its confidence apart", () => {
    const a = decisionToAnswer(pick, { kind: "choice", result: { selectedKey: "move", probabilities: { rename: 0.1, move: 0.85, note: 0.05 }, confidence: 0.7 } });
    expect(a).toEqual({ type: "choice", choice: "move", probabilities: { rename: 0.1, move: 0.85, note: 0.05 }, confidence: 0.7 });
  });

  it("keys a score by level index with the expected score beside it, and a noul is P(true)", () => {
    const score: JevQuestion = { type: "score", instructions: "s", criteria: ["low", "high"] };
    expect(decisionToAnswer(score, { kind: "score", result: { expectedScore: 0.75, probabilities: [0.25, 0.75], confidence: 0.4 } })).toEqual({
      type: "score", score: 0.75, probabilities: { "0": 0.25, "1": 0.75 }, confidence: 0.4,
    });
    expect(decisionToAnswer({ type: "noul", instructions: "n" }, { kind: "boolean", result: { value: true, probabilityTrue: 0.9, confidence: 0.8 } })).toEqual({ type: "noul", noul: 0.9 });
  });

  it("clamps a probability a hair outside 0–1 back in, so readResponse's bound holds", () => {
    const a = decisionToAnswer(pick, { kind: "choice", result: { selectedKey: "move", probabilities: { rename: -1e-9, move: 1.0000001, note: 0 }, confidence: 1.2 } });
    expect(a).toMatchObject({ probabilities: { rename: 0, move: 1, note: 0 }, confidence: 1 });
  });

  it("refuses a result of the wrong kind rather than inventing an answer", () => {
    expect(() => decisionToAnswer(pick, { kind: "boolean", result: { value: true, probabilityTrue: 1, confidence: 1 } })).toThrow(/choice question came back as a boolean/);
  });

  it("answers a whole request as Answered, checked by readResponse", () => {
    const request: JevRequest = { model: "local", state: "Acme board", questions: { act: pick, urgent: { type: "noul", instructions: "It is urgent." } } };
    const answered = localAnswered(
      request,
      {
        act: { kind: "choice", result: { selectedKey: "rename", probabilities: { rename: 0.6, move: 0.3, note: 0.1 }, confidence: 0.5 } },
        urgent: { kind: "boolean", result: { value: false, probabilityTrue: 0.2, confidence: 0.6 } },
      },
      { ms: 12, by: "embeddinggemma-2-text-270m (gpu)", inputTokens: 40 },
    );
    expect(answered).toEqual({
      ms: 12,
      by: "embeddinggemma-2-text-270m (gpu)",
      response: {
        model: "embeddinggemma-2-text-270m (gpu)",
        answers: { act: { type: "choice", choice: "rename", probabilities: { rename: 0.6, move: 0.3, note: 0.1 }, confidence: 0.5 }, urgent: { type: "noul", noul: 0.2 } },
        usage: { input_tokens: 40, output_tokens: 0 },
      },
    });
  });

  it("refuses a request with a question left unanswered, and a choice outside its options", () => {
    const request: JevRequest = { model: "local", state: "s", questions: { act: pick } };
    expect(() => localAnswered(request, {}, { ms: 1, by: "local" })).toThrow(/nothing for question "act"/);
    expect(() =>
      localAnswered(request, { act: { kind: "choice", result: { selectedKey: "delete", probabilities: { rename: 1 }, confidence: 1 } } }, { ms: 1, by: "local" }),
    ).toThrow(/choice "delete" is not one of/);
  });
});

describe("the manifest", () => {
  it("pins the one model by bytes and SHA-256, and serves it by name only", () => {
    const m = localModel("embeddinggemma-2-text-270m")!;
    expect(m).toMatchObject({ bytes: 164_626_432, sha256: "2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb", file: "embeddinggemma-2-text-270m.litertlm" });
    expect(m.url).toMatch(/^https:\/\/huggingface\.co\/litert-community\//);
    expect(localModel("../keys.json")).toBeUndefined();
    expect(modelUrl(m.name)).toBe("/models/embeddinggemma-2-text-270m");
    for (const x of LOCAL_MODELS) expect(x.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the model store", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
  });
  const home = async () => {
    const d = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-models-"));
    dirs.push(d);
    return d;
  };
  const bytes = new TextEncoder().encode("Acme synthetic model bytes, not a model");
  const synthetic: LocalModel = {
    name: "acme-test", file: "acme-test.litertlm", url: "https://models.invalid/acme-test.litertlm", bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"), about: "test", licence: "test",
  };
  const serving = (body: Uint8Array, status = 200) => (async () => new Response(body.slice(), { status })) as unknown as typeof fetch;

  it("writes a verified download into <home>/models/ and leaves no partial", async () => {
    const h = await home();
    const seen: number[] = [];
    const got = await fetchModelFile(h, synthetic, { fetch: serving(bytes), onProgress: (n) => seen.push(n) });
    expect(got).toMatchObject({ path: modelPath(h, synthetic), bytes: bytes.byteLength, sha256: synthetic.sha256, downloaded: true });
    expect(await fs.readdir(modelsDir(h))).toEqual(["acme-test.litertlm"]);
    expect(seen.at(-1)).toBe(bytes.byteLength);
    // A second fetch verifies what is there and downloads nothing.
    const again = await fetchModelFile(h, synthetic, { fetch: (() => { throw new Error("must not fetch"); }) as unknown as typeof fetch });
    expect(again.downloaded).toBe(false);
  });

  it("refuses a hash mismatch in words that give both hashes, and deletes the partial", async () => {
    const h = await home();
    const wrong = new TextEncoder().encode("Acme synthetic model bytes, not a modeX");
    await expect(fetchModelFile(h, synthetic, { fetch: serving(wrong) })).rejects.toThrow(new RegExp(`not the pinned file.*expected ${bytes.byteLength} bytes with sha256 ${synthetic.sha256}.*partial file deleted`));
    expect(await fs.readdir(modelsDir(h))).toEqual([]);
  });

  it("refuses a download longer than pinned before it is all written, and a non-200", async () => {
    const h = await home();
    await expect(fetchModelFile(h, synthetic, { fetch: serving(new Uint8Array(bytes.byteLength + 10)) })).rejects.toThrow(/longer than the pinned/);
    await expect(fetchModelFile(h, synthetic, { fetch: serving(new Uint8Array(0), 404) })).rejects.toThrow(/answered 404/);
    expect(await fs.readdir(modelsDir(h))).toEqual([]);
  });

  it("refuses to overwrite a file already there that is not the pinned one", async () => {
    const h = await home();
    await fs.mkdir(modelsDir(h), { recursive: true });
    await fs.writeFile(modelPath(h, synthetic), "Acme");
    await expect(fetchModelFile(h, synthetic, { fetch: serving(bytes) })).rejects.toThrow(/already there but is not the pinned file.*remove it/);
  });

  it("refuses a name the manifest does not know, naming the ones it does", async () => {
    await expect(fetchModel(await home(), "acme-unknown")).rejects.toThrow(/no model called "acme-unknown" — the models isocan knows are embeddinggemma-2-text-270m/);
  });

  it("lists the manifest with what this home has", async () => {
    const rows = await listModels(await home());
    expect(rows).toEqual([expect.objectContaining({ name: "embeddinggemma-2-text-270m", present: false, bytes: 0, expected: 164_626_432 })]);
  });
});
