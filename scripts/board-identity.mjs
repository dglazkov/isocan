/**
 * **The board is its own collaborator, whoever set it off.**
 *
 * A git hook inherits the environment of whatever process committed — which in
 * a repo with several agents working in it is *another agent's session*. The
 * CLI then acts as that agent, and on this machine that failed eleven times out
 * of eleven with `"Kenny" is taken here`: the board had never once updated from
 * a commit, and said so only into a log nobody was reading.
 *
 * It matters twice, and the second time is easier to miss. **`isocan wait` never
 * wakes you on your own ops** — so a watcher parked as the person who launched
 * it is blind to exactly the changes that person makes, which is most of them.
 * Parking as the board is what makes the watch see everything.
 *
 * So the identity is pinned rather than inherited: every harness variable the
 * CLI could be recognised by is cleared — the four it ships with, plus anything
 * this machine declared in `~/.isocan/config.json` — and `ISOCAN_SESSION_ID` is
 * set to one stable key. *Deliberate beats ambient* is the CLI's own rule
 * (`packages/api/src/harness.ts`); clearing the rest is belt, because which
 * leaked session *is* this process is settled by the registry rather than by
 * the environment.
 *
 * One copy, imported by both scripts. Two copies of this would drift, and the
 * drift would look exactly like the bug it fixes.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Stable across every run, so the board is one actor rather than a crowd. */
export const BOARD_SESSION = process.env.ISOCAN_BOARD_SESSION ?? "isocan-board";

/** What `isocan identity --name` was given, for the message when it is absent. */
export const BOARD_NAME = "Board";

/**
 * The same identity as a STATED ARGUMENT — what the ported board hands
 * `connect()` (iso-api phase 2). One key, spelled once: `boardEnv` below is
 * this fact expressed as environment for the scripts that still spawn the CLI
 * (the watcher), and this is it expressed as a parameter for the one that no
 * longer does. The claim gesture is unchanged either way:
 * `ISOCAN_HARNESS=board ISOCAN_SESSION_ID=isocan-board isocan identity --name Board --session`.
 */
export const BOARD_IDENTITY = { session: BOARD_SESSION, harness: "board" };

const BUILTIN_HARNESS_VARS = [
  "CLAUDE_CODE_SESSION_ID",
  "CODEX_THREAD_ID",
  "PI_SESSION_ID",
  "ANTIGRAVITY_CONVERSATION_ID",
];

/** Also whatever this machine declared, so a home that taught isocan a new
 *  harness does not quietly re-introduce the bug this file exists for. */
function declaredHarnessVars() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(homedir(), ".isocan", "config.json"), "utf8"));
    return Object.values(cfg.harnessVars ?? {}).filter((v) => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * The environment every `isocan` call in the board and its watcher should use.
 * `asMe` opts out, for a person who wants a manual run to be theirs.
 */
export function boardEnv(asMe = false, env = process.env) {
  if (asMe) return env;
  const out = { ...env };
  for (const v of [...BUILTIN_HARNESS_VARS, ...declaredHarnessVars()]) delete out[v];
  out.ISOCAN_SESSION_ID = BOARD_SESSION;
  out.ISOCAN_HARNESS = "board";
  return out;
}
