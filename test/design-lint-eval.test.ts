import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseEvalArgs } from "../scripts/design-lint-eval.mjs";
import { buildPrompt, cannedCandidate, CostLedger, inspectProviderOutput, invokeModel, MODEL_SPEC, modelInvocation, modelPreflight, outputCapture, parseCandidate, sanitizeAuthStatus } from "../scripts/lib/design-lint-eval-model.mjs";
import { applyCandidate, candidateScope, checkInitial, claimContinuation, createEvalHost, inputHash, loadEvalTasks, normalizedRecords, readContinuation, requestCandidate, scheduleRuns, selectCandidateProvider, staleWriteControl } from "../scripts/lib/design-lint-eval-runner.mjs";

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
    const invocation = modelInvocation(0.1, { PATH: "/usr/bin", HOME: "/tmp/acme", USER: "acme-os-user", ANTHROPIC_BASE_URL: "https://secret.invalid", ANTHROPIC_API_KEY: "secret", CLAUDE_CODE_EFFORT_LEVEL: "low", CLAUDE_CODE_RETRY_WATCHDOG: "1" });
    expect(invocation.args).toContain("--safe-mode"); expect(invocation.args[invocation.args.indexOf("--tools") + 1]).toBe(""); expect(invocation.args[invocation.args.indexOf("--max-turns") + 1]).toBe("1");
    expect(invocation.env.CLAUDE_CODE_MAX_RETRIES).toBe("0"); expect(invocation.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("8192"); expect(invocation.env.CLAUDE_CODE_EFFORT_LEVEL).toBe("high");
    expect(invocation.env.ANTHROPIC_API_KEY).toBeUndefined(); expect(invocation.env.ANTHROPIC_BASE_URL).toBeUndefined(); expect(invocation.env.CLAUDE_CODE_RETRY_WATCHDOG).toBeUndefined();
    expect(invocation.env.USER).toBe("acme-os-user");
  });
  it("checks authentication under actual isolation flags and OS discovery before declaring model readiness", () => {
    const calls = [];
    const run = vi.fn((_command, args, options) => {
      calls.push({ args, options });
      if (args[0] === "--version") return "Acme CLI fixture version";
      if (args[0] === "--help") return "--safe-mode --tools --strict-mcp-config --max-budget-usd --effort --setting-sources";
      expect(args.slice(-3)).toEqual(["auth", "status", "--json"]);
      expect(args).not.toContain("--print"); expect(args).toContain("--safe-mode"); expect(args).toContain("--strict-mcp-config");
      expect(options.env.USER).toBe("acme-os-user"); expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
      return JSON.stringify({ loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty", subscriptionType: "max", email: "private-acme@example.invalid", accountUuid: "private-account" });
    });
    const result = modelPreflight({ run, inherited: { USER: "acme-os-user", ANTHROPIC_API_KEY: "secret" } });
    expect(result.available).toBe(true); expect(calls).toHaveLength(3); expect(new Set(calls.map(call => call.options.cwd)).size).toBe(1);
    expect(result.auth).toMatchObject({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "max" });
    expect(JSON.stringify(result)).not.toContain("private-"); expect(JSON.stringify(result)).not.toContain("acme-os-user"); expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("keeps failed or malformed authentication preflight unavailable", () => {
    expect(sanitizeAuthStatus('{"loggedIn":false,"authMethod":"none"}', 1)).toMatchObject({ available: true, loggedIn: false });
    expect(sanitizeAuthStatus("not JSON", 1)).toMatchObject({ available: false, loggedIn: null });
    const run = (_command, args) => args[0] === "--version" ? "Acme" : args[0] === "--help" ? "--safe-mode --tools --strict-mcp-config --max-budget-usd --effort --setting-sources" : '{"loggedIn":false,"authMethod":"none"}';
    expect(modelPreflight({ run }).available).toBe(false);
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

it("submits a changed eval candidate with its original audit capture and refuses a later metadata change", async () => {
  const task = (await loadEvalTasks()).find(task => task.id === "card-spacing");
  const host = await createEvalHost(task);
  try {
    const before = await host.readStored(), audit = await host.audit(), protectedBefore = await host.protectedState();
    expect(audit.repairBasis.repair.target.artifact.versionId).toBe(before.version.id);
    const changed = await applyCandidate(host, { html: task.repairedHtml, before, audit, protectedBefore });
    expect(changed.accepted).toBe(true); expect(changed.receipt.status).toBe("saved");
    expect(changed.stored.html).toBe(task.repairedHtml); expect(changed.stored.item.versions).toHaveLength(before.item.versions.length + 1);
    expect(changed.protectedUnchanged).toBe(true);
    expect((await host.client.getLog(host.canvas.id, 0)).at(-1).envelope.op.type).toBe("design.repair");
    const current = await host.readStored(), captured = await host.audit();
    await host.client.sendOp(host.canvas.id, host.actor, { type: "item.update", itemId: host.screen.id, patch: { description: "Acme teammate changed the task description" } });
    const intervening = await host.readStored();
    const refused = await applyCandidate(host, { html: task.repairedHtml + "\n<!-- Acme follow-up correction -->", before: current, audit: captured, protectedBefore });
    expect(refused.accepted).toBe(false); expect(refused.receipt.status).toBe("refused");
    expect(refused.receipt.reason).toMatch(/metadata|scope/); expect(refused.stored.item).toEqual(intervening.item); expect(refused.protectedUnchanged).toBe(true);
  } finally { await host.close(); }
}, 30_000);


describe("one bounded continuation after a zero-token login refusal", () => {
  async function priorFixture(change = (_report, _provider) => {}) {
    const directory = await mkdtemp(path.join(tmpdir(), "isocan-eval-continuation-test-")); scratch.push(directory);
    const seed = "Acme continuation", fixtures = ["a", "b", "c", "d", "e", "f"].map(id => ({ id, hashes: { "initial.html": inputHash(id) } }));
    const order = scheduleRuns(fixtures.map(task => task.id), seed), ledger = new CostLedger(10), allowance = ledger.begin();
    ledger.finish(0, allowance, "Provider outcome was refused, interrupted or unconfirmed.");
    const provider = { provider: "claude-cli", modelCalls: 1, exitCode: 1, signal: null, apiEquivalentCost: 0, candidateText: "Not logged in · Please run /login", models: [], usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, invocation: { args: modelInvocation(allowance).args } };
    const report = { mode: "model", status: "unavailable", modelCalls: 1, model: MODEL_SPEC, modelSpecSha256: inputHash(JSON.stringify(MODEL_SPEC)), seed, fixtures, order, accounting: ledger.snapshot(), runs: [{ ...order[0], attempts: [{ round: 1, allowance, provider }] }] };
    change(report, provider);
    const providerPath = path.join(directory, order[0].runId, "attempt-1", "provider.json");
    await mkdir(path.dirname(providerPath), { recursive: true });
    await writeFile(providerPath, JSON.stringify(provider)); await writeFile(path.join(directory, "report.json"), JSON.stringify(report));
    return { directory, providerPath, options: { budgetUsd: 10, model: MODEL_SPEC.model, seed, fixtures }, report };
  }
  it("retains the prior exact evidence and counts its invocation within the original 72", async () => {
    const fixture = await priorFixture(), carry = await readContinuation(fixture.directory, fixture.options);
    expect(carry).toMatchObject({ priorInvocations: 1, priorReportedApiEquivalent: 0, maxAdditionalInvocations: 71, approvedAggregate: 10, fixedPerCall: 0.138888888 });
    expect(carry.priorReportSha256).toBe(inputHash(await readFile(path.join(fixture.directory, "report.json"))));
    expect(carry.priorProviderSha256).toBe(inputHash(await readFile(fixture.providerPath)));
    const ledger = new CostLedger(10, carry);
    expect(ledger.snapshot()).toMatchObject({ calls: 1, carriedInvocations: 1, newInvocations: 0 });
    for (let call = 0; call < 71; call++) { const allowance = ledger.begin(); expect(allowance).toBe(0.138888888); ledger.finish(0, allowance); }
    expect(ledger.snapshot()).toMatchObject({ calls: 72, newInvocations: 71, reportedApiEquivalent: 0 }); expect(() => ledger.begin()).toThrow();
    expect(() => new CostLedger(11, carry)).toThrow();
  });
  it.each([
    ["pending", report => { report.accounting.pending = true; }],
    ["missing cost", report => { report.accounting.reportedApiEquivalent = null; }],
    ["nonzero cost", (report, provider) => { report.accounting.reportedApiEquivalent = 0.01; provider.apiEquivalentCost = 0.01; }],
    ["actual model", (_report, provider) => { provider.models = [MODEL_SPEC.model]; }],
    ["nonzero tokens", (_report, provider) => { provider.usage.input_tokens = 1; }],
    ["actual candidate", (_report, provider) => { provider.candidateText = '{"html":"Acme"}'; }],
    ["accepted repair", report => { report.runs[0].attempts[0].receipt = { status: "saved" }; }],
    ["altered invocation", (_report, provider) => { provider.invocation.args = ["--print"]; }],
  ])("refuses %s prior evidence rather than restarting its allowance", async (_name, change) => {
    const fixture = await priorFixture(change); await expect(readContinuation(fixture.directory, fixture.options)).rejects.toThrow(/Continuation refused/);
  });
  it("requires the identical model, seed, fixture bytes and approved aggregate", async () => {
    const fixture = await priorFixture();
    for (const change of [{ budgetUsd: 11 }, { seed: "Other" }, { model: "other" }, { fixtures: [] }]) await expect(readContinuation(fixture.directory, { ...fixture.options, ...change })).rejects.toThrow();
  });
  it("claims only once after free checks, without rewriting either immutable input", async () => {
    const fixture = await priorFixture(), carry = await readContinuation(fixture.directory, fixture.options);
    const outputA = path.join(fixture.directory, "new-a"), outputB = path.join(fixture.directory, "new-b");
    await mkdir(outputA); await mkdir(outputB);
    const args = { outputDir: outputA, readinessPassed: true, auth: { available: true, loggedIn: true } };
    await expect(claimContinuation(carry, { ...args, readinessPassed: false })).rejects.toThrow(/free readiness/);
    await expect(claimContinuation(carry, { ...args, auth: { available: true, loggedIn: false } })).rejects.toThrow(/authentication/);
    await expect(readFile(path.join(fixture.directory, "continuation-claim.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const results = await Promise.allSettled([claimContinuation(carry, args), claimContinuation(carry, { ...args, outputDir: outputB })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const claim = JSON.parse(await readFile(path.join(fixture.directory, "continuation-claim.json"), "utf8"));
    expect([await realpath(outputA), await realpath(outputB)]).toContain(claim.outputDirectory);
    expect(claim).toMatchObject({ priorInvocations: 1, maxAdditionalInvocations: 71, fixedPerCall: 0.138888888 });
    expect(inputHash(await readFile(path.join(fixture.directory, "report.json")))).toBe(carry.priorReportSha256);
    expect(inputHash(await readFile(fixture.providerPath))).toBe(carry.priorProviderSha256);
  });
  it("refuses changed evidence between validation and exclusive claim", async () => {
    const fixture = await priorFixture(), carry = await readContinuation(fixture.directory, fixture.options);
    await writeFile(fixture.providerPath, "changed Acme evidence");
    await expect(claimContinuation(carry, { outputDir: fixture.directory, readinessPassed: true, auth: { available: true, loggedIn: true } })).rejects.toThrow(/changed/);
  });
  it("requires explicit model mode for continuation and never accepts it for dry or summary", () => {
    expect(() => parseEvalArgs(["--dry-run", "--out", "/tmp/acme", "--continue-from", "/tmp/old"])).toThrow();
    expect(() => parseEvalArgs(["--summarize", "/tmp/acme", "--continue-from", "/tmp/old"])).toThrow();
    expect(parseEvalArgs(["--model", MODEL_SPEC.model, "--budget-usd", "10", "--out", "/tmp/acme", "--continue-from", "/tmp/old"])).toMatchObject({ mode: "model", continueFrom: "/tmp/old" });
  });
});
