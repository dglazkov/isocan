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
export const PERSON_HARNESSES: ReadonlySet<string> = new Set(["web", "home", "cli", "person"]);

/**
 * Is this harness an agent's? Anything not a known person's harness is — empty or missing
 * is neither, and reads as not an agent.
 */
export const isAgentHarness = (harness: string | null | undefined): boolean =>
  harness !== null && harness !== undefined && harness !== "" && !PERSON_HARNESSES.has(harness.toLowerCase()) &&
  // **A relay is not a kind** (14 Oct 2026). `replica:` is the key a daemon
  // claims under when it carries its person up to a home: transport custody,
  // not a harness. `bindName` stopped recording it on 14 Sep, and the file
  // store repaired the rows it had already written, but a hosted home's cloud
  // store never did — so a person announced by their own laptop before then
  // still read as an agent there, and folding their browser into that id
  // turned the browser into one too ("personal canvases belong to people").
  harness.toLowerCase() !== "replica";
