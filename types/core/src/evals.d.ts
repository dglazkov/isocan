import type { CanvasContents, Item } from "./model.js";
import type { LogEntry } from "./ops.js";
/**
 * **The request corpus** — what people actually ask agents for, and what
 * happened next. Stage 1 of `docs/projects/evals/plan.md`.
 *
 * This is a READ over the oplog and the canvas snapshot. It stores nothing,
 * sends nothing, and writes to no canvas: the whole programme is meant to run
 * on one machine with no telemetry at all, and a report that needs a network
 * to be useful is a report that has already lost that argument.
 *
 * ## The join key the plan named does not exist
 *
 * The plan says `onThread` "is the join key the whole programme depends on:
 * it is what makes 'this ask produced these ops and that answer' a query
 * rather than a guess." It is not, and it cannot be. `onThread` lives on
 * `SessionState` — the presence plane, which `http.ts:2150` marks *ephemeral
 * — no oplog, no storage* — and the agent guide promises exactly that about
 * it: claiming a thread "costs no op, leaves no trace in the history, and
 * vanishes when you stop." Nothing about who was answering what survives the
 * session that said it.
 *
 * So the honest join is three weaker ones, and this file's central rule is
 * that **it says which of the three it used for every row**. `Attribution`
 * is not decoration:
 *
 * - `anchor` — the thread is pinned to the item (`thread.anchorItemId`).
 *   Durable canvas state, and as close to a fact as this gets.
 * - `reference` — the ask or its answer named the item (`comment.items`,
 *   which carries both the `#ref`s and whatever the author had selected).
 *   Also durable, also recorded at authoring time by the person who meant it.
 * - `window` — an op by the answering actor, after the ask and before the
 *   next thing anybody said in that thread. **This one is a guess.** It is
 *   included because excluding it would report zero for most real asks, and
 *   it is labelled because a guess that is counted alongside facts stops
 *   being distinguishable from one.
 *
 * A consumer that wants only the defensible half filters to `anchor` and
 * `reference`. That is why the field is on every op rather than a summary
 * statistic at the bottom.
 *
 * ## What is deliberately not here
 *
 * No score, and no ratio. The plan's own reason for the personas applies
 * exactly: a number computed over a handful of asks is noise wearing a
 * decimal point. This returns counts and rows; whoever reads them can see how
 * few there are.
 */
/** What became of an ask. */
type AskOutcome = 
/** Somebody other than the asker replied in the thread. */
"answered"
/** The asker called it off — a `/cancel` later in the same thread. */
 | "cancelled"
/** Nothing came back. The quiet half, and the one worth looking at. */
 | "silent";
/** How an op was tied to an ask. See the file comment: `window` is a guess. */
export type Attribution = "anchor" | "reference" | "window";
interface AttributedOp {
    seq: number;
    type: string;
    itemId?: string;
    how: Attribution;
    /** True when a person later reversed this op — implicit negative feedback,
     * already written down. Derived from the log's own undo entries by
     * `undoneSeqs`, NOT from `LogEntry.undoneBy`, which never crosses the wire
     * and would make this permanently false. */
    undone: boolean;
}
/**
 * **What kind of ask this is** — Stage 1's taxonomy, the categories that came
 * out of hand-labelling every human ask at one home on 3 September 2026
 * (`docs/research/2026-09-03-what-people-ask-agents-for.md`), not ones
 * brought to the data. Fifteen, and the first eleven are the work:
 *
 * - `create` — something that did not exist: a screen, an app, a deck, a
 *   card, a diagram, a wireframe, a drawing.
 * - `revise` — change a thing that exists: swap an image, reword, add a
 *   bullet, reorder, animate, a hover state.
 * - `restyle` — the look of a thing that exists: redesign, apply a design
 *   system, "make it pop".
 * - `variation` — several takes to choose between; diverge.
 * - `converge` — pick one, merge two, apply the chosen version.
 * - `critique` — compare, audit, judge, grill.
 * - `repair` — it is broken, or the last answer missed.
 * - `arrange` — tidy, format, rearrange, merge layers, delete.
 * - `document` — write it down: a README, a spec, a design system, an IA.
 * - `question` — explain, how does it work, what would happen.
 * - `orchestrate` — point an agent at work: a bare mention, "this one's for
 *   you", "are you there", running a sprint.
 * - `ops`, `cancel`, `social`, `probe` — the rest: deploy it; call it off;
 *   thanks and hello; a test canvas's echo.
 *
 * `categoriseAsk` is a classifier over words, calibrated against those hand
 * labels and reported with its agreement rather than trusted — the research
 * note carries the number. It exists so the distribution can be read for a
 * canvas nobody has labelled, with that caveat attached.
 */
