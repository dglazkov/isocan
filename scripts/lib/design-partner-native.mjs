/** A single bounded native process. Module import and preflight make zero provider calls. */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { chromeOrDie } from "./browser.mjs";
import { STUDY_TOOLS } from "./design-partner-tools.mjs";
import { validateExecutionManifest, reserveStudyAttempt, settleStudyAttempt, executionIdentity } from "./design-partner-execution.mjs";
import { studyHash, studyJson, studyProcess, assertStudyRunRuntime } from "./design-partner-runtime.mjs";

const binarySha256 = "c942e1228b93cb4d52183b3dfbc77f28264f35aa947acd9c0853d029164cf450";
const usageKeys = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"];
const nativeTools = STUDY_TOOLS.map(tool => `mcp__study__${tool.name}`);
/** Derive one stable native session for the exact provisioned cell; questions never start another session. */
export function nativeSessionId(manifest, runId) {
  const hex = studyHash(`${executionIdentity(manifest)}/${runId}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Capture only pinned binary/help/tool identity and authentication availability; never store a key. */
export async function prepareNativeProfile({ cwd, binaryPath, inherited = process.env } = {}) {
  const candidates = binaryPath ? [path.resolve(binaryPath)] : (inherited.PATH ?? "").split(path.delimiter).filter(Boolean).map(directory => path.join(directory, "claude"));
  let resolved;
  for (const candidate of candidates) { try { resolved = await fs.realpath(candidate); break; } catch (error) { if (error.code !== "ENOENT") throw error; } }
  if (!resolved) throw new Error("Native CLI is unavailable; supply an explicit pinned --binary path");
  const binary = { path: resolved, sha256: binarySha256 };
  const bytes = await fs.readFile(binary.path); if (studyHash(bytes) !== binary.sha256) throw new Error("Installed native binary changed");
  const env = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR"].filter(key => inherited[key] !== undefined).map(key => [key, inherited[key]]));
  const version = await studyProcess(binary.path, ["--version"], { cwd, env, milliseconds: 10_000 }), help = await studyProcess(binary.path, ["--help"], { cwd, env, milliseconds: 10_000 });
  if (version.code !== 0 || !version.stdout.startsWith("2.1.269") || help.code !== 0 || ["--bare", "--restricted", "--strict-mcp-config", "--tools", "--max-budget-usd", "--output-format"].some(flag => !help.stdout.includes(flag))) throw new Error("Native CLI lacks the pinned isolation/stream/budget interface");
  const { studyInstrumentationIdentity } = await import("./design-partner-runtime.mjs");
  const toolFiles = await studyInstrumentationIdentity();
  const browserPath = await fs.realpath(chromeOrDie()), browserVersion = await studyProcess(browserPath, ["--version"], { cwd, env, milliseconds: 10_000 });
  const browserProductVersion = browserVersion.stdout.match(/\d+(?:\.\d+){3}/)?.[0];
  if (browserVersion.code !== 0 || !browserProductVersion) throw new Error("Owned Chrome version is unavailable");
  const browserBinary = { path: browserPath, sha256: studyHash(await fs.readFile(browserPath)), version: browserProductVersion };
  return { profile: { schemaVersion: 1, kind: "claude-study-native", binary, version: "2.1.269", model: "claude-sonnet-5", effort: "high", tools: nativeTools, toolFiles, helpSha256: studyHash(help.stdout), nativeInitialization: { status: "unmeasured", reason: "MCP-client and canned streams can prove the tool boundary, not native model initialization or cap enforcement." }, browser: "owned-chrome-cdp", browserBinary, network: { proxy: "owned-http-only", daemon: "unavailable-use-cli", repository: "fixed-fixture-http-get", tls: false, webSockets: false, fileUrls: false }, imageGeneration: "unavailable", extraAgents: false, adaptation: { mode: "adapted-guidance", revision: "isocan-craft-v1", upstream: "2149fcce39a90bb409df5f16515f316a76dc6199" } }, authentication: { available: Boolean(inherited.ANTHROPIC_API_KEY), mode: "bare-api-key", reason: inherited.ANTHROPIC_API_KEY ? "API-key environment is present; authenticated native execution remains unmeasured." : "The isolated --bare profile has no API key. Existing OAuth/keychain login does not authenticate this profile." }, providerCalls: 0 };
}

/** Explicit flags leave only the pinned MCP capability, with requested limits and no credential in evidence. */
export function nativeInvocation({ profile, limits, toolConfigFile, sessionId, inherited = process.env }) {
  const env = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR"].filter(key => inherited[key] !== undefined).map(key => [key, inherited[key]]));
  if (inherited.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = inherited.ANTHROPIC_API_KEY;
  Object.assign(env, { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(limits.outputTokensPerTurn), CLAUDE_CODE_MAX_RETRIES: "0", CLAUDE_CODE_EFFORT_LEVEL: profile.effort, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", CLAUDE_CODE_AUTO_CONNECT_IDE: "false", CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1", CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1", CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1" });
  const mcp = { mcpServers: { study: { command: process.execPath, args: [fileURLToPath(new URL("./design-partner-mcp.mjs", import.meta.url)), toolConfigFile], ...(profile.browserBinary ? { env: { CHROME_PATH: profile.browserBinary.path } } : {}) } } };
  return { command: profile.binary.path, args: ["--print", "--verbose", "--output-format", "stream-json", "--model", profile.model, "--effort", profile.effort, "--max-turns", String(limits.turnsPerRun), "--max-budget-usd", String(limits.perRunApiEquivalentUsd), "--session-id", sessionId, "--bare", "--restricted", "--tools", "", "--allowedTools", ...profile.tools, "--strict-mcp-config", "--mcp-config", JSON.stringify(mcp), "--setting-sources", "", "--disable-slash-commands", "--no-chrome", "--no-session-persistence", "--permission-mode", "dontAsk"], env };
}

/** Parse actual native stream records and stop on mismatched init, missing accounting or budget excess. */
export function nativeStreamAccounting(profile, limits) {
  const decoder = new StringDecoder("utf8");
  let pending = "", initialization = null, terminal = null, failure = null, assistantTurns = 0; const messages = new Map(); let observedTokens = 0;
  const stop = reason => { failure ??= reason; };
  const accept = event => {
    if (event.type === "system" && event.subtype === "init") {
      if (initialization) return stop("Duplicate native initialization");
      initialization = { model: event.model, tools: event.tools, mcpServers: event.mcp_servers };
      if (event.model !== profile.model || !Array.isArray(event.tools) || JSON.stringify([...event.tools].sort()) !== JSON.stringify([...profile.tools].sort())) stop("Native model/tool profile differs from the frozen profile");
      if (!event.mcp_servers?.some(server => server.name === "study" && server.status === "connected")) stop("Native MCP initialization is unavailable");
    }
    if (event.type === "assistant" && event.message) {
      if (!initialization) stop("Model output arrived without observed tool initialization");
      const message = event.message;
      if (typeof message.id !== "string" || !message.id || !message.usage) return stop("Assistant message identity/usage is unavailable");
      const prior = messages.get(message.id) ?? Object.fromEntries(usageKeys.map(key => [key, 0]));
      if (!messages.has(message.id)) assistantTurns++;
      const next = { ...prior };
      for (const key of usageKeys) {
        const count = message.usage[key];
        if (count === undefined) continue; // SDK content chunks may omit unchanged categories.
        if (!Number.isSafeInteger(count) || count < 0) return stop("Malformed assistant usage");
        // The SDK may repeat a message with growing cumulative usage. A repeated
        // message must never subtract observed tokens or count its input twice.
        next[key] = Math.max(prior[key], count); observedTokens += next[key] - prior[key];
      }
      messages.set(message.id, next);
      if (assistantTurns > limits.turnsPerRun || observedTokens > limits.tokensPerRun) stop("Observed global turn/token ceiling exceeded");
      if (next.output_tokens > limits.outputTokensPerTurn) stop("Observed per-turn output exceeds the requested limit");
    }
    if (event.type === "result") {
      if (terminal) return stop("Duplicate native terminal result"); terminal = event;
      const usage = event.usage;
      if (!usageKeys.every(key => Number.isSafeInteger(usage?.[key]) && usage[key] >= 0)) stop("Native token accounting is unavailable");
      if (!Number.isFinite(event.total_cost_usd) || event.total_cost_usd < 0) stop("Native reported/API-equivalent cost is unavailable");
      if (JSON.stringify(Object.keys(event.modelUsage ?? {})) !== JSON.stringify([profile.model])) stop("Reported model identity differs from the frozen model");
      if (!Number.isSafeInteger(event.num_turns) || event.num_turns < 1 || event.num_turns > limits.turnsPerRun || usageKeys.reduce((sum, key) => sum + (usage?.[key] ?? 0), 0) > limits.tokensPerRun) stop("Final global turn/token ceiling exceeded");
      if (usageKeys.reduce((sum, key) => sum + (usage?.[key] ?? 0), 0) < observedTokens || event.num_turns < assistantTurns) stop("Final accounting is smaller than observed usage");
      if (event.total_cost_usd > limits.perRunApiEquivalentUsd) stop("Reported cost crossed the requested stop threshold; keep in-flight overrun in the study total");
      if (event.is_error !== false || event.subtype !== "success") stop("Native run did not complete successfully");
    }
  };
  return {
    append(bytes) { pending += decoder.write(bytes); let index; while ((index = pending.indexOf("\n")) >= 0) { const line = pending.slice(0, index); pending = pending.slice(index + 1); if (line.trim()) { try { accept(JSON.parse(line)); } catch { stop("Malformed native stream record"); } } } return failure; },
    finish() {
      pending += decoder.end();
      if (pending.trim()) { try { accept(JSON.parse(pending)); } catch { stop("Truncated native stream"); } pending = ""; }
      if (!initialization || !terminal) stop("Native initialization or final accounting is missing");
      return { initialization, assistantTurns, observedTokens, usage: terminal?.usage ? Object.fromEntries(usageKeys.map(key => [key, terminal.usage[key] ?? null])) : null, totalTurns: terminal?.num_turns ?? null, apiEquivalentUsd: Number.isFinite(terminal?.total_cost_usd) ? terminal.total_cost_usd : null, billedUsd: null, billingEvidence: null, resultText: typeof terminal?.result === "string" ? terminal.result : null, stopStudy: failure, status: failure ? "failed" : "completed", limitations: ["CLI-reported/API-equivalent cost is not billing evidence.", "Native turn/output/cost controls are requested; cumulative token accounting can stop only after an in-flight request reports usage."] };
    },
  };
}

/** The same durable process boundary accepts a canned executable only in explicitly synthetic tests. */
export async function runNativeProcess(invocation, { prompt, cwd, deadline, profile, limits, evidence }) {
  await fs.mkdir(evidence, { recursive: true });
  const stdoutFile = await fs.open(path.join(evidence, "native-stream.jsonl"), "wx"), stderrFile = await fs.open(path.join(evidence, "native-stderr.txt"), "wx");
  const accounting = nativeStreamAccounting(profile, limits), started = Date.now();
  let size = 0, stopReason = null;
  try {
    const result = await new Promise(resolve => {
      const child = spawn(invocation.command, invocation.args, { cwd, env: invocation.env, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
      const stop = reason => { stopReason ??= reason; if (child.exitCode !== null || child.signalCode !== null || !child.pid) return; try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch {} };
      const timer = setTimeout(() => stop("Absolute run deadline reached"), Math.max(0, Date.parse(deadline) - Date.now()));
      let writes = Promise.resolve();
      child.stdout.on("data", bytes => { size += bytes.length; if (size > 16_777_216) return stop("Native output bound exceeded"); writes = writes.then(() => stdoutFile.write(bytes)).catch(() => stop("Durable native evidence write failed")); const reason = accounting.append(bytes); if (reason) stop(reason); });
      child.stderr.on("data", bytes => { size += bytes.length; if (size > 16_777_216) return stop("Native output bound exceeded"); writes = writes.then(() => stderrFile.write(bytes)).catch(() => stop("Durable native evidence write failed")); });
      child.stdin.on("error", () => {}); child.stdin.end(prompt);
      child.once("error", error => { stopReason ??= `Native launch failed: ${error.code}`; });
      child.once("close", async (code, signal) => { clearTimeout(timer); await writes; resolve({ code, signal }); });
    });
    const reported = accounting.finish();
    if (result.code !== 0 || result.signal) stopReason ??= "Native process ended without normal completion";
    return { ...reported, ...result, elapsedMs: Date.now() - started, stopStudy: stopReason ?? reported.stopStudy, status: stopReason?.includes("deadline") ? "timed-out" : stopReason ? "failed" : reported.status, providerExecution: invocation.synthetic === true ? "canned-process-only" : "native-requested", qualityEvidence: false };
  } finally { await stdoutFile.close(); await stderrFile.close(); }
}

/** Paid entry refuses before launch unless mode, real frozen inputs and independent approval all match. */
export async function executeNativeStudyRun({ mode, manifest, authorization, repository, fixtures, journal, runId, runtimeConfig, inherited = process.env }) {
  if (mode !== "execute") throw new Error("No provider execution outside explicit execute mode");
  await validateExecutionManifest(manifest, { repository, fixtures, execution: true, authorization });
  assertStudyRunRuntime(runtimeConfig, manifest);
  const planned = manifest.dry.runs.find(row => row.runId === runId);
  if (!planned || runtimeConfig.runId !== runId || runtimeConfig.source !== manifest.runtimes[planned.condition === "A" ? "A" : "B"].directory) throw new Error("Native run configuration differs from frozen source/cell");
  const attempt = await reserveStudyAttempt(journal, manifest, runId);
  if (!inherited.ANTHROPIC_API_KEY) return settleStudyAttempt(journal, attempt, { status: "unavailable", apiEquivalentUsd: 0, stopStudy: "Isolated native --bare authentication is unavailable; no process launched", providerCalls: 0, qualityEvidence: false });
  const folder = path.join(journal, attempt.attemptId); await fs.mkdir(folder);
  const config = { ...runtimeConfig, expectedBrowserVersion: manifest.profile.browserBinary.version, deadline: attempt.deadline, evidence: path.join(folder, "tools"), questions: path.join(folder, "questions") };
  const writtenConfig = path.join(folder, "tool-config.json"); await fs.writeFile(writtenConfig, studyJson(config), { flag: "wx", mode: 0o600 });
  const configFile = await fs.realpath(writtenConfig);
  const sessionId = nativeSessionId(manifest, runId);
  const invocation = nativeInvocation({ profile: manifest.profile, limits: manifest.limits, toolConfigFile: configFile, sessionId, inherited });
  await fs.writeFile(path.join(folder, "invocation.json"), studyJson({ command: invocation.command, args: invocation.args, environmentKeys: Object.keys(invocation.env), promptSha256: studyHash(runtimeConfig.prompt), producer: { actor: runtimeConfig.actor, sessionId: runtimeConfig.sessionId }, attemptId: attempt.attemptId, sourceRevision: STUDY_SOURCE(manifest, planned.condition) }), { flag: "wx" });
  const result = await runNativeProcess(invocation, { prompt: runtimeConfig.prompt, cwd: runtimeConfig.workspace, deadline: attempt.deadline, profile: manifest.profile, limits: manifest.limits, evidence: path.join(folder, "native") });
  return settleStudyAttempt(journal, attempt, result);
}
function STUDY_SOURCE(manifest, condition) { return manifest.runtimes[condition === "A" ? "A" : "B"].sourceRevision; }
