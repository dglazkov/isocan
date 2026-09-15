import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { executionIdentity, reserveStudyAttempt, settleStudyAttempt, STUDY_UNCERTAINTY } from "../scripts/lib/design-partner-execution.mjs";
import { nativeInvocation, nativeStreamAccounting, runNativeProcess, executeNativeStudyRun } from "../scripts/lib/design-partner-native.mjs";
import { createStudyTools, studyBrowserUrl, studyCliArguments, answerStudyQuestion } from "../scripts/lib/design-partner-tools.mjs";
import { openStudyRunRuntime, studyTreeIdentity, assertStudyRunRuntime } from "../scripts/lib/design-partner-runtime.mjs";
import { loadCorpus } from "../scripts/lib/design-partner-eval.mjs";
const owned: string[] = [];
afterEach(async () => { await Promise.all(owned.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))); });
const temporary = async () => { const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-study-execution-")); owned.push(dir); return dir; };
const limits = { aggregateApiEquivalentUsd: 40, perRunApiEquivalentUsd: 2, inFlightHeadroomUsd: 6, tokensPerRun: 4_000_000, outputTokensPerTurn: 8192, turnsPerRun: 60, millisecondsPerRun: 900_000, repairRounds: 2 };
const profile = { model: "claude-sonnet-5", tools: ["mcp__study__cli"], effort: "high", binary: { path: "never-run-claude" } };
const fixtureManifest = () => { const value: any = { dry: { runs: ["one", "two"].map(runId => ({ runId })) }, limits, uncertainty: STUDY_UNCERTAINTY, authorization: null }; value.authorization = { approvedManifestSha256: executionIdentity(value) }; return value; };
const events = () => [{ type: "system", subtype: "init", model: profile.model, tools: [...profile.tools], mcp_servers: [{ name: "study", status: "connected" }] }, { type: "assistant", message: { id: "synthetic-message", usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 }, content: [{ type: "text", text: "Canned transport only" }] } }, { type: "result", subtype: "success", is_error: false, modelUsage: { [profile.model]: {} }, num_turns: 1, total_cost_usd: 0.01, usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 }, result: "Canned transport only" }];

it("reserves before launch, serializes competing callers, and refuses uncertain/duplicate attempts", async () => {
  const dir = await temporary(), manifest = fixtureManifest();
  const raced = await Promise.allSettled([reserveStudyAttempt(dir, manifest, "one"), reserveStudyAttempt(dir, manifest, "two")]);
  expect(raced.filter(row => row.status === "fulfilled")).toHaveLength(1);
  const accepted = raced.find(row => row.status === "fulfilled") as PromiseFulfilledResult<any>;
  expect(accepted.value.reservedApiEquivalentUsd).toBe(8);
  await expect(reserveStudyAttempt(dir, manifest, accepted.value.runId)).rejects.toThrow(/already|immutable/);
  await settleStudyAttempt(dir, accepted.value, { status: "timed-out", apiEquivalentUsd: null });
  await expect(reserveStudyAttempt(dir, manifest, accepted.value.runId === "one" ? "two" : "one")).rejects.toThrow(/Unresolved/);
});

it("retains terminal failures and requires the complete in-flight reservation before another launch", async () => {
  const dir = await temporary(), manifest = fixtureManifest(); manifest.limits = { ...limits, aggregateApiEquivalentUsd: 8 }; manifest.authorization.approvedManifestSha256 = executionIdentity(manifest);
  const attempt = await reserveStudyAttempt(dir, manifest, "one");
  await settleStudyAttempt(dir, attempt, { status: "failed", apiEquivalentUsd: 0.1 });
  await expect(reserveStudyAttempt(dir, manifest, "two")).rejects.toThrow(/headroom/);
  expect(JSON.parse(await fs.readFile(path.join(dir, `attempt-${attempt.attemptId}.json`), "utf8")).outcome.status).toBe("failed");
});

it("parses actual native event shape, independent cache usage and model/tool/turn/cost stop controls", () => {
  const parser = nativeStreamAccounting(profile, limits); parser.append(Buffer.from(events().map(event => JSON.stringify(event)).join("\n") + "\n"));
  expect(parser.finish()).toMatchObject({ status: "completed", observedTokens: 38, apiEquivalentUsd: 0.01, billedUsd: null });
  for (const mutate of [(rows: any[]) => rows[0].tools.push("Agent"), (rows: any[]) => rows[2].num_turns = 61, (rows: any[]) => rows[2].total_cost_usd = 2.1, (rows: any[]) => delete rows[2].usage.input_tokens]) {
    const rows: any[] = events(); mutate(rows); const broken = nativeStreamAccounting(profile, limits); broken.append(Buffer.from(rows.map(row => JSON.stringify(row)).join("\n"))); expect(broken.finish().stopStudy).toBeTruthy();
  }
  const absent = nativeStreamAccounting(profile, limits); expect(absent.finish()).toMatchObject({ apiEquivalentUsd: null, status: "failed" });
});