export type AskCategory = "create" | "revise" | "restyle" | "variation" | "converge" | "critique" | "repair" | "arrange" | "document" | "question" | "orchestrate" | "ops" | "cancel" | "social" | "probe";
export declare function categoriseAsk(body: string, command: string | null): AskCategory;
interface AskEntry {
    threadId: string;
    commentId: string;
    at: string;
    askedBy: {
        id: string;
        name: string;
    };
    /** Actor ids the comment @-mentioned, as resolved when it was written. */
    askedOf: string[];
    /** Landed in the Chat, which reaches every agent with no mention needed. */
    main: boolean;
    /** Whether somebody was named, or the Chat reached everybody. See `askKind`:
     * `broadcast` is an upper bound on a canvas with no enrolled agents. */
    kind: AskKind;
    /** The slash command it opened with, if it opened with one — `/design-audit`
     * and `/format` are asks with a known shape, and knowing which is most of
     * Stage 1's taxonomy for free. */
    command: string | null;
    /** What kind of ask, by `categoriseAsk` — a classifier's reading, not a
     * label. The research note reports how often it agrees with a person. */
    category: AskCategory;
    /** The words. Never leaves the machine: see `plan.md` Stage 6, which puts
     * comment text on the list of what is never sent on any setting. */
    body: string;
    outcome: AskOutcome;
    /** How long until somebody answered, in seconds. Only for `answered`. */
    answeredIn?: number;
    answeredBy?: string;
    produced: AttributedOp[];
}
interface CorpusSummary {
    asks: number;
    /** The two populations, apart. `addressed` is measured; `broadcast` is an
     * upper bound unless every agent here has been enrolled. */
    addressed: number;
    broadcast: number;
    /** True when `canvas.agents` is empty, so nothing could be excluded as an
     * agent's own reply. The reader needs this to know which number they hold. */
    broadcastUnfiltered: boolean;
    answered: number;
    cancelled: number;
    silent: number;
    /** Ops attributed at all, and the defensible subset. Reported apart so the
     * difference between "we know" and "we think" is visible without arithmetic. */
    opsAttributed: number;
    opsByAnchorOrReference: number;
    /** Attributed ops a person reversed. */
    opsUndone: number;
    /** Asks that opened with a slash command, by name, commonest first. */
    commands: {
        name: string;
        count: number;
    }[];
    /** Asks by category, commonest first — the classifier's reading of every
     * row here, agent receipts included. Read with the caveat on `category`. */
    categories: {
        name: AskCategory;
        count: number;
        silent: number;
    }[];
}
interface Corpus {
    summary: CorpusSummary;
    asks: AskEntry[];
}
/**
 * Is this comment an ask, and of which kind?
 *
 * Two populations, counted apart on purpose:
 *
 * - `addressed` — it @-mentions somebody. Recorded at authoring time by the
 *   person who meant it, so this is a fact.
 * - `broadcast` — it landed in the Chat, which reaches every agent with no
 *   mention needed. That is what makes the Chat the Chat, and it is why a
 *   parked agent wakes on all of it.
 *
 * **They are reported separately because `broadcast` overcounts, and the
 * canvas cannot always tell how much.** In the Chat an agent's own receipt
 * looks exactly like a question: same shape, same channel, and nothing in the
 * comment says which it is. Where somebody has run `agent.enroll` the canvas
 * DOES know — `canvas.agents` is a durable record of who answers here — and
 * an enrolled agent's own Chat comments are excluded below. Where nobody has
 * enrolled anybody, they are not, and the `broadcast` count is an upper bound
 * rather than a measurement.
 *
 * Measured on a real canvas the day this was written: 11 rows, of which 7
 * were an agent's own replies. That is the whole reason the split exists.
 * There is no `isAgent` bit on `Actor` to reach for instead, and inventing
 * one here would be a second opinion about identity; the roster owns that.
 */
