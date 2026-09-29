#!/usr/bin/env node
/**
 * **SessionStart: a new Jetski conversation in a bound workspace arrives on
 * its canvas.** (`docs/projects/jetski/design.md` §5, phase 2.)
 *
 * Jetski runs this once, before the first model call of a fresh
 * conversation, with the plugin directory as the cwd and a flat JSON object
 * on stdin (`conversationId`, `workspacePaths`, …). What it prints is parsed
 * strictly as a `SessionStartHookResult`: `{"injectSteps":[…]}` or nothing.
 *
 * In a workspace bound to a canvas it does what the agent guide's first
 * steps say an arriving agent does — `isocan identity --session`, then
 * `isocan session start` — as the conversation itself (the session variable
 * Jetski exports into that conversation's shell), and then tells the
 * conversation, in one ephemeral message, where it is and what it is called.
 * `ISOCAN_JETSKI_JOIN=off` keeps the message and skips the joining.
 *
 * In any other workspace it prints nothing: a plugin that talked in every
 * conversation would be a plugin people turn off.
 *
 * It never fails the conversation. Whatever goes wrong is said in the
 * message, and the exit code is always 0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentEnv, bindingFor, isocanHome, runIsocan, workspacePaths } from "../lib/workspace.mjs";

const PILL = "[Isocan Canvas](sidecar://isocan/canvas/)";

const messageOf = (err) => (err instanceof Error ? err.message : String(err));

/** `isocan identity --session` says `identity saved: NAME (ID) → FILE (HARNESS session)`. */
export function claimedName(stdout) {
  const m = /^identity saved: (.+) \(([^()]+)\) → /m.exec(stdout ?? "");
  return m ? m[1].trim() : null;
}

/**
 * The hook's whole decision, given its stdin and environment. Returns the
 * object to print, or null for "say nothing".
 */
export async function sessionStart(input, { env = process.env, run = runIsocan } = {}) {
  // SessionStart's input never carries `invocationNum`. A call that does is
  // some other event — a host still holding an older hooks.json that wired
  // this script to PreInvocation, which fires before EVERY model call — and
  // joining again on each one would churn a session per turn.
  if (input && typeof input === "object" && "invocationNum" in input) return null;
  const home = isocanHome(env);
  const binding = bindingFor(workspacePaths(input?.workspacePaths), home);
  if (!binding) return null;

  const canvas = binding.title ? `"${binding.title}" (${binding.canvasId})` : binding.canvasId;
  const marker = path.join(binding.root, ".isocan", "project.json");
  const lines = [`isocan: this workspace is bound to the canvas ${canvas} by ${marker}.`];

  const conversationId = (typeof input?.conversationId === "string" && input.conversationId) || env.ANTIGRAVITY_CONVERSATION_ID || "";
  if (env.ISOCAN_JETSKI_JOIN === "off") {
    lines.push(
      "Joining it is switched off here (ISOCAN_JETSKI_JOIN=off). When the work turns to the canvas, " +
        "`isocan identity --session` names you and `isocan session start` puts you on it.",
    );
  } else if (!conversationId) {
    lines.push("Jetski did not say which conversation this is, so nothing was joined; `isocan identity --session` names you.");
  } else {
    const opts = { cwd: binding.root, env: agentEnv(env, home, conversationId) };
    let named = false;
    let name = null;
    try {
      name = claimedName((await run(["identity", "--session"], { ...opts, timeoutMs: 15_000 })).stdout);
      named = true;
    } catch (err) {
      lines.push(
        `Naming you failed, so you are not on it yet: ${messageOf(err)}. ` +
          "`isocan identity --session` names you when the work turns to the canvas.",
      );
    }
    if (named) {
      const who =
        `You are ${name ?? "the name `isocan whoami` shows"} here — your own name, not the person's; ` +
        "`isocan whoami` in this conversation's shell answers with it.";
      try {
        await run(["session", "start", ...(name ? ["--label", `${name} 🤖`] : [])], { ...opts, timeoutMs: 10_000 });
        lines.push(`${who} You are on the canvas now; your presence lapses after a few idle minutes and any isocan command revives it.`);
      } catch (err) {
        lines.push(`${who} Your presence session did not start (${messageOf(err)}); \`isocan session start\` puts you on it.`);
      }
    }
  }
  lines.push(
    `The person can open the canvas beside this chat with ${PILL} — offer that link when the canvas is relevant.`,
    "Run `isocan --agent-help` once before acting on the canvas. This chat is where the person steers; the canvas " +
      "is the record. Do not park on `isocan wait` unless they ask.",
  );
  return { injectSteps: [{ ephemeralMessage: lines.join("\n") }] };
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/** Run as a script, not imported by a test. Real paths on both sides: the
 * plugin directory is usually a symlink into the repo, and Node resolves it
 * in `import.meta.url` but not in `argv[1]`. */
function invokedDirectly() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  let out = null;
  try {
    const raw = (await readStdin()).trim();
    out = await sessionStart(raw ? JSON.parse(raw) : {});
  } catch (err) {
    process.stderr.write(`isocan session-start: ${messageOf(err)}\n`);
  }
  if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
}
