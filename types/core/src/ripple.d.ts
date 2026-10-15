import type { Actor, CanvasContents, ItemVersion } from "./model.js";
/**
 * **Changes ripple** (proactive-agent phase 6, design §8).
 *
 * A person spends twenty minutes on one screen and stops. What they decided
 * there — a new accent, a tighter type scale, "Collection" where it said
 * "Pickup" — is usually meant for the other screens too, and nothing said so:
 * the canvas held one screen that moved and five that silently fell behind.
 *
 * This is the deterministic half, the part a person can check without a
 * model: **when an iteration has settled** (`rippleRuns`), **what the run
 * changed** that another screen could share (`rippleChanges`: a token's
 * value, a property's value, a term), **which other screens use it and in
 * which of three states** (`rippleRead`: *would change*, *already in sync*,
 * *disagrees, your call*), and **the project pulse** (`ripplePulse`: one tick
 * per screen, current, behind or in conflict). All of it is derived on every
 * read and written nowhere — the pulse is a reading, like the wireframe
 * module's *behind* (`behind.ts`), never a stored flag that could go stale.
 *
 * The other half is the canvas's lead agent's, through the ordinary summons
 * (`rippleAsk`), as Explain's critique and the brief card's re-read are: the
 * edits read back as at most three named decisions in design words, with
 * one good move named once ("caught doing it right"); a preview of each
 * screen that would change, as a proposal (`proposal.ts`) citing the source's
 * version — so nothing changes until the person keeps it; an exception argued
 * in one line; and one sketched idea, set apart. With nobody to answer, the
 * deterministic half still shows and says the rest waits.
 *
 * **The altitude is the person's** (design §8; default screen by screen,
 * never the design system unless they choose it): keep the previews one by
 * one, ask the lead to put the change in the design system (`systemAsk`), or
 * mark the source a one-off (`ripple=off`), which silences it.
 *
 * Its own export path (`@isocan/core/ripple`), so none of this reaches the
 * web's entry chunk: the pulse strip and the panel load it, and the CLI loads
 * it on `isocan ripple`.
 */
/** `ripple=off`: a one-off. On a source it stops the ripple; on any screen the pulse calls it in conflict. One `item.update`, one undo. */
export declare const RIPPLE_PROP = "ripple";
/**
 * **When an iteration has settled** — chosen 14 Oct 2026, Dion to confirm:
 * at least `RIPPLE_RUN` new versions of one screen by one person in a row
 * (no gap longer than half an hour between them), then quiet on it for
 * `RIPPLE_QUIET_MS` — the journey's "stops, and a minute later". Or the
 * person says so: "I like this" is `isocan ripple <item> --ask` or the
 * panel's **Ripple this**, which reads any run of one or more edits at once.
 */
export declare const RIPPLE_RUN = 3;
/** How long a run must be quiet before it has settled (design §2.7: never over a run of edits). */
export declare const RIPPLE_QUIET_MS = 60000;
/** One run of edits on one screen: from the version before it to the one it ended on. */
export interface RippleRun {
    itemId: string;
    title: string;
    by: Actor;
    fromVersionId: string;
    toVersionId: string;
    /** 1-based version numbers, for the `itm@vN` refs a person can read. */
    from: number;
    to: number;
    edits: number;
    /** The run's last version, as an instant (ms). */
    lastAt: number;
    /** Quiet long enough (or said so). */
    settled: boolean;
    /** When it settles, if it has not (ms). */
    settlesAt: number;
}
/**
 * **The run of edits a screen ends on**, or null. The trailing versions by
 * one person, each within half an hour of the last; from the version before
 * them (or the first, when the run made the screen). It needs `RIPPLE_RUN`
 * edits — or, when the person says "I like this" (`explicit`), one — and the
 * screen showing its newest version: a person who stepped back down the
 * stack is not done.
 */
export declare function rippleRun(canvas: CanvasContents, itemId: string, now: number, explicit?: boolean): RippleRun | null;
/**
 * Every screen's run on the canvas, settled or not, newest first — what the
 * pulse and the settle trigger read. A run somebody asked about ("I like
 * this", or the settle's own ask) is settled whatever the clock says.
 */
export declare function rippleRuns(canvas: CanvasContents, now: number): RippleRun[];
/** Where a run is, as the ask, the read-back and the cite name it: `itm_x@v1..v4`. */
export declare function rippleAt(run: Pick<RippleRun, "itemId" | "from" | "to">): string;
/** One thing the run changed that another screen could share. */
export interface RippleChange {
    kind: "token" | "value" | "term";
    /** The token (`--accent`), the property (`font-size`), or "" for a term. */
    name: string;
    before: string[];
    after: string[];
    /** How the change is said on a tag: `--accent #b5452a → #8a3a20`. */
    tag: string;
}
/**
 * **What a run changed that another screen could share**, from the version
 * before it and the one it ended on: a token whose value moved
 * (`--accent: #b5452a` → `#8a3a20`); a colour, type, space or shape value the
 * screen stopped using in favour of another (`font-size: 18px` → `16px`);
 * and a term, when a word or three went out and a word or three came in
 * ("Pickup" → "Collection") — a rewrite of the copy is not a term.
 */
