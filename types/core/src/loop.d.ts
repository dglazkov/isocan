/**
 * **Loop's insights, triaged here rather than trusted there.**
 *
 * Stitch Loop mines a repository against standing priorities and files
 * *insights*. It files them generously — near-duplicates under new ids, claims
 * about code that has since changed, work already done — and ranks them by its
 * own lights. So an insight is an input, not a verdict. Each one becomes a
 * *finding* in `docs/loop/`, where the ranking, the project it belongs to and
 * the decision are ours.
 *
 * The same rule as the roadmap: the decision lives in the finding's own front
 * matter, and every view of it — `docs/LOOP.md`, the Loop column in
 * `docs/ROADMAP.md`, the context sent back to Loop — is derived from those
 * files. Nothing stores what can be computed, including whether a dismissal
 * still needs sending: that is read off Loop's own state for the ids.
 *
 * Pure on purpose. The reading of files and the talking to the `stitch` CLI
 * are `scripts/loop.mjs`; nothing here touches either, so the reducer's
 * package stays portable.
 */
/**
 * Where a finding stands.
 *
 * - `untriaged` — pulled from Loop, nobody has read it.
 * - `proposed`  — someone (usually an agent) has checked the claim against the
 *   code and proposed a rank and a home. Waiting on a person.
 * - `accepted`  — a person agreed it is work; it belongs to `project`.
 * - `declined`  — a person said no, and `note` says why. Dismissed in Loop.
 * - `stale`     — the claim does not match the code (fixed since, or never
 *   true). Dismissed in Loop, with the evidence in `note`.
 * - `done`      — accepted and then fixed.
 */
declare const LOOP_DECISIONS: readonly ["untriaged", "proposed", "accepted", "declined", "stale", "done"];
type LoopDecision = (typeof LOOP_DECISIONS)[number];
/** Decisions that end a finding's life in Loop: they are sent as dismissals. */
export declare const DISMISSED_BY_US: readonly LoopDecision[];
/**
 * Our priority, deliberately not Loop's P0–P3 vocabulary, so the two can never
 * be confused in a diff. `never` on a proposal is a recommendation to decline.
 */
declare const LOOP_RANKS: readonly ["now", "next", "later", "never"];
type LoopRank = (typeof LOOP_RANKS)[number];
type LoopState = "ACTIVE" | "RESOLVED" | "DISMISSED";
/** One insight as Loop reports it, reduced to what triage uses. */
export interface LoopInsight {
    id: string;
    title: string;
    description: string;
    state: LoopState;
    /** Loop's own "P2", or "P2/S1" when it sends a severity too. */
    rank: string;
    confidence: number | null;
    /** The name of the standing priority it was mined against, when known. */
    goal: string | null;
    files: string[];
}
/** One insight of Loop's as this repo holds it: its claim, and OUR decision beside it. */
export interface LoopFinding {
    slug: string;
    title: string;
    /** Every Loop insight id filed for this finding. Loop re-files; they all land here. */
    loop: string[];
    /** Loop's most severe rank across those ids, kept only for comparison. */
    loop_rank: string | null;
    /** Loop's aggregate state across those ids, as of the last pull. */
    loop_state: LoopState | null;
    loop_goal: string | null;
    decision: LoopDecision;
    rank: LoopRank | null;
    /** The `docs/projects/<name>` this belongs to, or "new" to propose one. */
    project: string | null;
    /** The `docs/reviews/lessons.md` row whose shape this is an instance of. */
    lesson: number | null;
    since: string | null;
    note: string | null;
    body: string;
}
/** A finding file read back: front matter through core's one reader, the body as written. */
export declare function parseFinding(raw: string, slug: string): LoopFinding;
/** A finding as the file it is: fields in a fixed order, so a diff shows what changed and not what moved. */
export declare function serializeFinding(f: LoopFinding): string;
export declare function findingProblems(f: LoopFinding, projects?: readonly string[]): string[];
/**
 * A finding's filename stem from its title — core's one title-to-filename rule,
 * cut at a word boundary so a slug never ends in half a word.
 */
export declare function slugify(title: string): string;
/**
 * One raw insight from `stitch find insights --format json`. `goalTitles` maps
 * a priority id to its name, so a finding says "Always isomorphic" and not an
 * id nobody can read.
 */
export declare function normalizeInsight(raw: Record<string, any>, goalTitles?: ReadonlyMap<string, string>): LoopInsight;
interface LoopReconciled {
    findings: LoopFinding[];
    /** Newly created, by slug. */
    added: string[];
    /** Existing findings that gained a re-filed Loop id, by slug. */
    refiled: string[];
    /** Findings whose ids Loop now reports all resolved, while we have not said done. */
    resolvedInLoop: string[];
    /** Findings dismissed in Loop that nobody here has decided on. */
    dismissedInLoop: string[];
}
/**
 * Fold a fresh pull from Loop into the findings on disk.
 *
 * An insight joins the finding that already holds its id, else the one with
 * the same title (Loop's re-filings keep the title and mint a new id), else it
 * starts a new finding. Our fields — decision, rank, project, note, body — are
 * never touched: a pull refreshes what Loop says, not what we decided.
 */
export declare function reconcile(existing: LoopFinding[], insights: LoopInsight[]): LoopReconciled;
/**
 * Loop ids that still need dismissing: every id of a finding we declined or
 * found stale that Loop still shows as active. Derived from Loop's own state,
 * so re-filed ids are covered without anyone remembering to.
 */
export declare function pendingDismissals(findings: LoopFinding[], insights: LoopInsight[]): {
    slug: string;
    id: string;
}[];
/** Per project: how many findings are accepted and how many await a decision. */
export declare function projectCounts(findings: LoopFinding[]): Map<string, {
    accepted: number;
    proposed: number;
}>;
/** What each decision means, counted — the line the roadmap and LOOP.md both print. */
export declare function loopSummary(findings: LoopFinding[]): string;
/** `docs/LOOP.md`: every finding, by what it needs from a person. */
export declare function renderLoopDoc(findings: LoopFinding[]): string;
/**
 * The context sent back to Loop. Loop takes context as JSON and reads it while
 * mining: what we decided and why, so the next pass does not re-file what was
 * declined. Decisions only — a proposal is not ours until a person makes it,
 * so nothing merely proposed is sent, and nothing at all is sent while there is
 * nothing decided (`decisions` empty).
 */
export declare function loopContextPayload(findings: LoopFinding[]): {
    kind: string;
    guidance: string;
    decisions: {
        title: string;
        decision: "done" | "stale" | "accepted" | "untriaged" | "proposed" | "declined";
        rank: "now" | "never" | "later" | "next" | null;
        project: string | null;
        reason: string | null;
        decided: string | null;
        insights: string[];
    }[];
};
/**
 * The prompt handed to the harness when proving an untriaged Loop finding
 * against the codebase (`node scripts/loop.mjs pull` / `prove`).
 *
 * Pure and in core so the contract — prove every sub-claim against the code,
 * leave no unverified hedges, record via `loop.mjs propose`, never `decide` or
 * `push` — is tested without spawning a model.
 */
export declare function provePrompt(f: LoopFinding, projects: readonly string[]): string;
/**
 * CLI arguments for the bounded `claude -p` proof pass over one untriaged finding.
 */
export declare function proveArgs(prompt: string): string[];
export {};
