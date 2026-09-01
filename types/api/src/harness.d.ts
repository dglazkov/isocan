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
/** Every variable a probe could read without config — what a test must clear
 * so that a suite asserts the same thing under every harness. */
export declare const harnessVars: string[];
/**
 * Every harness session visible here, not just one: an agent that launches
 * another agent leaks its own variables into the child, so a codex session
 * started from Claude Code sees both. Which of them is *this* process is
 * settled by the registry, not by the environment.
 */
export declare function harnessSessions(home: string, env?: NodeJS.ProcessEnv): Promise<HarnessSession[]>;
/** The variables actually consulted on this machine, for error messages. */
export declare function harnessVarsFor(home: string, env?: NodeJS.ProcessEnv): Promise<string[]>;
