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
import { readFileSync, writeFileSync } from "node:fs";

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
        agentInfo: { name: "fake-acp", version: "0.0.1" },
      },
    });
  } else if (method === "session/new") {
    const sessions = known();
    const sessionId = `sess_fake_${sessions.length + 1}`;
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
    const pid = permissionId++;
    const answered = new Promise((resolve) => awaitingPermission.set(pid, resolve));
    send({
      jsonrpc: "2.0",
      id: pid,
      method: "session/request_permission",
      params: {
        sessionId: params.sessionId,
        toolCall: { toolCallId: "tool_1", title: "Bash" },
        options: [
          { optionId: "deny", name: "Deny", kind: "reject_once" },
          { optionId: "yes", name: "Yes", kind: "allow_once" },
        ],
      },
    });
    void answered.then((outcome) => {
      const text =
        `echo:${params.prompt?.[0]?.text ?? ""} ` +
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
