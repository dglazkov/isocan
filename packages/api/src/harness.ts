import { readConfigFile } from "@isocan/server";

/**
 * Which agent is running this command.
 *
 * Every coding harness exports a session id into the environment of the
 * commands it runs — its own name for "this conversation". None of them
 * agreed on a variable, but all of them do it, so one probe covers the field:
 * two agents in the SAME directory can tell themselves apart without either
 * being told anything — which nothing on the filesystem can ever do.
 *
 * The id is not an identity. It is fresh on every session, so binding an
 * actor to it directly would make an agent a stranger every morning — it is a
 * key into the registry in `identity.ts`, and nothing more.
 */

export interface HarnessSession {
  /** The harness that set it, e.g. "claude-code". */
  harness: string;
  /** Its id for this session — opaque, and fresh on every new one. */
  id: string;
  /** `<harness>:<id>`, the registry key. */
  key: string;
}

/** `config.json`'s hook: `{"harnessVars": {"my-agent": "MY_AGENT_SESSION"}}`.
 * A harness isocan has never heard of works the day it ships, not the day
 * isocan ships. */
export interface HarnessVarConfig {
  harnessVars?: Record<string, string>;
}

/**
 * The escape hatch, and the first thing looked at. Any harness, wrapper or
 * cron job opts in by exporting it, and a person can drive two actors from one
 * terminal with it. Deliberate beats ambient: when it is set alongside a
 * harness's own variable, this is the one that gets claimed.
 */
const OWN_VAR = "ISOCAN_SESSION_ID";
/** What to call the thing that set `ISOCAN_SESSION_ID`, for `whoami`. */
const OWN_HARNESS_VAR = "ISOCAN_HARNESS";

/**
 * Harnesses isocan knows without being told. Order is a tiebreaker when a
 * session must be CLAIMED (see `bindKey`) and never what decides who someone
 * already is.
 */
const BUILTIN: ReadonlyArray<readonly [harness: string, envVar: string]> = [
  ["claude-code", "CLAUDE_CODE_SESSION_ID"],
  ["codex", "CODEX_THREAD_ID"],
  ["pi", "PI_SESSION_ID"],
  ["antigravity", "ANTIGRAVITY_CONVERSATION_ID"],
];

/** Every variable a probe could read without config — what a test must clear
 * so that a suite asserts the same thing under every harness. */
export const harnessVars = [OWN_VAR, OWN_HARNESS_VAR, ...BUILTIN.map(([, envVar]) => envVar)];

const VALID_VAR = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Declared in `config.json`. A malformed entry is skipped rather than
 * thrown: this file is hand-edited, and a typo in it must not cost an agent
 * the ability to say who it is. */
async function declaredVars(home: string): Promise<[string, string][]> {
  const raw = await readConfigFile<HarnessVarConfig>(home);
  return Object.entries(raw.harnessVars ?? {}).filter(
    ([harness, envVar]) =>
      typeof envVar === "string" && VALID_VAR.test(envVar) && harness.length > 0,
  );
}

/** In probe order: the escape hatch, then this machine's own declarations,
 * then the harnesses shipped with isocan. First mention of a variable wins. */
async function varsFor(
  home: string,
  env: NodeJS.ProcessEnv,
): Promise<ReadonlyArray<readonly [string, string]>> {
  const own: [string, string][] = [[env[OWN_HARNESS_VAR]?.trim() || "isocan", OWN_VAR]];
  const seen = new Set<string>();
  return [...own, ...(await declaredVars(home)), ...BUILTIN].filter(([, envVar]) => {
    if (seen.has(envVar)) return false;
    seen.add(envVar);
    return true;
  });
}

/**
 * Every harness session visible here, not just one: an agent that launches
 * another agent leaks its own variables into the child, so a codex session
 * started from Claude Code sees both. Which of them is *this* process is
 * settled by the registry, not by the environment.
 */
export async function harnessSessions(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HarnessSession[]> {
  const vars = await varsFor(home, env);
  return vars.flatMap(([harness, envVar]) => {
    const id = env[envVar]?.trim();
    return id ? [{ harness, id, key: `${harness}:${id}` }] : [];
  });
}

/** The variables actually consulted on this machine, for error messages. */
export async function harnessVarsFor(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  return (await varsFor(home, env)).map(([, envVar]) => envVar);
}
