import type { Actor, CanvasContents, Item } from "./model.ts";
import { mainThread } from "./model.ts";
import type { ActorJoins } from "./identity.ts";
import { sameActor } from "./identity.ts";
import { PROPOSAL_CAP, PROPOSAL_PROP, PROPOSAL_WHY_PROP, proposalMarked } from "./proposal.ts";
import { HANDOFF_REVIEWED_PROP, PROMISE_TAKE_PROP, goodnightNotes, type NightNote } from "./goodnight.ts";

/**
 * **The morning review** (proactive-agent phase 3, design §5).
 *
 * The person said `/goodnight`; the lead worked; now they are back. What
 * they see is DERIVED from what the night left on the canvas — the note's
 * model (`handoffNote`), the frames and proposals the lead made after it, the
 * brief it posted as a Chat `record` with `goodnight: {step: "brief", note}` —
 * so nothing has to be live at return, and the web panel and `isocan
 * goodnight review` read one answer.
 *
 * **When** (`morningDue`): only after the person's OWN goodnight, and only
 * when their seen mark (`seen.ts`) is older than that note's ready-by — they
 * have not been back since the night's work was due. No goodnight, no morning
 * review; the ordinary "While you were away" digest still shows what others
 * did. Once the review has been seen the note carries `handoffReviewed`, and
 * that closes it: no second review, and it stops holding other people's
 * goodnights off the items it named.
 *
 * **What** (`nightReview`): the brief first — one plain line when the night
 * failed or made nothing, then the lead's own words — then at most
 * `PROPOSAL_CAP` proposals, highest confidence first (sure, hunch, then the
 * promises that did not work, each with its reason), then **Left alone**
 * (what the agent saw and did not act on, with why), then every original it
 * edited because the conversation named it, with the version before.
 */

/** One proposal the night left, as the morning lists it. */
export interface MorningProposal {
  itemId: string;
  title: string;
  /** `failed` is a promise that did not work; its why is the reason. */
  state: "sure" | "hunch" | "promised" | "failed";
  why: string;
  /** A failed promise that still shows the take it would have made. */
  take: boolean;
}

/** One original the night edited because the person named it. */
interface MorningEdit {
  itemId: string;
  title: string;
  /** The version the night made, and the one before it (null when the item had none). */
  after: string | null;
  before: string | null;
  /** The edit line failed: its reason, and nothing changed. */
  failed?: string;
}

/** What the morning shows, for one person's latest goodnight. */
interface MorningReview {
  noteId: string;
  note: NightNote;
  lead: Actor | null;
  /** The lead's brief, when it posted one. */
  brief: { threadId: string; commentId: string; body: string } | null;
  /** One plain line when the night failed or made nothing — with the reason. */
  headline: string | null;
  proposals: MorningProposal[];
  left: { what: string; why: string }[];
  edited: MorningEdit[];
  reviewed: boolean;
}

const ORDER: Record<MorningProposal["state"], number> = { sure: 0, hunch: 1, promised: 2, failed: 3 };

/** The one plain line for a night that failed or made nothing, or null when it made something. */
function headlineOf(note: NightNote, proposals: readonly MorningProposal[], edited: readonly MorningEdit[], briefed: boolean, now: number): string | null {
  const lead = note.lead?.name ?? "The lead";
  if (note.nothing) {
    const cannot = /^Nothing can answer overnight: (.*)\. Nothing is promised\.$/.exec(note.nothing)?.[1];
    if (cannot) return `Nothing was made overnight: ${cannot}.`;
    return `Nothing new overnight: ${PROPOSAL_CAP} proposals were already waiting on you, and room frees only when you keep or delete one.`;
  }
  const ticked = note.lines.filter((l) => l.ticked);
  if (ticked.length === 0) {
    return note.lines.length ? "Nothing was made overnight: you unticked every line, so nothing was promised." : "Nothing was made overnight: nothing was agreed, so nothing was promised.";
  }
  const unanswered = ticked.filter((l) => !l.result);
  if (unanswered.length && !briefed && now >= Date.parse(note.ready)) {
    return `The night did not finish: ${lead} answered ${ticked.length - unanswered.length} of ${ticked.length} promises before it stopped.`;
  }
  const made = proposals.some((p) => p.state === "sure" || p.state === "hunch") || edited.some((e) => !e.failed && e.after);
  if (!made && unanswered.length === 0) {
    const reason = ticked.flatMap((l) => (l.result && "failed" in l.result ? [l.result.failed] : []))[0];
    return `Nothing worth keeping overnight${reason ? `: ${reason}` : "."}`.replace(/([^.!?])$/, "$1.");
  }
  return null;
}

/**
 * **The review of one goodnight note**, whatever the seen mark says — what
 * `isocan goodnight review` prints and the panel draws once it is due.
 */
