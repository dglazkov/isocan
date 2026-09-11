// A scripted ACP agent for the phase-3 integration tests: speaks the wire
// shapes the spike verified against the real claude-code-acp adapter —
// newline-delimited JSON-RPC, protocolVersion 1, session/new + session/load,
// one permission request per prompt, agent_message_chunk updates, and
// `stopReason: "end_turn"`. Its reply text reports what a real agent could
// only be asked to reveal: the injected identity environment and whether the
// session was resumed — which is exactly what the tests must assert.
//
// Sessions persist to fake-acp-sessions.json in the cwd, so a second spawn
// can genuinely load what a first spawn created. FAKE_ACP_FAIL_FIRST_LOAD=1
// makes the first session/load of a process fail the way a violently killed
// session transiently does, to exercise the client's retry.
import { promises as fsp, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const STORE = "fake-acp-sessions.json";
const known = () => {
  try {
    return JSON.parse(readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
};

let buffer = "";
const loaded = new Set();
let failedALoad = false;
// FAKE_ACP_AUTH=<methodId>: advertise that one auth method and refuse
// session verbs until `authenticate` names it — and, for gemini-api-key,
// until GEMINI_API_KEY is in this process's environment, the way Google's
// server reads it. The Antigravity shape, scripted.
const authMethod = process.env.FAKE_ACP_AUTH ?? null;
let authenticated = authMethod === null;

// The failure modes journey 5 demands, drivable: a session that never
// starts, and one that dies mid-turn.
if (process.env.FAKE_ACP_CRASH === "boot") process.exit(1);
// FAKE_ACP_STDERR=absl: the stderr Google's Antigravity server writes —
// absl-format INFO and WARNING chatter, an absl ERROR, and a plain line —
// so the client's filter can be seen keeping the last two and not the first.
if (process.env.FAKE_ACP_STDERR === "absl") {
  process.stderr.write("I0904 20:46:34.517650 8367415680 local_connection.py:521] RAW WS MSG: {\"stepUpdate\":{}}\n");
  process.stderr.write("W0904 20:46:34.520097 8367415680 telemetry.py:431] No business auth manager configured\n");
  process.stderr.write("E0904 20:46:34.600000 8367415680 oauth_manager.py:288] Onboarding failed with terminal error\n");
  process.stderr.write("fake-acp: a plain complaint\n");
}
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
let permissionId = 1000;
const awaitingPermission = new Map();

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (!line.trim()) continue;
    handle(JSON.parse(line));
  }
});