export declare function rippleChanges(beforeHtml: string, afterHtml: string): RippleChange[];
/** The three states a screen is in, after a ripple (design §8). */
type RippleState = "would change" | "in sync" | "disagrees";
/** One screen the ripple reaches. */
interface RippleScreen {
    itemId: string;
    title: string;
    state: RippleState;
    /** The changes it would take (its tags). */
    would: string[];
    /** The changes it already has. */
    sync: string[];
    /** Why it disagrees: a one-off, a deleted preview, or the lead's argued exception. */
    because?: string;
    /** The open preview of it, when the lead has made one. */
    previewId?: string;
}
/** A run, read against every other screen in its scope. */
export interface RippleRead {
    source: {
        itemId: string;
        title: string;
    };
    run: RippleRun;
    /** `itm@v1..v4` — the ask's and the read-back's address. */
    at: string;
    /** `itm@v4` — what a preview cites (`--cites version:<cite>`). */
    cite: string;
    changes: RippleChange[];
    screens: RippleScreen[];
    /** Screens in scope that use none of it. */
    untouched: number;
    /** The source is marked a one-off: the ripple is silent. */
    off: boolean;
}
/** An exception the lead argued, in one line. */
interface RippleException {
    itemId: string;
    why: string;
}
/** The text a version's blob holds, if it has been read. */
type TextOf = (version: ItemVersion) => string | undefined;
/**
 * The versions whose words a ripple must read — the run's two ends, and every
 * screen in its scope as it stands — so the CLI downloads, and the pulse
 * fetches, exactly these.
 */
export declare function rippleVersions(canvas: CanvasContents, runs: readonly RippleRun[]): ItemVersion[];
/**
 * **A run, read against every other screen** — or null while any version it
 * needs is unread. Each screen that uses a change is listed: *would change*
 * when it holds the old form; *already in sync* when it holds only the new;
 * *disagrees, your call* when it is marked a one-off, a preview of it from
 * this source was deleted, or the lead argued it is an exception. Screens
 * that use none of it are counted, not listed. A source marked a one-off
 * reads as silent. Nothing is written.
 */
export declare function rippleRead(canvas: CanvasContents, run: RippleRun, textOf: TextOf, exceptions?: readonly RippleException[]): RippleRead | null;
/** One tick of the pulse. */
export interface PulseTick {
    itemId: string;
    title: string;
    state: "current" | "behind" | "conflict";
    /** Why, when it is not current. */
    why?: string;
}
/**
 * **The project pulse** (design §8): one tick per screen on the canvas, in
 * reading order. *Behind* when a settled ripple says it would change; *in
 * conflict* when it disagrees with one, or is itself marked a one-off;
 * *current* otherwise. Derived from the reads, like *behind* is: no write.
 */
export declare function ripplePulse(canvas: CanvasContents, reads: readonly RippleRead[]): PulseTick[];
/**
 * **What a settled run posts to the lead** — an ordinary summons, as the brief
 * card's re-read is: the run, what it changed, the derived three states, and
 * how to answer. Nothing on any other screen has changed.
 */
export declare function rippleAsk(lead: Pick<Actor, "name">, read: RippleRead): string;
/** The person chose the design system as the altitude: the lead proposes the change as a new version of the DESIGN.md. */
export declare function systemAsk(lead: Pick<Actor, "name">, read: RippleRead): string;
/** Whether this run's ripple was asked for — so a settle posts once. */
export declare function rippleAsked(canvas: CanvasContents, at: string): boolean;
/** Whether the person asked for this run in the design system. */
export declare function systemAsked(canvas: CanvasContents, at: string): boolean;
/** The lead's read-back: the decisions, a good move named once, the exceptions it argued, and one idea set apart. */
export interface ReadBack {
    decisions: string[];
    good: string | null;
    exceptions: Array<RippleException & {
        title: string;
    }>;
    sketch: string | null;
}
/** Why a read-back may not be posted, or null — at most three decisions, a good move named once on this canvas, a one-line exception per listed screen. */
export declare function readBackRefusal(canvas: CanvasContents, read: RippleRead, back: ReadBack): string | null;
/** The read-back, as its `record` comment says it — the shape `readBackOf` reads back. */
export declare function readBackBody(at: string, back: ReadBack): string;
/** The lead's latest read-back of this run, if it has come. */
export declare function readBackOf(canvas: CanvasContents, at: string): (ReadBack & {
    by: Actor;
    commentId: string;
}) | null;
/** One section of the ripple as both surfaces show it. */
interface RippleSection {
    key: "back" | "changes" | "would" | "sync" | "disagrees" | "altitude" | "sketch";
    heading: string;
    lines: Array<{
        text: string;
        itemId?: string;
        previewId?: string;
    }>;
}
/**
 * **The ripple, in sections** — the panel draws them and `isocan ripple`
 * prints them, so the two say the same. `waits` is why the read-back has not
 * come (null once it has, or while it is asked and on its way).
 */
export declare function rippleSections(read: RippleRead, back: ReadBack | null, waits: string | null): RippleSection[];
export {};
