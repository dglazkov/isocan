/**
 * **The relay: the canvas can reach a Jetski conversation** (`docs/projects/
 * jetski/design.md` §10).
 *
 * A Jetski conversation arrives on its canvas under its own name (the
 * SessionStart hook) and is told not to park — the person steers it in the
 * chat, and a conversation blocked on `isocan wait` cannot be talked to. So
 * until this, somebody on the canvas writing `@Kit can you tighten the
 * header?` was writing to nobody: the face was there and the ear was not.
 *
 * The relay is the ear. The pane's sidecar process — which runs for as long
 * as Jetski does — parks `isocan wait` AS each recent conversation (its own
 * `ANTIGRAVITY_CONVERSATION_ID`, so the daemon's cursor, the wake rules and
 * the "waiting for you…" presence are that conversation's), and when a wait
 * wakes it hands what `isocan wait` printed to the conversation with
 * `agentapi send-message`. It decides nothing: which comments wake whom is
 * the daemon's rule, identical to a parked agent's, and the words are the
 * CLI's.
 *
 * Its bounds, each for a reason:
 *
 * - **One relay per machine** (`jetski-relay.lock`): two parks for one actor
 *   displace each other (exit 3), so two sidecars would ping-pong forever.
 * - **The conversation's own park wins.** If the agent parks itself, the
 *   relay's wait exits 3 and the relay stands back for `DISPLACED_BACKOFF_MS`.
 * - **Only recent conversations** (`CONVERSATION_TTL_MS`), and at most
 *   `MAX_PARKS` of them, newest first. A conversation Jetski no longer knows,
 *   or one the canvas withdrew (exit 4), is dropped from the record.
 * - **`ISOCAN_JETSKI_RELAY=off`** switches it off.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CONVERSATION_TTL_MS, projectIdOf, readConversations, recordConversation, relayMessage, runAgentapi } from "./jetski.mjs";
import { agentEnv, resolveCli } from "./workspace.mjs";

export const MAX_PARKS = 6;
/** Long enough that a park rarely laps; `isocan wait` holds presence while it
 * runs and retracts it on the way out, so every lap is a blink of the face. */
export const PARK_SECONDS = 1500;
export const DISPLACED_BACKOFF_MS = 5 * 60_000;
export const FAILURE_BACKOFF_MS = 60_000;
export const LOCK_FILE = "jetski-relay.lock";

/** Run `isocan wait` and hand back its exit code and output, never throwing
 * for a non-zero exit: 2 (silence), 3 (displaced) and 4 (over) are answers. */
