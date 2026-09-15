/** Model boundary for the preregistered pilot. Importing this module never invokes a provider. */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const MODEL_SPEC = Object.freeze({ model: "claude-sonnet-5", outputTokens: 8192, effort: "high", maxTurns: 1, retries: 0, tools: [], maxCalls: 72 });
export const GENERIC_INSTRUCTION = 'Repair the supplied HTML according to the task and governing DESIGN.md while preserving its visible intent, semantics, styling and interaction. Change only HTML; do not modify or propose changes to the governing document. If no repair is needed, return the HTML unchanged. Return exactly one JSON object with exactly one key: {"html":"complete HTML"}. Do not include markdown fences, commentary or other keys.';
const sha = value => createHash("sha256").update(value).digest("hex");

/** The control contains only the actual task, governing bytes and current HTML. */
export function buildPrompt({ instruction, design, html, condition, audit }) {
  if (!["rules-only", "diagnostics"].includes(condition)) throw new Error("Unknown condition");
  const base = `${GENERIC_INSTRUCTION}\n\nTask:\n${instruction}\n\nGoverning DESIGN.md:\n${design}\n\nCurrent HTML:\n${html}`;
  return condition === "diagnostics" ? `${base}\n\nCurrent analyzer findings and coverage:\n${JSON.stringify(audit, null, 2)}` : base;
}

/** Strict shape rejects duplicate keys, policy edits and prose without hidden repair retries. */
export function parseCandidate(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 1_048_576 || !/^\s*\{\s*"html"\s*:\s*"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"\s*\}\s*$/.test(text)) throw new Error("Candidate must be exactly one JSON object containing only an HTML string.");
  return JSON.parse(text).html;
}

/** Record every invocation before it starts; unavailable cost permanently closes this ledger. */
export class CostLedger {
  constructor(cap, carry = null) {
    if (!Number.isFinite(cap) || cap <= 0) throw new Error("Model mode needs an explicit positive aggregate API-equivalent budget.");
    this.cap = cap; this.perCall = Math.floor(cap / MODEL_SPEC.maxCalls * 1e9) / 1e9;
    if (!this.perCall) throw new Error("Budget is too small for a positive per-call allowance.");
    if (carry && (cap !== 10 || carry.kind !== "zero-token-login-refusal" || carry.priorInvocations !== 1 || carry.priorReportedApiEquivalent !== 0 || carry.fixedPerCall !== this.perCall)) throw new Error("Only the validated one-invocation, zero-cost login refusal may carry forward.");
    this.carriedInvocations = carry ? 1 : 0;
    this.calls = this.carriedInvocations; this.reported = 0; this.unavailable = false; this.pending = false; this.stopped = null;
  }
  begin() {
    if (this.stopped || this.pending || this.calls >= MODEL_SPEC.maxCalls) throw new Error(this.stopped ?? "No additional model call is allowed.");
    const allowance = Math.min(this.perCall, this.cap - this.reported);
    if (!(allowance > 0)) throw new Error("Aggregate API-equivalent budget exhausted.");
    this.pending = true; this.calls++; return allowance;
  }
  finish(cost, allowance, stopReason = null) {
    if (!this.pending) throw new Error("No model call awaits accounting.");
    this.pending = false;
    if (!Number.isFinite(cost) || cost < 0) { this.unavailable = true; this.stopped = "Reported API-equivalent cost is unavailable."; }
    else {
      this.reported += cost;
      if (cost > allowance + 1e-10 || this.reported > this.cap + 1e-10) this.stopped = "Reported cost exceeded the stated allowance; provider cap enforcement was not established.";
      else if (stopReason) this.stopped = stopReason;
    }
    return this.snapshot();
  }
  snapshot() { return { cap: this.cap, fixedPerCall: this.perCall, calls: this.calls, carriedInvocations: this.carriedInvocations, newInvocations: this.calls - this.carriedInvocations, reportedApiEquivalent: this.unavailable || this.pending ? null : this.reported, knownReportedSubtotal: this.reported, billedSpend: null, stopped: this.stopped, pending: this.pending, costProvenance: "CLI-reported estimated/API-equivalent token cost; managed modelPricing may affect rates. Not billing evidence.", enforcement: "CLI cap requested; provider enforcement unmeasured until an approved run" }; }
}