export function nightReview(canvas: CanvasContents, noteId: string, now: number, joined?: ActorJoins): MorningReview | null {
  const found = goodnightNotes(canvas).find(({ item }) => item.id === noteId);
  if (!found) return null;
  const { item: noteItem, note } = found;
  const byLead = (id: string) => Boolean(note.lead && sameActor(joined, id, note.lead.id));
  const after = (iso: string) => iso >= noteItem.createdAt;
  const brief = (mainThread(canvas)?.comments ?? [])
    .filter((c) => c.goodnight?.step === "brief" && c.goodnight.note === noteId)
    .at(-1);
  const proposals = Object.values(canvas.items)
    .filter((item) => proposalMarked(item) && byLead(item.createdBy.id) && after(item.createdAt))
    .map((item): MorningProposal => ({
      itemId: item.id,
      title: item.title,
      state: item.properties[PROPOSAL_PROP] as MorningProposal["state"],
      why: item.properties[PROPOSAL_WHY_PROP] ?? "",
      take: Boolean(item.properties[PROMISE_TAKE_PROP]),
    }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (canvas.items[a.itemId]!.createdAt).localeCompare(canvas.items[b.itemId]!.createdAt))
    .slice(0, PROPOSAL_CAP);
  const edited = note.lines
    .filter((l) => l.edit && l.ticked && l.result)
    .map((l): MorningEdit => {
      const item: Item | undefined = canvas.items[l.on];
      const title = item?.title ?? note.titles[l.on] ?? l.on;
      if (l.result && "failed" in l.result) return { itemId: l.on, title, after: null, before: null, failed: l.result.failed };
      const at = item ? item.versions.findIndex((v) => after(v.createdAt) && byLead(v.createdBy.id)) : -1;
      return { itemId: l.on, title, after: at >= 0 ? item!.versions[at]!.id : null, before: at > 0 ? item!.versions[at - 1]!.id : null };
    });
  const named = new Set(note.lines.filter((l) => l.ticked).map((l) => l.on));
  const title = (id: string) => canvas.items[id]?.title ?? note.titles[id] ?? id;
  const left = [
    ...(note.left ?? []),
    ...note.lines.filter((l) => !l.ticked).map((l) => ({ what: l.text, why: "you unticked it, so it was an offer, not a promise" })),
    ...(note.midway ?? []).filter((id) => !named.has(id) && canvas.items[id]).map((id) => ({ what: `“${title(id)}”`, why: "you were still working on it when you left" })),
  ];
  return {
    noteId,
    note,
    lead: note.lead,
    brief: brief ? { threadId: mainThread(canvas)!.id, commentId: brief.id, body: brief.body } : null,
    headline: headlineOf(note, proposals, edited, Boolean(brief), now),
    proposals,
    left,
    edited,
    reviewed: Boolean(noteItem.properties[HANDOFF_REVIEWED_PROP]),
  };
}

/**
 * **Whether this person's morning review is due**, and for which note — or
 * why not, in words. Due when their latest goodnight note exists, has not
 * been reviewed, its night is over (ready-by passed, or the brief is posted),
 * and their seen mark is older than its ready-by: they have not been back
 * since. A missing mark (never recorded) counts as older.
 */
export function morningDue(
  canvas: CanvasContents,
  personId: string,
  mark: { at: string } | null,
  now: number,
  joined?: ActorJoins,
): { noteId: string } | { not: string } {
  const mine = goodnightNotes(canvas).find(({ note }) => sameActor(joined, note.person.id, personId));
  if (!mine) return { not: "no goodnight of yours on this canvas" };
  const ready = Date.parse(mine.note.ready);
  if (mark && Date.parse(mark.at) >= ready) return { not: "you have been back since its ready-by" };
  if (mine.item.properties[HANDOFF_REVIEWED_PROP]) return { not: "already reviewed" };
  const briefed = (mainThread(canvas)?.comments ?? []).some((c) => c.goodnight?.step === "brief" && c.goodnight.note === mine.item.id);
  if (now < ready && !briefed) return { not: "the night is still on" };
  return { noteId: mine.item.id };
}

/** `isocan goodnight review`'s words: the brief, the proposals, left alone, the edits. */
export function morningText(review: MorningReview): string {
  const out: string[] = [`${review.lead ? `${review.lead.name}'s` : "The"} brief for ${review.note.person.name}${review.reviewed ? " (reviewed)" : ""}`];
  if (review.headline) out.push(review.headline);
  if (review.brief) out.push(review.brief.body);
  if (!review.headline && !review.brief) out.push("No brief yet.");
  if (review.proposals.length) {
    out.push("", `Proposals (${review.proposals.length} of at most ${PROPOSAL_CAP}), highest confidence first:`);
    for (const p of review.proposals) out.push(`  ${p.state === "failed" ? "did not work" : p.state} — “${p.title}” (${p.itemId}): ${p.why}`);
  }
  if (review.left.length) out.push("", "Left alone:", ...review.left.map((l) => `  - ${l.what} — ${l.why}`));
  if (review.edited.length) {
    out.push("", "Edited because you named it:");
    for (const e of review.edited) {
      out.push(e.failed ? `  - “${e.title}” — did not work: ${e.failed}` : `  - “${e.title}” (${e.itemId}) — a new version; the one before: ${e.before ? `isocan diff ${e.itemId} ${e.before} ${e.after}` : "none"}`);
    }
  }
  return out.join("\n");
}
