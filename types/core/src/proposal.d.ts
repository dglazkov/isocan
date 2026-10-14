import type { CanvasContents, Item } from "./model.js";
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
export declare const PROPOSAL_PROP = "proposal";
/** `proposalCites=<JSON list of {kind, ref}>`: what prompted it — at least one. */
export declare const PROPOSAL_CITES_PROP = "proposalCites";
/** `proposalWhy=<text>`: at most two sentences, in design words (`design-words.ts`). */
export declare const PROPOSAL_WHY_PROP = "proposalWhy";
/**
 * **How many open proposals one agent may keep on one canvas** (Dion, 14 Oct
 * 2026: five, per agent per canvas). The one number every surface reads —
 * `proposalRoom`, the reducer's refusal, the CLI's, the agent guide's
 * sentence and the tests — so restraint is a constant, not a habit.
 */
export declare const PROPOSAL_CAP = 5;
/**
 * How sure the agent is. The mark says which; drawing a hunch rough (a wire
 * spec, a pencil note) is the agent's to do in the file it proposes — this
 * never sets `fidelity`, which would enrol a plain HTML file in the wireframe
 * module's prototype and design-scope reads.
 */
export type ProposalConfidence = "sure" | "hunch";
/**
 * What can prompt a proposal (design §2.3): a comment, an op by seq, an item
 * version, a DESIGN.md version, a brief fact, a promise, a docket finding,
 * a critic's note, or an Explain critique (`explain:<comment>`, phase 4).
 * The kind is checked; the ref is the kind's own id.
 */
export declare const CITE_KINDS: readonly ["comment", "op", "version", "design", "brief", "promise", "docket", "critic", "explain"];
/** One trigger a proposal cites. */
export interface ProposalCite {
    kind: (typeof CITE_KINDS)[number];
    ref: string;
}
/** The cites an item carries, or none — a bad value reads as none, which is what the refusal checks. */
export declare function proposalCites(item: Pick<Item, "properties">): ProposalCite[];
/**
 * Whether the canvas marks this item as a proposal: it says how sure it is
 * (or that it is a night's promise) and what it came from. A promised frame
 * and a failed promise are marked too, so both count toward the cap — five
 * is everything of the agent's still waiting on the person.
 */
export declare function proposalMarked(item: Pick<Item, "properties">): boolean;
/** The open proposals on a canvas — of one source when named — oldest first. */
export declare function proposalsOf(canvas: CanvasContents, sourceId?: string): Item[];
/**
 * How many more proposals this actor may open on this canvas: `PROPOSAL_CAP`
 * less its open ones. **Every open one counts, however old** (Dion, 14 Oct
 * 2026): the cap never grows with time away and a proposal never ages out —
 * room frees only when the person keeps or deletes one.
 */
export declare function proposalRoom(canvas: CanvasContents, actorId: string): number;
/**
 * **Why this proposal may not be made, in words that say what to do** — or
 * null. The reducer asks it of every `item.add` that carries `proposal`, and
 * the CLI asks it before uploading, so both surfaces refuse with one sentence.
 */
export declare function proposalRefusal(canvas: CanvasContents, actorId: string, properties: Record<string, string>): string | null;