it("uses a real canned child stream and kills its owned process at the global deadline", async () => {
  const dir = await temporary(), script = path.join(dir, "canned.mjs");
  await fs.writeFile(script, `console.log(${JSON.stringify(events().map(event => JSON.stringify(event)).join("\n"))});`);
  const result = await runNativeProcess({ command: process.execPath, args: [script], env: {}, synthetic: true }, { prompt: "synthetic", cwd: dir, deadline: new Date(Date.now() + 3000).toISOString(), profile, limits, evidence: path.join(dir, "evidence") });
  expect(result).toMatchObject({ status: "completed", providerExecution: "canned-process-only", qualityEvidence: false });
  await fs.writeFile(script, "setInterval(()=>{},1000)");
  const stopped = await runNativeProcess({ command: process.execPath, args: [script], env: {}, synthetic: true }, { prompt: "synthetic", cwd: dir, deadline: new Date(Date.now() + 150).toISOString(), profile, limits, evidence: path.join(dir, "timeout") });
  expect(stopped.status).toBe("timed-out"); expect(stopped.apiEquivalentUsd).toBeNull();
});

it("has no provider path without explicit mode and uses MCP-compatible isolation without safe-mode OAuth claims", async () => {
  await expect(executeNativeStudyRun({ mode: "prepare" } as any)).rejects.toThrow(/explicit execute/);
  const invocation = nativeInvocation({ profile, limits, toolConfigFile: "/synthetic/config.json", sessionId: "synthetic", inherited: { PATH: "/synthetic", ANTHROPIC_API_KEY: "test-only-not-a-key", ISOCAN_HOME: "/outside", CLAUDE_CODE_USE_BEDROCK: "1" } });
  expect(invocation.args).toContain("--bare"); expect(invocation.args).toContain("--strict-mcp-config"); expect(invocation.args).not.toContain("--safe-mode");
  expect(invocation.env.ISOCAN_HOME).toBeUndefined(); expect(invocation.env.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
});

it("contains files and browser destinations and refuses provider/home/canvas escape", async () => {
  const dir = await temporary(), workspace = path.join(dir, "workspace"); await fs.mkdir(workspace); await fs.writeFile(path.join(workspace, "screen.html"), "<p>Acme</p>");
  await fs.symlink(dir, path.join(workspace, "escape"));
  const config: any = { workspace, source: dir, home: path.join(dir, "home"), base: "http://127.0.0.1:1234", canvasId: "prj_synthetic", condition: "B", deadline: new Date(Date.now() + 1000).toISOString(), evidence: path.join(dir, "evidence"), questions: path.join(dir, "questions"), runId: "synthetic", fixtureId: "inventory" };
  expect(await studyCliArguments(["add", "screen.html"], config)).toEqual(["add", await fs.realpath(path.join(workspace, "screen.html"))]);
  for (const args of [["add", "../outside"], ["add", "escape/private"], ["rc"], ["design", "craft", "x"], ["ls", "--canvas", "other"], ["ls", "--home=/outside"]]) await expect(studyCliArguments(args, config)).rejects.toThrow();
  await expect(studyBrowserUrl("https://example.com/", config)).rejects.toThrow(); await expect(studyBrowserUrl(config.base + "/api/projects/other/snapshot", config)).rejects.toThrow();
  const tools = await createStudyTools(config);
  try { await expect(tools.invoke("read_file", { path: "escape/private" })).rejects.toThrow(); await expect(tools.invoke("write_file", { path: ".claude/settings.json", content: "{}" })).rejects.toThrow(); } finally { await tools.close(); }
});

it("routes only explicitly mapped facts and keeps unmapped and repeated question dispositions", async () => {
  const dir = await temporary(), corpus = await loadCorpus();
  const questionFile = path.join(dir, "question.json"), question = { kind: "design-partner-question", runId: "synthetic", fixtureId: "inventory", questionId: "q1", text: "Who uses this?", askedAt: new Date().toISOString() };
  await fs.writeFile(questionFile, JSON.stringify(question));
  await expect(answerStudyQuestion({ corpus, questionFile, evaluatorId: "evaluator", factId: "guessed" })).rejects.toThrow();
  const answer = await answerStudyQuestion({ corpus, questionFile, evaluatorId: "evaluator", factId: "audience", disposition: "repeated" });
  expect(answer.answer).toBe(corpus.tasks[0].answerBank[0].answer); expect(answer.disposition).toBe("repeated");
  await expect(answerStudyQuestion({ corpus, questionFile, evaluatorId: "evaluator", factId: "audience" })).rejects.toThrow();
});

it("refuses a changed persisted canvas before launching a runtime and rejects caller-invented live handles", async () => {
  const directory = await temporary(), home = path.join(directory, "home"), project = path.join(home, "projects", "prj_acme"); await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(project, "canvas.json"), JSON.stringify({ title: "Acme original", version: "exact" }));
  const mapping = { fixtureId: "synthetic", entrance: "external-agent", canvasId: "prj_acme", persistedState: await studyTreeIdentity(project) };
  const file = path.join(directory, "map.json"); await fs.writeFile(file, JSON.stringify({ home, mappings: [mapping] }));
  const manifest = { dry: { runs: [{ runId: "synthetic/A", fixtureId: "synthetic", entrance: "external-agent", condition: "A" }] }, materializations: [{ condition: "A", path: file }], limits: {}, runtimes: {} };
  await fs.writeFile(path.join(project, "canvas.json"), JSON.stringify({ title: "Acme changed", version: "exact" }));
  await expect(openStudyRunRuntime({ manifest, runId: "synthetic/A", directory: path.join(directory, "run") })).rejects.toThrow(/state changed/);
  await expect(fs.stat(path.join(directory, "run"))).rejects.toThrow();
  expect(() => assertStudyRunRuntime({ base: "http://127.0.0.1:1234" }, manifest)).toThrow(/live owned runtime/);
});
