import { spawn, type ChildProcess } from "node:child_process";
import { harnessVars } from "@isocan/api";
import { readConfigFile } from "@isocan/server";

/**
 * **The ACP client in the rc** (agents-on-demand phase 3).
 *
 * The rc speaks Agent Client Protocol over stdio to a locally spawned
 * adapter — one adapter process per enrolled agent, its subprocess, the
 * person's credentials, because the rc runs as the person. Everything here
 * was verified against the real `@zed-industries/claude-code-acp` adapter
 * (the phase's spike, 2026-08-30; the record lives in the design doc):
 *
 * - Framing is newline-delimited JSON-RPC 2.0; `protocolVersion` is the
 *   integer 1; a finished turn answers `stopReason: "end_turn"`.
 * - `fs` and `terminal` are declared unsupported (the spec treats omitted
 *   as unsupported; we send them explicitly false) — the agent keeps its
 *   own disk and shell and does canvas work through the CLI it already
 *   knows. The spike confirmed the agent's own Bash runs fine regardless.
 * - `session/load` is a REAL resume handle: a fresh adapter process loads
 *   an old session, replays its history as `session/update` notifications,
 *   and the resumed conversation remembers. Even a session whose adapter
 *   was `kill -9`'d MID-TURN loaded on retry — the first attempt after a
 *   violent death can fail transiently ("Query closed before response
 *   received"), so `ensureSession` retries once and falls back to
 *   `session/new`, which is always available. The rc row's `sessionId` is
 *   therefore a best-effort handle, never a requirement.
 * - The adapter's shells inherit the ADAPTER's environment and nothing
 *   else — `CLAUDE_CODE_SESSION_ID` is NOT set inside them — so identity
 *   travels by injection: the rc sets `ISOCAN_HARNESS=agent` and
 *   `ISOCAN_SESSION_ID=<name>`, making the CLI inside present exactly the
 *   session key the enrolment claim minted (`agent:<name>`, `main.ts`'s
 *   enrol verb), and `ISOCAN_CANVAS=<canvasId>` so the CLI inside knows
 *   which canvas the summons is for without a directory binding. A CLI-added agent
 *   needs no rebinding at all; a web-added one needs a single idempotent
 *   `actor.claim { as }` on the machine badge, which the turn verb makes.
 * - The Claude adapter refuses to start inside a Claude Code session (the
 *   nested-session guard), and stale harness variables would misidentify
 *   the agent anyway — so the spawn env is scrubbed of every harness
 *   variable plus `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT` before injection.
 *
 * **Permissions are auto-allowed, provisionally.** The agent runs as the
 * person, in the person's directory, with the person's credentials — the
 * same trust as the person typing the harness's name themselves — and a
 * summoned session has nobody at a keyboard to ask. What a summoned agent
 * may do unattended is phase 4/5's door (a ceiling and a reason); this
 * module's policy is one function below, so the door has one thing to
 * change.
 */

/** `config.json`'s hook: `{"acpAdapters": {"my-harness": ["cmd", "arg"]}}`.
 * The same posture as `harnessVars`: a harness isocan has never heard of
 * works the day it ships. */
interface AcpAdapterConfig {
  acpAdapters?: Record<string, string[] | string>;
}

export interface AdapterSpec {
  command: string;
  args: string[];
}

/** Adapters isocan knows without being told. `npx -y` so the adapter is
 * fetched on first use rather than shipped — isocan must not own a copy of
 * somebody's harness bridge. */
const BUILTIN_ADAPTERS: Record<string, AdapterSpec> = {
  "claude-code": { command: "npx", args: ["-y", "@zed-industries/claude-code-acp"] },
};

/** The adapter for a harness — config first, then builtin. A null harness
 * ("not yet said", the rc half's default) runs the claude-code adapter:
 * something must answer, and this is the machine's most likely something.
 * Null when nothing is declared anywhere — the caller owes a refusal that
 * names the config hook. */
export async function adapterFor(home: string, harness: string | null): Promise<AdapterSpec | null> {
  const wanted = harness ?? "claude-code";
  const raw = await readConfigFile<AcpAdapterConfig>(home);
  const declared = raw.acpAdapters?.[wanted];
  if (typeof declared === "string" && declared.trim()) {
    const [command, ...args] = declared.trim().split(/\s+/);
    return { command: command!, args };
  }
  if (Array.isArray(declared) && declared.length > 0 && declared.every((p) => typeof p === "string")) {
    return { command: declared[0]!, args: declared.slice(1) };
  }
  return BUILTIN_ADAPTERS[wanted] ?? null;
}

/** The environment a spawned adapter gets: the person's, scrubbed of every
 * harness variable (a stale one would misidentify the agent; `CLAUDECODE`
 * trips the adapter's nested-session guard), then the injection that makes
 * the CLI inside speak as the enrolled actor. */