function handle(msg) {
  if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
    const resume = awaitingPermission.get(msg.id);
    if (resume) {
      awaitingPermission.delete(msg.id);
      resume(msg.result);
    }
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: 1,
        agentCapabilities: { loadSession: true },
        agentInfo: { name: "fake-acp", title: "Fake", version: "0.0.1" },
        ...(authMethod ? { authMethods: [{ id: authMethod, name: authMethod }] } : {}),
      },
    });
  } else if (method === "authenticate") {
    if (params?.methodId !== authMethod) {
      send({ jsonrpc: "2.0", id, error: { code: -32602, message: `unknown auth method ${params?.methodId}` } });
    } else if (authMethod === "gemini-api-key" && !process.env.GEMINI_API_KEY) {
      send({ jsonrpc: "2.0", id, error: { code: -32602, message: "The GEMINI_API_KEY environment variable must be set" } });
    } else {
      authenticated = true;
      send({ jsonrpc: "2.0", id, result: {} });
    }
  } else if ((method === "session/new" || method === "session/load") && !authenticated) {
    send({ jsonrpc: "2.0", id, error: { code: -32000, message: "Authentication required" } });
  } else if (method === "session/new") {
    const sessions = known();
    const sessionId = `sess_fake_${process.pid}_${sessions.length + 1}`;
    sessions.push(sessionId);
    writeFileSync(STORE, JSON.stringify(sessions));
    send({ jsonrpc: "2.0", id, result: { sessionId } });
  } else if (method === "session/load") {
    if (process.env.FAKE_ACP_FAIL_FIRST_LOAD === "1" && !failedALoad) {
      failedALoad = true;
      send({ jsonrpc: "2.0", id, error: { code: -32603, message: "Query closed before response received" } });
    } else if (known().includes(params.sessionId)) {
      loaded.add(params.sessionId);
      send({ jsonrpc: "2.0", id, result: {} });
    } else {
      send({ jsonrpc: "2.0", id, error: { code: -32603, message: "unknown session" } });
    }
  } else if (method === "session/prompt") {
    if (process.env.FAKE_ACP_CRASH === "turn") process.exit(1); // died mid-turn
    const pid = permissionId++;
    const answered = new Promise((resolve) => awaitingPermission.set(pid, resolve));
    send({
      jsonrpc: "2.0",
      id: pid,
      method: "session/request_permission",
      params: {
        sessionId: params.sessionId,
        toolCall: { toolCallId: "tool_1", title: "Bash" },
        // The everyday shape, reject first so a client choosing by index
        // shows itself; or, under FAKE_ACP_PERMISSION=plan-exit, the
        // Claude adapter's plan-exit prompt — every option allow_always,
        // each a mode switch, bypass among them — plus its reject.
        options:
          process.env.FAKE_ACP_PERMISSION === "plan-exit"
            ? [
                { optionId: "exit-plan-auto", name: "Yes, and auto-approve", kind: "allow_always" },
                { optionId: "exit-plan-bypass", name: "Yes, and bypass permissions", kind: "allow_always" },
                { optionId: "exit-plan-default", name: "Yes, and ask", kind: "allow_always" },
                { optionId: "reject", name: "No", kind: "reject_once" },
              ]
            : [
                { optionId: "deny", name: "Deny", kind: "reject_once" },
                { optionId: "yes", name: "Yes", kind: "allow_once" },
              ],
      },
    });
    void answered.then(async (outcome) => {
      const promptText = params.prompt?.[0]?.text ?? "";
      // The dispatch tests' turn: linger (so presence can be observed
      // mid-turn), then answer the summoning thread THROUGH THE CLI, the
      // way a real summoned agent would — the reply lands as the enrolled
      // actor because the injected environment says who is speaking.
      const slow = Number(process.env.FAKE_ACP_SLOW_MS ?? 0);
      // A tool call mid-linger, on request: what the liveliness tests watch
      // the rc turn into a presence beat.
      const toolAt = Number(process.env.FAKE_ACP_TOOL_MS ?? 0);
      if (toolAt > 0) {
        setTimeout(() => {
          send({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
              sessionId: params.sessionId,
              update: { sessionUpdate: "tool_call", toolCallId: "tool_live", title: "Bash: isocan comment reply" },
            },
          });
        }, toolAt);
      }
      if (slow > 0) await new Promise((r) => setTimeout(r, slow));
      if (process.env.FAKE_ACP_REPLY === "1" && process.env.FAKE_ACP_CLI) {
        const threadId = promptText.match(/"threadId":\s*"([^"]+)"/)?.[1];
        const canvasId = promptText.match(/"canvasId":\s*"([^"]+)"/)?.[1];
        if (threadId && canvasId) {
          try {
            execFileSync(
              process.execPath,
              [process.env.FAKE_ACP_CLI, "--canvas", canvasId, "comment", "reply", threadId, "summoned: on it"],
              // `pipe`, not `ignore`: the CLI's own words about why it could
              // not reply are the only account of this failure that exists.
              { stdio: ["ignore", "pipe", "pipe"] },
            );
          } catch (err) {
            /**
             * **The turn still ends, but the failure is no longer silent.**
             *
             * This was a bare `catch {}` under a comment saying "the missing
             * reply is the test's failure" — and it made that failure
             * unreadable. A reply that does not land stops the chain dead, so
             * the cycle guard never fires and the test times out saying
             * "timed out waiting for the cycle guard": the one thing that was
             * not wrong. `dispatch.test.ts` has been failing that way on CI
             * for a week with no way to tell a stalled chain from a broken
             * reply.
             *
             * To stderr, because the rc's output is what the test captures and
             * what CI prints.
             */
            const why = err?.stderr?.toString?.().trim() || err?.message || String(err);
            process.stderr.write(`fake-acp: the reply to ${threadId} did not land — ${why}\n`);
          }
        }
      }
      // What a fenced adapter can still read, asked and answered in the
      // turn's own text: the sandbox test probes a canary in the person's
      // home, which a fence makes unreadable while the daemon stays
      // reachable. Absent, this says nothing.
      let probe = "";
      if (process.env.FAKE_ACP_PROBE) {
        probe = await fsp
          .readFile(process.env.FAKE_ACP_PROBE, "utf8")
          .then((read) => `read:${read.trim()}`)
          .catch((err) => `refused:${err.code ?? "?"}`);
      }
      const text =
        `echo:${promptText} ` +
        (probe ? `probe:${probe} ` : "") +
        `env:${process.env.ISOCAN_HARNESS ?? ""}:${process.env.ISOCAN_SESSION_ID ?? ""} ` +
        `resumed:${loaded.has(params.sessionId)} ` +
        `permission:${outcome?.outcome?.optionId ?? "?"}`;
      send({
        jsonrpc: "2.0",
        method: "session/update",
        params: { sessionId: params.sessionId, update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } },
      });
      send({ jsonrpc: "2.0", id, result: { stopReason: "end_turn" } });
    });
  } else if (id !== undefined) {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown: ${method}` } });
  }
}
