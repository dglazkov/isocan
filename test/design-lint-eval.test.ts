import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseEvalArgs } from "../scripts/design-lint-eval.mjs";
import { buildPrompt, cannedCandidate, CostLedger, inspectProviderOutput, invokeModel, MODEL_SPEC, modelInvocation, outputCapture, parseCandidate } from "../scripts/lib/design-lint-eval-model.mjs";
import { applyCandidate, candidateScope, checkInitial, createEvalHost, loadEvalTasks, normalizedRecords, requestCandidate, scheduleRuns, selectCandidateProvider, staleWriteControl } from "../scripts/lib/design-lint-eval-runner.mjs";

const scratch: string[] = [];
afterEach(async () => { for (const dir of scratch.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const providerReport = (changes = {}) => ({ type: "result", subtype: "success", is_error: false, result: JSON.stringify({ html: "<p>Acme 🧭</p>" }), num_turns: 1, duration_ms: 12, total_cost_usd: 0.01, usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, modelUsage: { "claude-sonnet-5": {} }, ...changes });

describe("frozen model and correction budgets", () => {
  it("requires explicit dry or model mode and a cap before any runtime work", () => {
    expect(() => parseEvalArgs([])).toThrow();
    expect(() => parseEvalArgs(["--model", "sonnet", "--out", "/tmp/acme", "--budget-usd", "10"])).toThrow();
    expect(() => parseEvalArgs(["--dry-run", "--model", MODEL_SPEC.model, "--out", "/tmp/acme"])).toThrow();
    expect(() => parseEvalArgs(["--model", MODEL_SPEC.model, "--out", "/tmp/acme"])).toThrow();
    expect(parseEvalArgs(["--dry-run", "--out", "/tmp/acme"]).mode).toBe("dry-run");
    expect(parseEvalArgs(["--model", MODEL_SPEC.model, "--out", "/tmp/acme", "--budget-usd", "10"]).mode).toBe("model");
  });
  it("generates reproducible randomized arms and exactly 3 repeats per task/arm", () => {
    const ids = ["a", "b", "c", "d", "e", "f"], runs = scheduleRuns(ids, "Acme");
    expect(runs).toHaveLength(36); expect(scheduleRuns(ids, "Acme")).toEqual(runs); expect(scheduleRuns(ids, "Other")).not.toEqual(runs);
    for (const id of ids) for (const condition of ["rules-only", "diagnostics"]) expect(runs.filter(run => run.taskId === id && run.condition === condition).map(run => run.repetition).sort()).toEqual([1, 2, 3]);
  });
  it("only treatment adds actual findings and neither prompt leaks fixture goldens", () => {
    const task = { instruction: "Keep Acme visible", design: "Actual rules", html: "Actual HTML", condition: "rules-only", audit: { diagnostics: [{ code: "actual-finding" }], coverage: { complete: false } }, expected: "SECRET EXPECTED", repairedHtml: "SECRET GOLDEN" };
    const control = buildPrompt(task), treatment = buildPrompt({ ...task, condition: "diagnostics" });
    expect(treatment.startsWith(control)).toBe(true); expect(control).not.toContain("actual-finding"); expect(treatment).toContain("actual-finding");
    expect(control + treatment).not.toContain("SECRET");
  });
  it("unused allowance never enlarges a later per-call cap and at most 72 calls start", () => {
    const ledger = new CostLedger(10), first = ledger.begin(); expect(first).toBeLessThanOrEqual(10 / 72);
    ledger.finish(0, first);
    for (let i = 1; i < 72; i++) { const allowance = ledger.begin(); expect(allowance).toBe(first); ledger.finish(0, allowance); }
    expect(() => ledger.begin()).toThrow();
  });
  it.each([null, undefined, NaN, -1])("missing/invalid cost %s closes the entire comparison", cost => {
    const ledger = new CostLedger(10), allowance = ledger.begin(); ledger.finish(cost, allowance);
    expect(ledger.snapshot().reportedApiEquivalent).toBeNull(); expect(() => ledger.begin()).toThrow();
  });
  it("records over-budget reported cost before stopping", () => {
    const ledger = new CostLedger(10), allowance = ledger.begin(); ledger.finish(allowance + 0.01, allowance);
    expect(ledger.snapshot().knownReportedSubtotal).toBe(allowance + 0.01); expect(() => ledger.begin()).toThrow(/exceeded/);
  });
  it("durably records the pending call before a synthetic provider can start", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "isocan-eval-accounting-test-")); scratch.push(dir);
    const file = path.join(dir, "report.json"), ledger = new CostLedger(10), attempt = {};
    const save = () => writeFile(file, JSON.stringify({ ledger: ledger.snapshot(), attempt }));
    const provider = vi.fn(async () => {
      const recorded = JSON.parse(await readFile(file, "utf8"));
      expect(recorded.ledger).toMatchObject({ calls: 1, pending: true });
      expect(recorded.attempt.allowance).toBeLessThanOrEqual(10 / 72);
      return { candidateText: "invalid output consumes this attempt", apiEquivalentCost: 0.01, stopReason: null };
    });
    await requestCandidate({ provider, ledger, attempt, save, providerArgs: {} });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(file, "utf8")).ledger).toMatchObject({ calls: 1, pending: false, reportedApiEquivalent: 0.01 });
  });
  it("dry mode cannot reach the injected model provider, and exercises a real second-round schedule", async () => {
    const model = vi.fn(() => { throw new Error("A model was invoked"); });
    const provider = selectCandidateProvider("dry-run", { dry: cannedCandidate, model });
    const task = { id: "card-spacing", initialHtml: "initial", repairedHtml: "repaired" };
    expect(parseCandidate((await provider({ task, round: 1 })).candidateText)).toBe("initial");
    expect(parseCandidate((await provider({ task, round: 2 })).candidateText)).toBe("repaired");
    expect(model).not.toHaveBeenCalled();
    await expect(invokeModel({ approvedModelMode: false })).rejects.toThrow(/explicit/);
  });
  it("freezes tools, output, effort, turn and retry controls while excluding ambient routing/settings", () => {
    const invocation = modelInvocation(0.1, { PATH: "/usr/bin", HOME: "/tmp/acme", ANTHROPIC_BASE_URL: "https://secret.invalid", ANTHROPIC_API_KEY: "secret", CLAUDE_CODE_EFFORT_LEVEL: "low", CLAUDE_CODE_RETRY_WATCHDOG: "1" });
    expect(invocation.args).toContain("--safe-mode"); expect(invocation.args[invocation.args.indexOf("--tools") + 1]).toBe(""); expect(invocation.args[invocation.args.indexOf("--max-turns") + 1]).toBe("1");
    expect(invocation.env.CLAUDE_CODE_MAX_RETRIES).toBe("0"); expect(invocation.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("8192"); expect(invocation.env.CLAUDE_CODE_EFFORT_LEVEL).toBe("high");
    expect(invocation.env.ANTHROPIC_API_KEY).toBeUndefined(); expect(invocation.env.ANTHROPIC_BASE_URL).toBeUndefined(); expect(invocation.env.CLAUDE_CODE_RETRY_WATCHDOG).toBeUndefined();
  });
});

