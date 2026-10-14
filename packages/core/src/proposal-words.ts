import type { CanvasContents, Comment, Item } from "./model.ts";
import { PARENT_PROP } from "./lineage.ts";
import { CONTEXT_PROP } from "./contextmark.ts";
import { CITE_KINDS, PROPOSAL_CITES_PROP, PROPOSAL_PROP, PROPOSAL_WHY_PROP, type ProposalCite, type ProposalConfidence } from "./proposal.ts";

/**
 * **The words around a proposal** — what the CLI writes and the canvas says
 * about one (proactive-agent phase 1): reading a `--cites`, the properties a
 * proposal is born with, the trigger chip's words, the taste note and the
 * delete's comment. Apart from `proposal.ts` on purpose: that file is the
 * reducer's (the cite and cap rules run at the writer), so whatever lives in
 * it rides the web's entry chunk; nothing here is needed before somebody
 * proposes, looks at a proposal or deletes one.
 */

/** `kind:ref`, as the CLI's `--cites` takes it — or why it is not one. */
export function parseCite(text: string): ProposalCite | { refused: string } {
  const at = text.indexOf(":");
  const kind = at > 0 ? text.slice(0, at).trim() : "";
  const ref = at > 0 ? text.slice(at + 1).trim() : "";
  if (!(CITE_KINDS as readonly string[]).includes(kind) || !ref) {
    return { refused: `"${text}" is not a cite — write kind:ref, where kind is one of ${CITE_KINDS.join(", ")} (comment:cmt_…, op:42, version:itm_…@v3)` };
  }
  return { kind: kind as ProposalCite["kind"], ref: ref.slice(0, 200) };
}

/** The properties an `item.add` carries for a proposal of `sourceId`. */
export function proposalProperties(
  sourceId: string,
  confidence: ProposalConfidence,
  cites: readonly ProposalCite[],
  why: string,
): Record<string, string> {
  return {
    [PARENT_PROP]: sourceId,
    [PROPOSAL_PROP]: confidence,
    [PROPOSAL_CITES_PROP]: JSON.stringify(cites),
    // The why's bound: two sentences, said in a chip's width — not a document.
    [PROPOSAL_WHY_PROP]: why.replace(/\s+/g, " ").trim().slice(0, 400),
  };
}

const KIND_WORD: Record<ProposalCite["kind"], string> = {
  comment: "a comment",
  op: "an edit",
  version: "a version",
  design: "the design system",
  brief: "the brief",
  promise: "a promise",
  docket: "a finding",
  critic: "a critic's note",
};

/**
 * **What the trigger chip says** — the first cite, in words. A comment cite
 * is found on the canvas and quoted with its author ("Ravi's comment, "people
 * miss the pickup slot""); anything else says its kind and ref.
 */
export function citeLabel(canvas: CanvasContents, cite: ProposalCite): string {
  if (cite.kind === "comment") {
    for (const thread of Object.values(canvas.threads)) {
      const c = thread.comments.find((one: Comment) => one.id === cite.ref) ?? (thread.id === cite.ref ? thread.comments[0] : undefined);
      if (c) {
        const words = c.body.replace(/\s+/g, " ").trim();
        return `${c.author.name}'s comment, “${words.length > 48 ? `${words.slice(0, 47)}…` : words}”`;
      }
    }
  }
  return `${KIND_WORD[cite.kind]} · ${cite.ref}`;
}

// ---------- deletes that teach

/**
 * **The taste note: what your deletes taught** (design §3). Ordinary text,
 * titled so, carrying `taste=1` and pinned into context (`contextmark.ts`),
 * so `isocan context` hands it to every agent. One per canvas, created the
 * first time a line needs it; the person edits or clears it like any note.
 */
const TASTE_PROP = "taste";
/** The note's title — the person reads it on the canvas. */
export const TASTE_TITLE = "What your deletes taught";

/** The canvas's taste note, if it has one. */
export function tasteNote(canvas: CanvasContents): Item | null {
  return Object.values(canvas.items).find((item) => item.properties?.[TASTE_PROP] === "1") ?? null;
}

/** The properties a new taste note is born with. */
export function tasteProperties(): Record<string, string> {
  return { [TASTE_PROP]: "1", [CONTEXT_PROP]: "pinned" };
}

/** The note's text with one more line — a bullet, on its own line, under the title. */
export function tasteWithLine(current: string | null, line: string): string {
  const one = line.replace(/\s+/g, " ").trim();
  const base = current && current.trim() ? current.replace(/\s+$/, "") : `# ${TASTE_TITLE}`;
  return `${base}\n- ${one}\n`;
}

/** The words a delete's comment carries — what the author reads in the thread; agents read `comment.deleted`. */
export function deletedBody(title: string, reason: string): string {
  const why = reason.replace(/\s+/g, " ").trim().slice(0, 280);
  return `Deleted the proposal “${title || "untitled"}”${why ? ` — ${why}` : ""}. What should it teach? Add one line to the taste note.`;
}
