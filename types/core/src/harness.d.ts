/** Harness classification shared by actor claims and session headers.
 * Kept separate so reading an attestation does not load the actor registry writer. */
/**
 * The harnesses a PERSON claims from. Everything else — a coding harness,
 * an enrolment (`agent:`), a bot on a timer (`board:`) — is an agent. The
 * list is of people rather than of agents because new harnesses appear
 * (`harnessVars` in config.json) and a new one should be an agent by
 * default: the failure mode of guessing wrong the other way is a corpus
 * that counts a bot's receipts as somebody asking.
 */
export declare const PERSON_HARNESSES: ReadonlySet<string>;
/**
 * Is this harness an agent's? Anything not a known person's harness is — empty or missing
 * is neither, and reads as not an agent.
 */
export declare const isAgentHarness: (harness: string | null | undefined) => boolean;
