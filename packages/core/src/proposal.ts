import type { CanvasContents, Item } from "./model.ts";
import { PARENT_PROP, parentOf } from "./lineage.ts";

/**
 * **A proposal: work left beside yours, with a note** (proactive-agent
 * design §2–§3, phase 1).
 *
 * An agent that speaks first must never speak OVER the person's work. So what
 * it makes is an ordinary item placed beneath the item it came from, carrying
 * `parent=` (`lineage.ts`) and three properties: how sure it is
 * (`proposal=sure|hunch`), what prompted it (`proposalCites`, a JSON list of
 * `{ kind, ref }`), and why, in design words (`proposalWhy`). No op and no
 * field: the same convention-in-properties `lineage.ts` and `contextmark.ts`
 * use, so it replicates, undoes and is visible to every client by
 * construction.
 *
 * Like the wireframe *maybe*, the mark is DERIVED: the canvas draws a dashed
 * outline, a trigger chip and the why while the item says it is a proposal,
 * and the moment it is kept — `choose`, which folds it into its source as a
 * new version and trashes it — there is no proposal left to mark.
 *
 * **Two rules hold at the writer, not in a client** (`proposalRefusal`, read
 * by the reducer on `item.add`): no trigger, no proposal; and one agent keeps
 * at most `PROPOSAL_CAP` open proposals on a canvas. The CLI asks the same
 * function first so its refusal is a sentence before anything is uploaded,
 * and the web — which never mints a proposal — is refused by the same reducer
 * if it ever sends one.
 */

/**
 * `proposal=sure|hunch`: the agent's own word for how hard to look. Two more
 * states belong to the night watch (phase 2, `goodnight.ts`): `promised`, an
 * empty frame a goodnight note promised, and `failed`, a promise that did not
 * work, carrying its reason as the why.
 */
export const PROPOSAL_PROP = "proposal";
/** `proposalCites=<JSON list of {kind, ref}>`: what prompted it — at least one. */
export const PROPOSAL_CITES_PROP = "proposalCites";
/** `proposalWhy=<text>`: at most two sentences, in design words (`design-words.ts`). */
export const PROPOSAL_WHY_PROP = "proposalWhy";

/**
 * **How many open proposals one agent may keep on one canvas** (Dion, 14 Oct
 * 2026: five, per agent per canvas). The one number every surface reads —
 * `proposalRoom`, the reducer's refusal, the CLI's, the agent guide's
 * sentence and the tests — so restraint is a constant, not a habit.
 */
export const PROPOSAL_CAP = 5;

/**
 * How sure the agent is. The mark says which; drawing a hunch rough (a wire
 * spec, a pencil note) is the agent's to do in the file it proposes — this
 * never sets `fidelity`, which would enrol a plain HTML file in the wireframe
 * module's prototype and design-scope reads.
 */
export type ProposalConfidence = "sure" | "hunch";

/** Every state the canvas marks: how sure, or where a night's promise stands. */
const MARKED_STATES: readonly string[] = ["sure", "hunch", "promised", "failed"];

/**
 * What can prompt a proposal (design §2.3): a comment, an op by seq, an item
 * version, a DESIGN.md version, a brief fact, a promise, a docket finding,
 * a critic's note, an Explain critique (`explain:<comment>`, phase 4), or a
 * walk (`walk:<the ask's comment>`, phase 9).
 * The kind is checked; the ref is the kind's own id.
 */
export const CITE_KINDS = ["comment", "op", "version", "design", "brief", "promise", "docket", "critic", "explain", "walk"] as const;
/** One trigger a proposal cites. */
export interface ProposalCite {
  kind: (typeof CITE_KINDS)[number];
  ref: string;
}

/** The cites an item carries, or none — a bad value reads as none, which is what the refusal checks. */
export function proposalCites(item: Pick<Item, "properties">): ProposalCite[] {
  const raw = item.properties?.[PROPOSAL_CITES_PROP];
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.flatMap((one) => {
      const c = one as Partial<ProposalCite> | null;
      return c && typeof c.kind === "string" && typeof c.ref === "string" && c.ref && (CITE_KINDS as readonly string[]).includes(c.kind)
        ? [{ kind: c.kind as ProposalCite["kind"], ref: c.ref }]
        : [];
    });
  } catch {
    return [];
  }
}

/**
 * Whether the canvas marks this item as a proposal: it says how sure it is
 * (or that it is a night's promise) and what it came from. A promised frame
 * and a failed promise are marked too, so both count toward the cap — five
 * is everything of the agent's still waiting on the person.
 */
export function proposalMarked(item: Pick<Item, "properties">): boolean {
  const p = item.properties ?? {};
  return MARKED_STATES.includes(p[PROPOSAL_PROP] ?? "") && Boolean(p[PARENT_PROP]);
}

/** The open proposals on a canvas — of one source when named — oldest first. */
export function proposalsOf(canvas: CanvasContents, sourceId?: string): Item[] {
  return Object.values(canvas.items)
    .filter((item) => proposalMarked(item) && (sourceId === undefined || parentOf(item) === sourceId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * How many more proposals this actor may open on this canvas: `PROPOSAL_CAP`
 * less its open ones. **Every open one counts, however old** (Dion, 14 Oct
 * 2026): the cap never grows with time away and a proposal never ages out —
 * room frees only when the person keeps or deletes one.
 */
export function proposalRoom(canvas: CanvasContents, actorId: string): number {
  const open = proposalsOf(canvas).filter((item) => item.createdBy.id === actorId).length;
  return Math.max(0, PROPOSAL_CAP - open);
}

/**
 * **Why this proposal may not be made, in words that say what to do** — or
 * null. The reducer asks it of every `item.add` that carries `proposal`, and
 * the CLI asks it before uploading, so both surfaces refuse with one sentence.
 */
export function proposalRefusal(
  canvas: CanvasContents,
  actorId: string,
  properties: Record<string, string>,
): string | null {
  const p = properties[PROPOSAL_PROP];
  // `promised` is born empty under a goodnight note; `failed` is only ever
  // reached by filling a promise, never added.
  if (p !== "sure" && p !== "hunch" && p !== "promised") return `a proposal is sure or hunch, not "${p ?? ""}"`;
  const parent = properties[PARENT_PROP];
  if (!parent || !canvas.items[parent]) {
    return "a proposal hangs beneath its source — name an item that is on the canvas";
  }
  const cites = proposalCites({ properties });
  if (cites.length === 0) {
    return `no trigger, no proposal: cite what prompted it with --cites kind:ref (${CITE_KINDS.join(", ")})`;
  }
  if (p === "promised" && !cites.some((c) => c.kind === "promise")) {
    return "a promised frame cites the goodnight line that promised it — write it with `isocan goodnight note`";
  }
  const why = (properties[PROPOSAL_WHY_PROP] ?? "").trim();
  if (!why) return "a proposal says why, in design words: --why \"…\"";
  if ((why.match(/[.!?](\s|$)/g) ?? []).length > 2) {
    return "the why is two sentences at most; say the rest in a comment";
  }
  if (proposalRoom(canvas, actorId) === 0) {
    return `you already have ${PROPOSAL_CAP} open proposals on this canvas, the most one agent may keep. Room frees only when the person keeps or deletes one of them, so wait for that — park on \`isocan wait\``;
  }
  return null;
}