export function adapterEnv(canvasId: string, agentName: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of [...harnessVars, "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) delete env[name];
  env["ISOCAN_HARNESS"] = "agent";
  env["ISOCAN_SESSION_ID"] = agentName;
  // Which canvas this summons is FOR travels beside the identity, read by the
  // CLI inside the way `--canvas` is (standing agents, phase 1): one agent may
  // stand on several canvases from one directory, so the working directory's
  // binding can no longer be the answer.
  env["ISOCAN_CANVAS"] = canvasId;
  return env;
}

/**
 * The session key the injected environment presents — and the exact key the
 * enrol verb claims, which is the whole trick.
 *
 * **Scoped to the NAME, not to a canvas** (standing agents, phase 1). It was
 * `agent:<canvasId>:<name>`, which made "Percy on a second canvas" a second
 * session key on the same badge — refused by the desk as a name already worn,
 * the same gate #89 hit. One machine answers for one Percy: the same key on
 * every canvas resumes the same actor, so enrolling the name elsewhere hands
 * the one Percy back, history intact, with no `as` and no vouch.
 */
export function enrolmentKey(agentName: string): string {
  return `agent:${agentName}`;
}

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

export interface TurnEvent {
  /** "chunk" carries agent-authored text; the rest are narration beats. */
  kind: "chunk" | "thought" | "tool" | "permission" | "other";
  text?: string;
  detail?: string;
}

export class AcpAgentProcess {
  private child: ChildProcess;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, (msg: JsonRpcMessage) => void>();
  private onEvent: ((event: TurnEvent) => void) | null = null;
  /** Rejects every in-flight request when the adapter dies — a turn must
   * fail loudly, never hang on a process that is gone. */
  private died: ((reason: Error) => void)[] = [];

  private constructor(child: ChildProcess) {
    this.child = child;
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => this.receive(chunk));
    child.on("close", (code) => {
      const err = new Error(`the adapter exited (code ${code ?? "?"}) mid-conversation`);
      for (const reject of this.died.splice(0)) reject(err);
    });
  }

  /** Spawn and complete the initialize handshake. `stderr` is passed through
   * to ours: the adapter's own complaints are part of the narration. */
  static async spawn(
    spec: AdapterSpec,
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ): Promise<AcpAgentProcess> {
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "inherit"],
    });
    const agent = new AcpAgentProcess(child);
    await agent.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    return agent;
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (!line.trim()) continue;
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line) as JsonRpcMessage;
      } catch {
        continue; // not ours to interpret; the log of record is the adapter's
      }
      if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
        const settle = this.pending.get(msg.id);
        if (settle) {
          this.pending.delete(msg.id);
          settle(msg);
        }
      } else if (msg.method !== undefined && msg.id !== undefined) {
        this.answer(msg);
      } else if (msg.method === "session/update") {
        this.update(msg.params?.update);
      }
    }
  }

  /** Agent-to-client requests. Permission is the one we grant (see the
   * module comment — provisional, phase 4/5's door); everything else is
   * declared unsupported, matching the capabilities we sent. */
  private answer(msg: JsonRpcMessage): void {
    if (msg.method === "session/request_permission") {
      const options: Array<{ optionId?: string; name?: string; kind?: string }> =
        msg.params?.options ?? [];
      const allow =
        options.find((o) => /allow/i.test(`${o.kind ?? ""} ${o.optionId ?? ""} ${o.name ?? ""}`)) ??
        options[0];
      this.onEvent?.({
        kind: "permission",
        detail: `${msg.params?.toolCall?.title ?? "a tool"} → ${allow?.optionId ?? "?"}`,
      });
      this.send({
        jsonrpc: "2.0",
        id: msg.id!,
        result: { outcome: { outcome: "selected", optionId: allow?.optionId } },
      });
      return;
    }
    this.send({
      jsonrpc: "2.0",
      id: msg.id!,
      error: { code: -32601, message: `${msg.method} is not supported by this client` },
    });
  }

  private update(update: any): void {
    if (!update) return;
    const kind = update.sessionUpdate as string | undefined;
    if (kind === "agent_message_chunk") {
      this.onEvent?.({ kind: "chunk", text: String(update.content?.text ?? "") });
    } else if (kind === "agent_thought_chunk") {
      this.onEvent?.({ kind: "thought" });
    } else if (kind === "tool_call" || kind === "tool_call_update") {
      this.onEvent?.({ kind: "tool", detail: String(update.title ?? update.toolCallId ?? "") });
    } else {
      this.onEvent?.({ kind: "other", detail: kind ?? "" });
    }
  }

  private send(msg: JsonRpcMessage): void {
    this.child.stdin!.write(`${JSON.stringify(msg)}\n`);
  }

  private request(method: string, params: unknown, timeoutMs = 120_000): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.died.push(reject);
      // unref: a deadline must never be what keeps the process alive after
      // the turn is done and the adapter is closed.
      const deadline = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method}: the adapter gave no answer in ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);
      deadline.unref();
      this.pending.set(id, (msg) => {
        clearTimeout(deadline);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  /**
   * A session to prompt: load the stored one, or make a new one. The spike's
   * two facts shape this: load genuinely resumes (history and all), and the
   * first load after a violent death can fail transiently — so one retry,
   * then `session/new`, which cannot fail for want of history. Returns which
   * way it went so the caller can narrate and re-store the id.
   */
  async ensureSession(
    cwd: string,
    previous: string | null,
  ): Promise<{ sessionId: string; resumed: boolean }> {
    if (previous) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await this.request("session/load", { sessionId: previous, cwd, mcpServers: [] });
          return { sessionId: previous, resumed: true };
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    const created = await this.request("session/new", { cwd, mcpServers: [] });
    return { sessionId: created.sessionId as string, resumed: false };
  }

  /** One turn: prompt, stream events, return the stop reason and the
   * agent's collected text. A ten-minute ceiling — a turn is minutes, and
   * an adapter that answers nothing for ten is not going to. */
  async prompt(
    sessionId: string,
    text: string,
    onEvent?: (event: TurnEvent) => void,
  ): Promise<{ stopReason: string; text: string }> {
    const collected: string[] = [];
    this.onEvent = (event) => {
      if (event.kind === "chunk" && event.text) collected.push(event.text);
      onEvent?.(event);
    };
    try {
      const result = await this.request(
        "session/prompt",
        { sessionId, prompt: [{ type: "text", text }] },
        600_000,
      );
      return { stopReason: String(result?.stopReason ?? "?"), text: collected.join("") };
    } finally {
      this.onEvent = null;
    }
  }

  close(): void {
    this.child.kill();
  }
}