describe("provider evidence is strict and redacted", () => {
  it.each(['```json\n{"html":"Acme"}\n```', '{"html":"Acme","html":"Other"}', '{"html":"Acme","DESIGN.md":"weakened"}', '{"html":null}', 'no'])("rejects invalid candidate %s without a repair retry", candidate => { expect(() => parseCandidate(candidate)).toThrow(); });
  it("records attempted policy edits separately from HTML-only variable edits", () => {
    expect(candidateScope('{"html":"Acme","tokens":{}}').attemptedPolicyEdit).toBe(true);
    expect(candidateScope('{"html":"<style>:root{--color-ink:red}</style>"}').attemptedPolicyEdit).toBe(false);
    expect(candidateScope("not JSON").attemptedPolicyEdit).toBeNull();
  });
  it("keeps split UTF-8 output bytes and candidate characters exact", () => {
    const bytes = Buffer.from(JSON.stringify(providerReport())), at = bytes.indexOf(Buffer.from("🧭"));
    const capture = outputCapture(); capture.append(bytes.subarray(0, at + 1)); capture.append(bytes.subarray(at + 1, at + 3)); capture.append(bytes.subarray(at + 3));
    const evidence = inspectProviderOutput({ stdout: capture.bytes(), exitCode: 0, elapsedMs: 13 });
    expect(evidence.stopReason).toBeNull(); expect(parseCandidate(evidence.candidateText)).toBe("<p>Acme 🧭</p>"); expect(evidence.stdoutSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });
  it.each([{ total_cost_usd: undefined }, { modelUsage: { "claude-other": {} } }, { is_error: true }, { usage: { input_tokens: 10 } }, { num_turns: 2 }])("stops on unavailable/refused/mismatched metadata %j", changes => {
    expect(inspectProviderOutput({ stdout: JSON.stringify(providerReport(changes)), exitCode: 0, elapsedMs: 10 }).stopReason).not.toBeNull();
  });
  it("does not turn a timeout with partial output into free work", () => {
    const evidence = inspectProviderOutput({ stdout: '{"type":"result"', exitCode: null, signal: "SIGKILL", elapsedMs: 180_000 });
    expect(evidence.apiEquivalentCost).toBeNull(); expect(evidence.stopReason).not.toBeNull();
  });
  it("keeps missing protected-history evidence unknown in incomplete records", () => {
    const report = { mode: "model", controls: { staleWrite: { passed: true } }, runs: [{ runId: "Acme", attempts: [{}] }] };
    expect(normalizedRecords(report)[0].protectedUnchanged).toBeNull();
    report.runs[0].attempts = [{ protectedUnchanged: false }]; expect(normalizedRecords(report)[0].protectedUnchanged).toBe(false);
    report.runs[0].attempts = [{ protectedUnchanged: true }]; expect(normalizedRecords(report)[0].protectedUnchanged).toBe(true);
  });
  it("does not retain account or session identifiers", () => {
    const evidence = inspectProviderOutput({ stdout: JSON.stringify(providerReport({ session_id: "private-session", account: "private-account" })), exitCode: 0, elapsedMs: 10 });
    expect(JSON.stringify(evidence)).not.toContain("private-");
  });
});

it("real captured repair and unchanged clean candidate preserve policy and version histories", async () => {
  const tasks = await loadEvalTasks(), task = tasks.find(task => task.id === "clean-control");
  const host = await createEvalHost(task);
  try {
    const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
    expect(checkInitial(task, audit).ready).toBe(true);
    const result = await applyCandidate(host, { html: task.repairedHtml, before, audit, protectedBefore });
    expect(result.accepted).toBe(true); expect(result.receipt.status).toBe("unchanged"); expect(result.stored.item).toEqual(before.item); expect(result.protectedUnchanged).toBe(true);
    const empty = await applyCandidate(host, { html: "", before, audit, protectedBefore });
    expect(empty.receipt).toMatchObject({ status: "refused", code: "candidate-rejected" }); expect(empty.stored.item).toEqual(before.item); expect(empty.protectedUnchanged).toBe(true);
  } finally { await host.close(); }
  const output = await mkdtemp(path.join(tmpdir(), "isocan-eval-stale-test-")); scratch.push(output);
  expect((await staleWriteControl(tasks.find(task => task.id === "card-spacing"), output)).passed).toBe(true);
}, 30_000);