export function runWait(args, { cwd, env, timeoutMs }) {
  const cli = resolveCli(env);
  if (!cli) return Promise.resolve({ code: 127, stdout: "", stderr: "the isocan CLI is not on this machine" });
  return new Promise((resolve) => {
    execFile(
      cli.command,
      [...cli.prefix, ...args],
      { cwd, env, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
        resolve({ code, stdout: stdout ?? "", stderr: stderr ?? "" });
      },
    );
  });
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

/** Take the machine's relay lock, or say who has it. A lock whose process is
 * gone is taken over. */
export function takeLock(home, pid = process.pid) {
  const file = path.join(home, LOCK_FILE);
  try {
    const held = Number(fs.readFileSync(file, "utf8").trim());
    if (held && held !== pid && alive(held)) return false;
  } catch { /* no lock yet */ }
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(file, String(pid));
  return true;
}

export function releaseLock(home, pid = process.pid) {
  const file = path.join(home, LOCK_FILE);
  try {
    if (Number(fs.readFileSync(file, "utf8").trim()) === pid) fs.rmSync(file);
  } catch { /* already gone */ }
}

/**
 * The relay, over injected doors so a test can drive it lap by lap:
 * `wait(conversation)` parks and resolves `{ code, stdout }`, `send(id,
 * message)` delivers. `tick()` starts a park for every conversation that
 * should have one and has none; the returned promise of each park is kept in
 * `parks` so a test can await it.
 */
export function createRelay({
  home,
  env = process.env,
  now = Date.now,
  wait = (c) =>
    runWait(["wait", "--timeout", String(PARK_SECONDS)], {
      cwd: c.root,
      env: agentEnv(env, home, c.conversationId),
      timeoutMs: (PARK_SECONDS + 60) * 1000,
    }),
  send = async (conversationId, message) => {
    const meta = await runAgentapi(["get-conversation-metadata", conversationId], { env }).catch(() => null);
    return runAgentapi(["send-message", "--title=From the isocan canvas", conversationId, message], {
      env,
      projectId: projectIdOf(meta) || null,
    });
  },
  log = () => {},
} = {}) {
  const parks = new Map();
  const resting = new Map();
  const delivered = [];

  function wanted() {
    const all = readConversations(home);
    return Object.entries(all)
      .map(([conversationId, r]) => ({ conversationId, ...r }))
      // Only a conversation the hook has named: parking for one it has not
      // would make the CLI claim an identity nobody asked for.
      .filter((c) => c.actorId && now() - c.at <= CONVERSATION_TTL_MS)
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_PARKS);
  }

  async function lap(c) {
    const out = await wait(c);
    if (out.code === 0 && out.stdout.trim()) {
      const canvas = { canvasId: c.canvasId, title: c.title };
      try {
        await send(c.conversationId, relayMessage({ woke: out.stdout, canvas, name: c.name }));
        delivered.push({ conversationId: c.conversationId, at: now() });
        log(`relayed a wake to ${c.name ?? c.conversationId}`);
      } catch (err) {
        const said = err instanceof Error ? err.message : String(err);
        log(`could not hand ${c.conversationId} its wake: ${said}`);
        // A conversation the host does not know any more is not coming back.
        if (/not found|no such|unknown conversation|does not exist/i.test(said)) recordConversation(home, c.conversationId, null, now());
        else resting.set(c.conversationId, now() + FAILURE_BACKOFF_MS);
      }
    } else if (out.code === 3) {
      // The conversation parked itself: its own wait is the better ear.
      resting.set(c.conversationId, now() + DISPLACED_BACKOFF_MS);
    } else if (out.code === 4) {
      recordConversation(home, c.conversationId, null, now());
      log(`${c.name ?? c.conversationId}'s canvas let it go; no longer relaying for it`);
    } else if (out.code !== 0 && out.code !== 2) {
      resting.set(c.conversationId, now() + FAILURE_BACKOFF_MS);
      log(`wait for ${c.name ?? c.conversationId} exited ${out.code}: ${out.stderr.trim().split("\n").pop() ?? ""}`);
    }
  }

  function tick() {
    for (const c of wanted()) {
      if (parks.has(c.conversationId)) continue;
      if ((resting.get(c.conversationId) ?? 0) > now()) continue;
      const running = lap(c).finally(() => parks.delete(c.conversationId));
      parks.set(c.conversationId, running);
    }
    return [...parks.values()];
  }

  return { tick, parks, resting, delivered };
}

/**
 * Start the relay for the life of this process: take the lock (or keep
 * asking for it, in case the holder goes away), and tick every few seconds
 * so a conversation the hook just recorded gets its ear within one tick.
 * Returns a stop function.
 */
export function startRelay({ home, env = process.env, log = (line) => console.log(`isocan relay: ${line}`), everyMs = 5_000 } = {}) {
  if (env.ISOCAN_JETSKI_RELAY === "off") return () => {};
  let relay = null;
  const timer = setInterval(() => {
    if (!relay) {
      if (!takeLock(home)) return;
      relay = createRelay({ home, env, log });
      log("listening for the canvas on behalf of this machine's Jetski conversations");
    }
    relay.tick();
  }, everyMs);
  timer.unref?.();
  const stop = () => {
    clearInterval(timer);
    releaseLock(home);
  };
  process.once("exit", stop);
  return stop;
}
