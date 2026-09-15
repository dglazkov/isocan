import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assessAttempt, controlsForTask, summarizeEvaluation, writeBlindReview } from "../scripts/lib/design-lint-eval-score.mjs";
import { assessStoredHtml } from "../scripts/lib/design-lint-eval-browser.mjs";
import { auditScreen } from "../packages/core/src/designaudit.ts";
import { parseDesign } from "../packages/core/src/designmd.ts";

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const fixture = (id = "button-treatment") => {
  const dir = path.resolve("test/fixtures/design-lint-eval", id);
  return { ...JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8")), initialHtml: readFileSync(path.join(dir, "initial.html"), "utf8"), repairedHtml: readFileSync(path.join(dir, "repaired.html"), "utf8"), tokens: parseDesign(readFileSync(path.join(dir, "DESIGN.md"), "utf8")).tokens };
};
// Unit bookkeeping inputs are explicitly synthetic envelopes around the real parser;
// actual receipt, browser and interaction proof belongs to the runnable dry evaluation.
const scoreInput = (task = fixture()) => {
  const audit = (html: string) => ({ status: "audited", canvasId: "synthetic-canvas", itemId: "synthetic-item", governing: { itemId: "synthetic-policy", versionId: "fixed" }, input: { kind: "stored", sha256: sha(html) }, ...auditScreen(html, task.tokens) });
  return { task, beforeHtml: task.initialHtml, html: task.repairedHtml, audit: audit(task.repairedHtml), baselineAudit: audit(task.initialHtml), protectedUnchanged: true, receiptStatus: task.expected.unchangedControl ? "unchanged" : "accepted", browserEvidence: { available: true, complete: true, passed: true, inputHash: sha(task.repairedHtml), viewports: task.viewports.map(viewport => ({ viewport, interaction: { passed: true } })) } };
};

function reviewCase() {
  const outputDir = mkdtempSync(path.join(tmpdir(), "isocan-eval-review-test-")); scratch.push(outputDir);
  // Copying/hashing is independent of image decoding; these bytes are labelled test data.
  const image = path.join(outputDir, "synthetic-image.png"); writeFileSync(image, "synthetic image bytes for bookkeeping tests");
  const runs = Array.from({ length: 6 }, (_, index) => `task-${index}`).flatMap(taskId => [1, 2, 3].flatMap(repetition => ["rules-only", "diagnostics"].map(condition => ({ runId: `${taskId}-${repetition}-${condition}`, taskId, taskText: "Acme preserve the visible action", condition, repetition, htmlHash: sha(`${taskId}-${condition}`), screenshots: [{ width: 390, height: 844, path: image }, { width: 1280, height: 900, path: image }], initialScreenshots: [{ width: 390, height: 844, path: image }, { width: 1280, height: 900, path: image }] }))));
  const review = writeBlindReview({ runs, outputDir, seed: "unit-test-seed" });
  const armKey = JSON.parse(readFileSync(review.armKeyPath, "utf8"));
  const ratings = JSON.parse(readFileSync(review.jsonPath, "utf8"));
  const records = runs.map(run => ({ ...run, complete: true, rounds: 2, apiEquivalentCost: 0.1, interactionFailures: 0, newUnexamined: 0, protectedUnchanged: true, concurrentSafe: true, initialReady: true }));
  return { outputDir, review, armKey, ratings, records, runs };
}
const rateAll = ratings => { for (const pair of ratings.pairs) { pair.A.intent = "preserved"; pair.B.intent = "preserved"; pair.preference = "tie"; } return ratings; };

describe("stored-byte scorer bookkeeping", () => {
  it("accepts legitimate recipe edits even when application source ranges move", () => {
    const input = scoreInput();
    expect(input.audit.policy.appliedTreatments).not.toEqual(input.baselineAudit.policy.appliedTreatments);
    expect(assessAttempt(input)).toMatchObject({ complete: true, initialReady: true, human: { intent: null, preference: null } });
  });
  it.each(["refused", "pending", "saved", undefined])("cannot complete without the verified receipt status %s", receiptStatus => { expect(assessAttempt({ ...scoreInput(), receiptStatus }).complete).toBe(false); });
  it("binds browser and actual audit hashes separately to stored bytes", () => {
    const input = scoreInput();
    expect(assessAttempt({ ...input, html: `${input.html}\n` }).violations).toContain("stored-audit-bytes");
    expect(assessAttempt({ ...input, browserEvidence: { ...input.browserEvidence, inputHash: "wrong" } }).violations).toContain("stored-browser-bytes");
    expect(assessAttempt({ ...input, audit: { ...input.audit, input: { ...input.audit.input, kind: "draft" } } }).complete).toBe(false);
  });
  it("retains independent policy and browser gates despite zero findings", () => {
    const input = scoreInput();
    expect(input.audit.diagnostics).toHaveLength(0);
    expect(assessAttempt({ ...input, protectedUnchanged: false }).complete).toBe(false);
    expect(assessAttempt({ ...input, browserEvidence: { ...input.browserEvidence, available: false } }).complete).toBe(false);
    expect(assessAttempt({ ...input, audit: { ...input.audit, policy: { ...input.audit.policy, original: {} } } }).complete).toBe(false);
  });
  it("requires exact unchanged clean bytes and no new version", () => {
    const input = scoreInput(fixture("clean-control"));
    expect(assessAttempt(input).complete).toBe(true);
    expect(assessAttempt({ ...input, receiptStatus: "accepted" }).violations).toContain("unnecessary-clean-edit");
    expect(assessAttempt({ ...input, html: `${input.html}\n` }).violations).toContain("unnecessary-clean-edit");
  });
  it("rejects a real newly uncovered script path independently of visible rendering", () => {
    const input = scoreInput(), control = controlsForTask(input.task).find(row => row.id === "new-uncovered");
    const audit = { ...input.audit, ...auditScreen(control.html, input.task.tokens), input: { kind: "stored", sha256: sha(control.html) } };
    const result = assessAttempt({ ...input, html: control.html, audit, browserEvidence: { ...input.browserEvidence, inputHash: sha(control.html) } });
    expect(result.complete).toBe(false); expect(result.coverage.newUnexamined).toBeGreaterThan(0); expect(result.render.passed).toBe(true);
  });
  it("returns unavailable evidence when Chrome cannot exist", async () => {
    const previous = process.env.CHROME_PATH; process.env.CHROME_PATH = "/nonexistent/acme-chrome";
    try { expect(await assessStoredHtml({ task: fixture(), html: "Acme", outputDir: "/tmp/unused-eval-render" })).toMatchObject({ available: false, passed: false, complete: false, screenshots: [] }); }
    finally { if (previous === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = previous; }
  });
});

describe("blind review and preregistered aggregation", () => {
  it("copies condition-hidden images, keeps ratings pending and refuses to rewrite the key", () => {
    const { review, runs, outputDir, ratings } = reviewCase();
    const html = readFileSync(review.htmlPath, "utf8");
    expect(review.pairs).toBe(18); expect(html).not.toContain("rules-only"); expect(html).not.toContain("diagnostics");
    expect(html).toContain("<option>preserved</option>"); expect(html).toContain("Initial reference");
    expect(ratings.pairs.every(pair => pair.A.intent === null && pair.B.intent === null && pair.preference === null)).toBe(true);
    expect(() => writeBlindReview({ runs, outputDir, seed: "different" })).toThrow(/immutable/);
  });
  it("cannot infer lift from canned differences even with complete synthetic ratings", () => {
    const input = reviewCase(); rateAll(input.ratings);
    for (const row of input.records) if (row.condition === "rules-only") row.complete = false;
    expect(summarizeEvaluation({ ...input, mode: "dry-run" })).toMatchObject({ verdict: "instrumentation-only", modelLift: null });
  });
  it("leaves missing costs, coverage or pending human ratings inconclusive", () => {
    const input = reviewCase();
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("inconclusive"); rateAll(input.ratings);
    input.records[0].apiEquivalentCost = null;
    expect(summarizeEvaluation({ ...input, mode: "model" })).toMatchObject({ verdict: "inconclusive", metrics: { diagnostics: { medianApiEquivalentCost: null } } });
    input.records[0].apiEquivalentCost = 0.1; input.records[0].newUnexamined = null;
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("inconclusive");
  });
  it("rejects stale, missing, duplicate and candidate-mismatched ratings", () => {
    const input = reviewCase(); rateAll(input.ratings);
    const stale = { ...input.ratings, evaluationId: "foreign" };
    expect(() => summarizeEvaluation({ ...input, ratings: stale, mode: "model" })).toThrow(/different/);
    expect(() => summarizeEvaluation({ ...input, ratings: { ...input.ratings, pairs: input.ratings.pairs.slice(1) }, mode: "model" })).toThrow(/18/);
    const duplicate = structuredClone(input.ratings); duplicate.pairs[0] = duplicate.pairs[1];
    expect(() => summarizeEvaluation({ ...input, ratings: duplicate, mode: "model" })).toThrow(/Duplicate/);
    input.records[0].htmlHash = "other stored bytes";
    expect(() => summarizeEvaluation({ ...input, mode: "model" })).toThrow(/candidates/);
  });
  it("recognizes a ceiling, the two-completion threshold and the 20 percent median-round threshold", () => {
    const input = reviewCase(); rateAll(input.ratings);
    for (const row of input.records) row.rounds = 1;
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("ceiling-effect");
    for (const row of input.records) row.rounds = 2;
    input.records.filter(row => row.condition === "rules-only").slice(0, 2).forEach(row => { row.complete = false; });
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("proceed-to-larger-trial");
    for (const row of input.records) { row.complete = true; if (row.condition === "diagnostics") row.rounds = 1; }
    expect(summarizeEvaluation({ ...input, mode: "model" })).toMatchObject({ verdict: "proceed-to-larger-trial", comparison: { roundsReduction: 0.5 } });
  });
  it("requires the stated 20 percent cost reduction and rejects added uncovered styling", () => {
    const input = reviewCase(); rateAll(input.ratings);
    for (const row of input.records) row.apiEquivalentCost = row.condition === "diagnostics" ? 0.081 : 0.1;
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("do-not-proceed");
    for (const row of input.records) if (row.condition === "diagnostics") row.apiEquivalentCost = 0.08;
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("proceed-to-larger-trial");
    input.records.find(row => row.condition === "diagnostics").newUnexamined = 1;
    expect(summarizeEvaluation({ ...input, mode: "model" }).verdict).toBe("do-not-proceed");
  });
  it("counts intent loss against the hidden key and prevents a favorable objective from bypassing it", () => {
    const input = reviewCase(); rateAll(input.ratings);
    for (const row of input.records) if (row.condition === "diagnostics") row.rounds = 1;
    const key = input.armKey.pairs[0], label = key.A.condition === "diagnostics" ? "A" : "B";
    input.ratings.pairs[0][label].intent = "lost";
    expect(summarizeEvaluation({ ...input, mode: "model" })).toMatchObject({ verdict: "do-not-proceed", human: { intentLost: { diagnostics: 1, "rules-only": 0 } } });
  });
});
