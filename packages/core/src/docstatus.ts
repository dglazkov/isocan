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
  /** Written, argued, nothing built. Something is OWED. */
  "designed",
  /**
   * Read, absorbed, and owing nothing.
   *
   * A survey of what other people shipped is finished when it has been read —
   * its value is the finding, and there is no build behind it to be waiting
   * for. Without this state such a note sits in `open` forever (which reads as
   * "nobody has looked at it", and is a lie once somebody has) or gets marked
   * `designed` (which reads as "there is work here", and is a different lie).
   * Both distort the only number the roadmap is for.
   */
  "noted",
  /** Some of it is built; the doc says which part. */
  "partial",
  /** Built. */
  "built",
  /** Waiting on something NAMED. `blocked` with no `blockedBy` is a shrug. */
  "blocked",
  /** Replaced by something else, which `supersededBy` names. */
  "superseded",
] as const;

type DocState = (typeof DOC_STATES)[number];

interface DocStatus {
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
  /**
   * The GitHub issue that follows this doc's work, by number. The doc is the
   * argument and the plan; the issue is where the work is followed and where
   * it is closed. One number, here, so the roadmap can link it and a test can
   * find a doc that owes work and has nowhere it is being followed.
   */
  issue?: number;
}

const isState = (s: string): s is DocState => (DOC_STATES as readonly string[]).includes(s);

/**
 * The `key: value` lines of a front matter block, quotes stripped. ONE reader:
 * status, and the Loop findings beside it, both go through this, so two files
 * that say the same thing in the same way are read the same way.
 */
export function frontMatterFields(front: string): Map<string, string> {
  const kv = new Map<string, string>();
  for (const line of front.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (m) kv.set(m[1]!, m[2]!.trim().replace(/^["']|["']$/g, ""));
  }
  return kv;
}

/**
 * Read the front matter, or say there is none. A doc without it is not
 * malformed — it is untriaged, which is `open`, and the roadmap counts it.
 */
export function docStatus(text: string): DocStatus {
  const kv = frontFields(text);
  if (!kv) return { status: "open", see: [] };
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
    ...issueOf(kv),
  };
}

/** The flat `key: value` lines of a front matter block, or null when there is none. */
function frontFields(text: string): Map<string, string> | null {
  const split = splitFrontMatter(text);
  if (!split) return null;
  return frontMatterFields(split.front);
}

// A number, or nothing: "#134" and "134" both mean issue 134, and a word there
// is not an issue.
const issueOf = (kv: Map<string, string>): { issue?: number } =>
  /^#?\d+$/.test(kv.get("issue") ?? "") ? { issue: Number(kv.get("issue")!.replace(/^#/, "")) } : {};

/**
 * **What needs a person, said in the walk that needs one.**
 *
 * `docs/verify/` is the queue of things built and shipped that no human being
 * has exercised. Its table used to be hand-kept in the README — a copy of what
 * each walk's own `**Status:**` line already said — and the roadmap did not
 * show it at all, so "what do we need people to test" had no answer anywhere a
 * reader would look first. Each walk now carries this in front matter, read by
 * the same reader as `docStatus`, and the roadmap opens with the result.
 */
const VERIFY_STATES = [
  /** Built, shipped, nobody has run it. */
  "unverified",
  /** Somebody ran it, on a date, and it did what the page said. */
  "works",
  /** Somebody ran it and it did not; `issue` names the bug. */
  "broken",
] as const;

type VerifyState = (typeof VERIFY_STATES)[number];

interface VerifyStatus {
  /** No front matter, or an unrecognised word, is `unverified` — a typo must
   *  never take a walk off the list of things nobody has run. */
  status: VerifyState;
  /** When the status was last true. */
  since?: string;
  /** What the person needs in hand: a microphone, a phone, three people. */
  needs?: string;
  /** What has never been exercised, in one line. */
  never?: string;
  /** For `broken`, the bug; otherwise the work the walk belongs to. */
  issue?: number;
}

const isVerifyState = (s: string): s is VerifyState => (VERIFY_STATES as readonly string[]).includes(s);

/** Read a walk's front matter — through the same reader as `docStatus`. */
export function verifyStatus(text: string): VerifyStatus {
  const kv = frontFields(text);
  if (!kv) return { status: "unverified" };
  const raw = kv.get("status") ?? "";
  return {
    status: isVerifyState(raw) ? raw : "unverified",
    ...(kv.get("since") ? { since: kv.get("since")! } : {}),
    ...(kv.get("needs") ? { needs: kv.get("needs")! } : {}),
    ...(kv.get("never") ? { never: kv.get("never")! } : {}),
    ...issueOf(kv),
  };
}

/** The ways a walk's front matter can fail the person about to run it. */
export function verifyProblems(walk: VerifyStatus): string[] {
  const out: string[] = [];
  if (!walk.never) out.push("no `never:` — say what has never been exercised");
  if (!walk.needs) out.push("no `needs:` — say what the person needs in hand before they start");
  if (!walk.since) out.push("a status with no date is a status nobody can age");
  if (walk.status === "broken" && !walk.issue) out.push("broken with no issue — a walk that found something links the bug");
  return out;
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
  // `noted` counts as neither, like `superseded`: a survey that owes nothing is
  // not outstanding work, and calling it "done" would flatter the done column
  // with reading rather than building.
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
