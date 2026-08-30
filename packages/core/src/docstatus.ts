import { splitFrontMatter } from "./persona.ts";

/**
 * **Where a document stands, said once, in the document.**
 *
 * The roadmap was a hand-kept fourth copy of something the repo already knew:
 * `docs/projects/README.md` carries a "where it stands" column, research docs
 * carry a `**Where this stands, …**` paragraph, and an artifact outside the
 * repo restated both. Keeping three copies in step is work somebody does badly
 * or not at all, and the third copy is the one that goes stale silently
 * because nothing reads it.
 *
 * So status lives WITH the doc — it cannot drift from the thing it describes —
 * and the roadmap becomes a derivation, the same shape as every other number
 * this project trusts.
 *
 * Front matter, the shape personas already use, so there is one reader.
 */

/**
 * One vocabulary for research and for projects, because "what is left to do"
 * is one question and two lists answering it differently is how the answer
 * gets lost.
 */
export const DOC_STATES = [
  /** No verdict recorded. Not a failure — an untriaged doc is a real state and
   *  counting them is half the point of having this at all. */
  "open",
  /** Written, argued, nothing built. */
  "designed",
  /** Some of it is built; the doc says which part. */
  "partial",
  /** Built. */
  "built",
  /** Waiting on something NAMED. `blocked` with no `blockedBy` is a shrug. */
  "blocked",
  /** Replaced by something else, which `supersededBy` names. */
  "superseded",
] as const;

export type DocState = (typeof DOC_STATES)[number];

export interface DocStatus {
  status: DocState;
  /** When the status was last true, as a date. A verdict with no date is a
   *  verdict nobody can age. */
  since?: string;
  /** Other docs this one belongs with — project directory names or research
   *  filenames. What makes the roadmap a graph rather than two lists. */
  see: string[];
  /** For `blocked`: what it is waiting on, in words. */
  blockedBy?: string;
  /** For `superseded`: what replaced it. */
  supersededBy?: string;
  /** One line for the roadmap, when the title is not enough. */
  note?: string;
}

const isState = (s: string): s is DocState => (DOC_STATES as readonly string[]).includes(s);

/**
 * Read the front matter, or say there is none. A doc without it is not
 * malformed — it is untriaged, which is `open`, and the roadmap counts it.
 */
export function docStatus(text: string): DocStatus {
  const split = splitFrontMatter(text);
  if (!split) return { status: "open", see: [] };
  const kv = new Map<string, string>();
  for (const line of split.front.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (m) kv.set(m[1]!, m[2]!.trim().replace(/^["']|["']$/g, ""));
  }
  const raw = kv.get("status") ?? "";
  const list = (kv.get("see") ?? "")
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    // An unrecognised word is `open` rather than an error: a typo must not
    // silently promote a doc to "built".
    status: isState(raw) ? raw : "open",
    ...(kv.get("since") ? { since: kv.get("since")! } : {}),
    see: list,
    ...(kv.get("blockedBy") ? { blockedBy: kv.get("blockedBy")! } : {}),
    ...(kv.get("supersededBy") ? { supersededBy: kv.get("supersededBy")! } : {}),
    ...(kv.get("note") ? { note: kv.get("note")! } : {}),
  };
}

/** What is left, and what is done — the only two numbers a burn-down needs. */
export function burnDown(all: readonly DocStatus[]): {
  done: number;
  left: number;
  byState: Record<DocState, number>;
} {
  const byState = Object.fromEntries(DOC_STATES.map((s) => [s, 0])) as Record<DocState, number>;
  for (const doc of all) byState[doc.status] += 1;
  // `superseded` counts as neither: it is not work and it is not done work.
  const done = byState.built;
  const left = byState.open + byState.designed + byState.partial + byState.blocked;
  return { done, left, byState };
}

/**
 * **A status that says nothing is worse than no status**, so these are the
 * ways a front matter block can be wrong on its own terms. Returned rather
 * than thrown: the roadmap should be able to print a doc AND its complaint.
 */
export function statusProblems(doc: DocStatus): string[] {
  const out: string[] = [];
  if (doc.status === "blocked" && !doc.blockedBy) {
    out.push("blocked with nothing named — a blocker nobody can read is a shrug");
  }
  if (doc.status === "superseded" && !doc.supersededBy) {
    out.push("superseded by nothing — say what replaced it");
  }
  if (doc.status !== "open" && !doc.since) {
    out.push("a verdict with no date is a verdict nobody can age");
  }
  return out;
}
