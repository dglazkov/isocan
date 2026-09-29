/**
 * What the SessionStart hook and the canvas sidecar both need to know about
 * the workspace Jetski has open: which canvas it is bound to, how to reach
 * the `isocan` CLI, and whose name a command runs under.
 *
 * Plain ESM with no dependencies, on purpose. It runs under whatever Node
 * Jetski provides, from a plugin directory that is usually a symlink into
 * this repo — so it cannot import the TypeScript it mirrors. Where it
 * mirrors (`findBinding`, the harness variables), `test/jetski-plugin.test.ts`
 * holds it to the original.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** `packages/server/src/paths.ts` `isocanHome`. */
export function isocanHome(env = process.env) {
  return env.ISOCAN_HOME ?? path.join(os.homedir(), ".isocan");
}

const canon = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

/** `packages/server/src/binding.ts` `readMarker`: `projectId` (or
 * `canvasId`), and a `home` that is present but unusable rejects the file. */
function readMarker(dir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, ".isocan", "project.json"), "utf8"));
    const canvasId = raw.projectId ?? raw.canvasId;
    if (typeof canvasId !== "string" || canvasId.length === 0) return null;
    if (raw.home !== undefined && (typeof raw.home !== "string" || raw.home.trim() === "")) return null;
    return {
      canvasId,
      ...(typeof raw.title === "string" && raw.title ? { title: raw.title } : {}),
      ...(typeof raw.home === "string" ? { home: raw.home.trim() } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * `packages/server/src/binding.ts` `findBinding`: the nearest marker at or
 * above `cwd`, never in the user's home directory, the filesystem root, or
 * the directory whose `.isocan` IS the isocan home, and never above the
 * user's home.
 */
export function findBinding(cwd, home) {
  const isocan = canon(home);
  const userHome = canon(os.homedir());
  let dir = canon(cwd);
  for (;;) {
    const excluded = dir === userHome || path.dirname(dir) === dir || path.join(dir, ".isocan") === isocan;
    if (!excluded) {
      const marker = readMarker(dir);
      if (marker) return { root: dir, ...marker };
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return null;
    dir = parent;
  }
}

/** Absolute paths from what the host hands over: the hook's
 * `workspacePaths` or the pane's `file://` workspace URIs. Anything that is
 * not a local absolute path is dropped rather than guessed at — a relative
 * one would be read against wherever the host started us, which for the
 * hook is this plugin's own directory, inside a repo that is itself bound. */
export function workspacePaths(list) {
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) return [];
    const raw = entry.trim();
    if (raw.startsWith("file:")) {
      try {
        return [fileURLToPath(raw)];
      } catch {
        return [];
      }
    }
    return path.isAbsolute(raw) ? [path.resolve(raw)] : [];
  });
}

/** The first workspace folder that is bound, with the folder it was found
 * from — or null, and nothing else is looked at: not this plugin's own
 * directory, and not the cwd a host happened to start us in. */
export function bindingFor(paths, home) {
  for (const workspace of paths) {
    const found = findBinding(workspace, home);
    if (found) return { ...found, workspace };
  }
  return null;
}

/**
 * Every variable `packages/api/src/harness.ts` reads to decide which agent
 * session is running a command, plus any a person declared in
 * `config.json`'s `harnessVars`.
 */
const HARNESS_VARS = [
  "ISOCAN_SESSION_ID",
  "ISOCAN_HARNESS",
  "CLAUDE_CODE_SESSION_ID",
  "CODEX_THREAD_ID",
  "PI_SESSION_ID",
  "ANTIGRAVITY_CONVERSATION_ID",
];

function declaredHarnessVars(home) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(home, "config.json"), "utf8"));
    return Object.values(config?.harnessVars ?? {}).filter((v) => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * The environment for a command the PERSON is giving — minting the pane's
 * pass, enrolling an agent. Every harness session variable is removed, so
 * the CLI resolves this machine's person rather than whichever conversation
 * started Jetski; and `ISOCAN_CANVAS`, so the workspace's own marker decides
 * the canvas.
 */
export function personEnv(env, home) {
  const out = { ...env };
  for (const name of [...HARNESS_VARS, ...declaredHarnessVars(home), "ISOCAN_CANVAS"]) delete out[name];
  return out;
}

/** The environment for a command the Jetski conversation gives as ITSELF:
 * the person's, plus exactly one session variable — the one Jetski exports
 * into that conversation's own shell, so both resolve the same actor. */
export function agentEnv(env, home, conversationId) {
  return { ...personEnv(env, home), ANTIGRAVITY_CONVERSATION_ID: conversationId };
}

function onPath(bin, env) {
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

/**
 * How to run the CLI: `ISOCAN_CLI` when set, else `isocan` on the PATH,
 * else this checkout's own `packages/cli/bin/isocan.js` when the plugin is
 * being run from inside the repo. Null when none of those exist. A `.js`
 * file runs under the PATH's `node` — what the `isocan` shim itself would
 * use — and only without one under whatever node is running this, which
 * inside Jetski may be the host's bundled one.
 */
export function resolveCli(env = process.env) {
  const viaNode = (file) => ({ command: onPath("node", env) ?? process.execPath, prefix: [file] });
  if (env.ISOCAN_CLI) return /\.[cm]?js$/.test(env.ISOCAN_CLI) ? viaNode(env.ISOCAN_CLI) : { command: env.ISOCAN_CLI, prefix: [] };
  const found = onPath("isocan", env);
  if (found) return { command: found, prefix: [] };
  const repoBin = fileURLToPath(new URL("../../../packages/cli/bin/isocan.js", import.meta.url));
  return fs.existsSync(repoBin) ? viaNode(repoBin) : null;
}

/**
 * Run one CLI command and hand back its output. A failure throws with the
 * CLI's own last words, which are written for a reader.
 */
export function runIsocan(args, { cwd, env, timeoutMs = 20_000 }) {
  const cli = resolveCli(env);
  if (!cli) {
    return Promise.reject(
      new Error("the isocan CLI is not on this machine's PATH — `npm i -g github:dglazkov/isocan#release`, or set ISOCAN_CLI"),
    );
  }
  return new Promise((resolve, reject) => {
    execFile(
      cli.command,
      [...cli.prefix, ...args],
      { cwd, env, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (!err) return resolve({ stdout, stderr });
        const said = `${stderr ?? ""}`.trim().split("\n").slice(-3).join(" ").trim();
        const why = err.killed ? `timed out after ${Math.round(timeoutMs / 1000)}s` : said || err.message;
        reject(new Error(`isocan ${args.filter((a) => !a.startsWith("--json")).join(" ")}: ${why}`));
      },
    );
  });
}