type AskKind = "addressed" | "broadcast";
/**
 * Every ask on this canvas, oldest first, with what followed it.
 *
 * `log` is the whole record — archive first, then live, exactly as
 * `buildRecap` takes it — because an ask from three weeks ago is the
 * interesting kind and `gc` may have compacted it.
 */
export declare function buildCorpus(canvas: CanvasContents, log: LogEntry[]): Corpus;
/**
 * **The converge lane's landings, and whether they were kept** — the night
 * shift's step 3 (`docs/research/2026-08-24-the-night-shift.md`): one
 * measured fix per night, landed as a version, kept or reverted by a person
 * in the morning. The accept rate is the trust battery's first reading.
 *
 * A landing is recorded on the item it landed on, as `converged` —
 * `<versionId>@<iso>`, comma-separated when there have been several — by
 * `scripts/converge-night.mjs` the moment it stacks the version. Nothing
 * else marks it: versions have no properties of their own, and a comment is
 * prose. So this reads the property and the stack together, and says of each
 * landing:
 *
 * - `reverted` — the current version is EARLIER in the stack than the
 *   landing: somebody brought a previous take back. That is the morning's
 *   "no", and it is a labelled rejection.
 * - `built-on` — a later version exists. Somebody kept working on top of
 *   the night's change, which is the strongest "yes" there is.
 * - `kept` — the landing is still current and old enough that a morning
 *   has passed over it.
 * - `standing` — still current, too new to call. Not a yes yet.
 *
 * The accept rate is kept-or-built-on over everything that has been judged;
 * `standing` is excluded rather than counted either way, so a fresh night
 * cannot inflate or deflate the battery before anyone has looked.
 */
export declare const CONVERGED_PROP = "converged";
/** How long a landing must stand before silence counts as keeping it. */
export declare const KEPT_AFTER_MS: number;
export type LandingStatus = "reverted" | "built-on" | "kept" | "standing";
export interface Landing {
    itemId: string;
    title: string;
    versionId: string;
    landedAt: string;
    status: LandingStatus;
}
export interface ConvergeReport {
    landings: Landing[];
    kept: number;
    reverted: number;
    standing: number;
    /** kept-or-built-on ÷ (kept-or-built-on + reverted); null until something has been judged. */
    acceptRate: number | null;
}
/** The property's value for one more landing — appended, never replaced. */
export declare function withLanding(existing: string | undefined, versionId: string, at: string): string;
export declare function landingsOf(item: Item): {
    versionId: string;
    landedAt: string;
}[];
export declare function harvestConverge(canvas: CanvasContents, now?: number): ConvergeReport;
/**
 * **Preference pairs, harvested from version stacks** — the plan's "what to do
 * first" #2, and the thing it calls the single highest-leverage item in the
 * document.
 *
 * The claim being tested: `/variation` produces N alternatives and
 * `item.setCurrentVersion` records which one won, so a canvas in ordinary use
 * generates human-labelled comparison data for free.
 *
 * **A pair only exists when there was a choice.** Promoting the only version
 * on a stack is not a preference, and neither is promoting the newest one that
 * has just arrived — those are a no-op and a save. What counts is somebody
 * making an EARLIER version current again while later ones existed: that is a
 * person looking at N things and keeping one, which is the expensive kind of
 * label. Counting every `setCurrentVersion` would inflate the number with
 * saves, and an inflated count here would be read as "Stage 4's calibration
 * problem is solved" when it is not.
 */
interface PreferencePair {
    itemId: string;
    title: string;
    /** The version made current. */
    chosen: string;
    chosenAt: string;
    chosenBy: string;
    /** Every version that existed at that moment and was not chosen. */
    against: string[];
}
export declare function harvestPreferences(canvas: CanvasContents, log: LogEntry[]): PreferencePair[];
export {};
