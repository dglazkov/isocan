/**
 * **Antigravity's half of the tie** (`docs/projects/antigravity/design.md` §9–§10).
 *
 * `workspace.mjs` knows the canvas; this file knows the conversations. Three
 * things live here, all plain ESM for the same reason as its neighbour:
 *
 * - **`agentapi`**, the host's own CLI for conversations — the same binary the
 *   Sidecar SDK shells out to (`ANTIGRAVITY_AGENTAPI_EXE agentapi …`).
 * - **The conversations record**, `<isocan home>/antigravity-conversations.json`:
 *   which Antigravity conversation became which actor on which canvas. The desk
 *   keeps that claim as `antigravity:<conversationId>` and never hands it back,
 *   so the hook writes down what it named and the pane and the relay read it.
 * - **What the relay hands a conversation** when the canvas mentions it.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// ---------- agentapi ----------

/** How to run `agentapi`: the language server's own executable when the host
 * names it (the SDK's preference — no PATH shim, no shell), else the shim. */
export function agentapiCommand(env = process.env) {
  const exe = text(env.ANTIGRAVITY_AGENTAPI_EXE);
  return exe ? { command: exe, prefix: ["agentapi"] } : { command: "agentapi", prefix: [] };
}

/** One `agentapi` call, its JSON answer parsed (`{}` for silence). A failure
 * throws with the tool's own last words. */
export function runAgentapi(args, { env = process.env, projectId = null, timeoutMs = 30_000 } = {}) {
  const { command, prefix } = agentapiCommand(env);
  const childEnv = { ...env, ...(projectId ? { ANTIGRAVITY_PROJECT_ID: projectId } : {}) };
  return new Promise((resolve, reject) => {
    execFile(command, [...prefix, ...args], { env: childEnv, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) {
        const said = `${stderr ?? ""}`.trim().split("\n").slice(-2).join(" ").trim();
        return reject(new Error(`agentapi ${args[0]}: ${err.killed ? "timed out" : said || err.message}`));
      }
      let out;
      try {
        out = stdout.trim() ? JSON.parse(stdout) : {};
      } catch {
        return resolve({ raw: stdout.trim() });
      }
      // agentapi can exit 0 and still say it failed, in the body.
      if (out && typeof out.error === "string" && out.error) return reject(new Error(`agentapi ${args[0]}: ${out.error}`));
      resolve(out);
    });
  });
}

/** The project a conversation belongs to, read the way the SDK's preload
 * reads it — both spellings, and "" when the host will not say. */
export function projectIdOf(metadata) {
  const event = metadata?.response?.conversationMetadata ?? metadata?.response?.conversation_metadata;
  const meta = event?.metadata;
  return text(meta?.projectId) ?? text(meta?.project_id) ?? "";
}

// ---------- the conversations record ----------

export const CONVERSATIONS_FILE = "antigravity-conversations.json";

/** How long a conversation is believed to still be somebody's. Past this the
 * relay stops parking for it: a conversation from last week is not waiting. */
export const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

export function readConversations(home) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(home, CONVERSATIONS_FILE), "utf8"));
    const list = raw?.conversations;
    if (!list || typeof list !== "object") return {};
    const out = {};
    for (const [conversationId, row] of Object.entries(list)) {
      if (!text(conversationId) || !row || typeof row !== "object") continue;
      const canvasId = text(row.canvasId);
      const root = text(row.root);
      if (!canvasId || !root) continue;
      out[conversationId] = {
        canvasId,
        root,
        actorId: text(row.actorId),
        name: text(row.name),
        title: text(row.title),
        at: typeof row.at === "number" ? row.at : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Write one conversation's row (or drop it, with `row: null`). Rows past the
 * TTL are swept on every write, so the file cannot grow without bound. The
 * write is a rename, so a reader never sees half a file. */
export function recordConversation(home, conversationId, row, now = Date.now()) {
  const all = readConversations(home);
  if (row) all[conversationId] = { ...all[conversationId], ...row, at: now };
  else delete all[conversationId];
  for (const [id, r] of Object.entries(all)) if (now - r.at > CONVERSATION_TTL_MS) delete all[id];
  fs.mkdirSync(home, { recursive: true });
  const file = path.join(home, CONVERSATIONS_FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ conversations: all }, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return all;
}

/** The live conversations on one canvas, newest first. */
export function conversationsOn(home, canvasId, now = Date.now()) {
  return Object.entries(readConversations(home))
    .filter(([, r]) => r.canvasId === canvasId && now - r.at <= CONVERSATION_TTL_MS)
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([conversationId, r]) => ({ conversationId, ...r }));
}

// ---------- what the relay hands a conversation ----------

const canvasName = (canvas) =>
  canvas?.title ? `"${canvas.title}" (${canvas.canvasId})` : (canvas?.canvasId ?? "this workspace's canvas");

/**
 * What the relay hands a conversation when the canvas asked for it: the
 * wake exactly as `isocan wait` printed it — written for an agent already —
 * with one line in front saying where it came from and one after saying how
 * to answer, because this conversation did not park and does not know it
 * was woken.
 */
export function relayMessage({ woke, canvas, name }) {
  return [
    `The isocan canvas ${canvasName(canvas)} has something for you${text(name) ? ` (${text(name)})` : ""} — somebody there mentioned you or replied in your thread:`,
    "",
    text(woke) ?? "(the wake said nothing — `isocan comment ls` shows the threads)",
    "",
    "Answer it ON THE CANVAS with `isocan comment reply <thread> \"…\"` — the person who wrote it is reading the canvas, not this chat. If it asks for work, do it, then reply there. You do not need to run `isocan wait`; the Isocan Canvas pane passes the next one on.",
  ].join("\n");
}