/** Keep accounting evidence and candidate text; discard account/session identifiers from CLI JSON. */
export function inspectProviderOutput({ stdout, exitCode, signal = null, elapsedMs }) {
  const bytes = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? ""), decoded = bytes.toString("utf8");
  const base = { stdoutSha256: sha(bytes), stdoutBytes: bytes.length, elapsedMs, exitCode, signal, candidateText: null, apiEquivalentCost: null, usage: null, models: null, reportedDurationMs: null, stopReason: null };
  if (!Buffer.from(decoded).equals(bytes)) return { ...base, stopReason: "CLI output is not valid UTF-8; cost is unavailable." };
  let result;
  try { result = JSON.parse(decoded); } catch { return { ...base, stopReason: "CLI did not return a confirmed JSON result; cost is unavailable." }; }
  if (!result || typeof result !== "object" || Array.isArray(result)) return { ...base, stopReason: "CLI result shape is unavailable." };
  base.apiEquivalentCost = Number.isFinite(result.total_cost_usd) && result.total_cost_usd >= 0 ? result.total_cost_usd : null;
  base.candidateText = typeof result.result === "string" ? result.result : null;
  base.models = result.modelUsage && typeof result.modelUsage === "object" ? Object.keys(result.modelUsage) : [];
  base.reportedDurationMs = Number.isFinite(result.duration_ms) && result.duration_ms >= 0 ? result.duration_ms : null;
  const fields = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];
  if (fields.every(key => Number.isSafeInteger(result.usage?.[key]) && result.usage[key] >= 0)) base.usage = Object.fromEntries(fields.map(key => [key, result.usage[key]]));
  if (base.apiEquivalentCost === null) base.stopReason = "Reported API-equivalent cost is unavailable.";
  else if (exitCode !== 0 || signal || result.is_error !== false || result.subtype !== "success") base.stopReason = "Provider outcome was refused, interrupted or unconfirmed.";
  else if (base.models.length !== 1 || base.models[0] !== MODEL_SPEC.model) base.stopReason = "Reported model identity differs from the frozen model.";
  else if (!base.usage || base.usage.output_tokens > MODEL_SPEC.outputTokens || result.num_turns !== MODEL_SPEC.maxTurns) base.stopReason = "Reported usage or turn limit is invalid.";
  else if (base.candidateText === null) base.stopReason = "CLI returned no candidate text.";
  return base;
}

/** Preserve multibyte characters split across process chunks and enforce a byte bound. */
export function outputCapture(limit = 2_097_152) {
  const chunks = []; let size = 0;
  return { append(bytes) { size += bytes.length; if (size > limit) throw new Error("CLI output exceeded capture bound."); chunks.push(Buffer.from(bytes)); }, bytes() { return Buffer.concat(chunks); } };
}

/** Fixed flags and a small environment prevent user/project customizations entering one arm. */
export function modelInvocation(allowance, inherited = process.env) {
  if (!Number.isFinite(allowance) || allowance <= 0) throw new Error("Invalid per-call allowance.");
  const env = {};
  // Preserve ordinary OS/auth discovery without copying provider-routing or customization variables.
  // Claude's macOS keychain lookup needs USER as well as HOME; neither is a credential.
  for (const key of ["PATH", "HOME", "USER", "USERPROFILE", "TMPDIR", "TMP", "TEMP", "SystemRoot", "LANG", "LC_ALL"]) if (inherited[key] !== undefined) env[key] = inherited[key];
  Object.assign(env, { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(MODEL_SPEC.outputTokens), CLAUDE_CODE_MAX_RETRIES: "0", CLAUDE_CODE_EFFORT_LEVEL: MODEL_SPEC.effort, CLAUDE_CODE_MAX_TURNS: "1", CLAUDE_CODE_SAFE_MODE: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", CLAUDE_CODE_AUTO_CONNECT_IDE: "false", CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1", CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1", CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1" });
  return { command: "claude", args: ["--print", "--output-format", "json", "--model", MODEL_SPEC.model, "--effort", MODEL_SPEC.effort, "--max-turns", "1", "--max-budget-usd", allowance.toFixed(9), "--tools", "", "--safe-mode", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--setting-sources", "", "--disable-slash-commands", "--no-chrome", "--no-session-persistence", "--permission-mode", "dontAsk"], env };
}

/** Retain only status enums, never account identifiers or authentication material. */
export function sanitizeAuthStatus(stdout, exitCode) {
  let value;
  try { value = JSON.parse(stdout); } catch { return { available: false, loggedIn: null, reason: "Authentication status was not available as JSON." }; }
  const member = (key, choices) => choices.includes(value?.[key]) ? value[key] : null;
  return { available: typeof value?.loggedIn === "boolean" && (exitCode === 0 || exitCode === 1), loggedIn: typeof value?.loggedIn === "boolean" ? value.loggedIn : null,
    authMethod: member("authMethod", ["claude.ai", "api_key", "none"]), apiProvider: member("apiProvider", ["firstParty", "bedrock", "vertex", "foundry"]), subscriptionType: member("subscriptionType", ["max", "pro", "team", "enterprise", "free"]), exitCode };
}

/** Read-only help/version/auth checks use the same isolated environment and a fresh scratch cwd. */
export function modelPreflight({ run = execFileSync, inherited = process.env } = {}) {
  let cwd;
  try {
    cwd = mkdtempSync(path.join(tmpdir(), "isocan-eval-auth-check-"));
    const invocation = modelInvocation(1 / MODEL_SPEC.maxCalls, inherited);
    const options = { cwd, env: invocation.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 };
    const version = run(invocation.command, ["--version"], options).trim();
    const help = run(invocation.command, ["--help"], options);
    const required = ["--safe-mode", "--tools", "--strict-mcp-config", "--max-budget-usd", "--effort", "--setting-sources"];
    if (required.some(flag => !help.includes(flag))) return { available: false, version, reason: "CLI lacks a required isolation/budget flag." };
    const isolationArgs = invocation.args.slice(invocation.args.indexOf("--tools"));
    let authOutput, authExit = 0;
    try { authOutput = run(invocation.command, [...isolationArgs, "auth", "status", "--json"], options); }
    catch (error) { authOutput = error.stdout ?? ""; authExit = error.status ?? null; }
    const auth = sanitizeAuthStatus(authOutput, authExit);
    return { available: auth.available && auth.loggedIn === true, ...(auth.available && auth.loggedIn === true ? {} : { reason: "Authentication is unavailable in the actual isolated invocation environment." }), version, helpSha256: sha(help), model: MODEL_SPEC, auth,
      isolation: { flags: isolationArgs, environmentKeys: Object.keys(invocation.env).sort(), workingDirectory: "fresh empty scratch" },
      contextBoundary: "Safe mode disables local customizations; admin-managed provider policy may still apply. Ordinary OS USER/HOME discovery is preserved; credentials are not copied or retained in evidence.", budgetBoundary: "CLI-reported estimated/API-equivalent token cost; admin-managed modelPricing can affect rates. Not billing evidence. Actual provider cap enforcement remains unmeasured." };
  } catch { return { available: false, reason: "Claude CLI preflight unavailable.", model: MODEL_SPEC }; }
  finally { if (cwd) rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

/** Labelled canned candidates are the only provider reachable from dry-run mode. */
export async function cannedCandidate({ task, round }) {
  const html = task.id === "card-spacing" && round === 1 ? task.initialHtml : task.repairedHtml;
  return { provider: "canned-dry-run", modelCalls: 0, candidateText: JSON.stringify({ html }), usage: null, apiEquivalentCost: null, billedSpend: null, elapsedMs: 0, stopReason: null };
}

/** The caller must explicitly choose model mode; one subprocess, one turn and no retries. */
export async function invokeModel({ prompt, allowance, approvedModelMode }) {
  if (approvedModelMode !== true) throw new Error("Model invocation requires explicit model mode and an approved budget.");
  const cwd = await mkdtemp(path.join(tmpdir(), "isocan-eval-model-"));
  const invocation = modelInvocation(allowance), started = performance.now();
  try {
    const result = await new Promise(resolve => {
      const proc = spawn(invocation.command, invocation.args, { cwd, env: invocation.env, stdio: ["pipe", "pipe", "pipe"] });
      const capture = outputCapture(); let stderrBytes = 0, failed = false;
      const timeout = setTimeout(() => { failed = true; proc.kill("SIGKILL"); }, 180_000);
      proc.stdout.on("data", bytes => { try { capture.append(bytes); } catch { failed = true; proc.kill("SIGKILL"); } });
      proc.stderr.on("data", bytes => { stderrBytes += bytes.length; });
      proc.on("error", () => { failed = true; });
      proc.on("close", (exitCode, signal) => { clearTimeout(timeout); resolve({ stdout: capture.bytes(), exitCode: failed ? null : exitCode, signal, stderrBytes, elapsedMs: performance.now() - started }); });
      proc.stdin.on("error", () => {}); proc.stdin.end(prompt);
    });
    return { provider: "claude-cli", modelCalls: 1, ...inspectProviderOutput(result), stderrBytes: result.stderrBytes, invocation: { command: invocation.command, args: invocation.args, fixedEnv: Object.fromEntries(Object.entries(invocation.env).filter(([key]) => key.startsWith("CLAUDE_"))), promptSha256: sha(prompt), workingDirectory: "fresh empty scratch", contextBoundary: "Admin-managed provider policy may still apply." } };
  } finally { await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}
