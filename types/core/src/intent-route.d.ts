/**
 * **The Chat intent router's vocabulary** (local-judge phase 1,
 * `docs/projects/local-judge/ideas.md`, *1. The Chat intent router*): seven
 * routes, what each means in the words a judge reads, how `categoriseAsk`'s
 * fifteen categories map onto them, the state a judge is shown (capped), the
 * policy that turns a route into what may happen, and the deterministic
 * split an evaluation set is cut by.
 *
 * Pure and shared: the harness (`scripts/local-judge/`), the review page and
 * the tests read one file, so a route cannot mean one thing to the judge and
 * another to the scorer. No Node import.
 */
import { type AskCategory } from "./evals.js";
import { type JevQuestion, type JevRequest } from "./jev.js";
import { type MarginCut } from "./threshold.js";
/** The seven acts a Chat line can be, in isocan's own commands. */
export declare const ROUTES: readonly ["wire", "edit-selection", "variation", "find", "ask-agent", "clarify", "just-a-comment"];
/** One of the seven routes. */
export type Route = (typeof ROUTES)[number];
/** Is this string one of the seven routes — the check a labels file or a reading meets. */
export declare function isRoute(x: unknown): x is Route;
/**
 * **What each route means, as the criteria a judge scores.** One sentence
 * each, written for a model that reads the ask and the state together; the
 * same words go to the local judge and to Jev, so the two are asked the same
 * question.
 */
export declare const ROUTE_ABOUT: Record<Route, string>;
/** The routing question, as a Jev choice — and so, through `jevToChoice`, as the local judge's. */
export declare const ROUTE_QUESTION: Extract<JevQuestion, {
    type: "choice";
}>;
/**
 * **`categoriseAsk`'s fifteen categories onto the seven routes** — approach A.
 * `clean: false` marks a category that does not land on one route without
 * losing something; `why` says what. Nothing maps to `find` or `clarify`:
 * the categories came from asks people actually made of agents, and neither
 * "show me where X is" nor "this is too vague to act on" was one of them.
 */
export declare const CATEGORY_ROUTE: Record<AskCategory, {
    route: Route;
    clean: boolean;
    why?: string;
}>;
/** The route a `categoriseAsk` category maps to. */
export declare function routeOfCategory(category: AskCategory): Route;
/** **Judge A**: the regex classifier, mapped. Always answers; it has no confidence to threshold. */
export declare function baselineRoute(body: string): Route;
/** The structured state the app already knows when a Chat line is written. */
export interface RouteState {
    /** How many items the person had selected (or referred to) when they wrote it. */
    selected: number;
    /** Their role on this canvas. */
    role: "editor" | "viewer";
    /** Modules present on the canvas, when known. */
    modules?: string[];
}
/** The cap on what a judge reads (local-judge phase 0's bar holds at 128 tokens, not at 512). */
export declare const STATE_TOKEN_CAP = 128;
/**
 * Tokens, estimated: four characters each. The model's own count is
 * MediaPipe's and lives in the browser; this is the bound the text is cut to
 * before it gets there, and the harness records the model's count beside it.
 */
export declare function approxTokens(text: string): number;
/**
 * **The ask and its state, as the one string a judge reads**, capped at
 * `cap` tokens. The state line comes first and is never cut; the ask is cut
 * at a word boundary with an ellipsis, and `truncated` says so — a longer ask
 * is recorded as truncated, never silently shortened.
 */
export declare function routeStateText(ask: string, state: RouteState, cap?: number): {
    text: string;
    truncated: boolean;
    tokens: number;
};
/** One request for one ask: the routing question over its state text. */
export declare function routeRequest(text: string, model?: string): JevRequest;
/**
 * What may happen once a route is known — the second expected output a
 * fixture carries (`design.md`, *The policy layer*):
 *
 * - `suggest` — offer the command.
 * - `select-first` — the act needs a selection and nothing is selected.
 * - `refuse` — the intent is recognised and the person may not do it here.
 * - `unavailable` — the act's module is not on this canvas.
 * - `clarify` — ask what they mean (the route itself, or a judge below its cut).
 * - `nothing` — no act; the line stays a comment.
 */
export type Disposition = "suggest" | "select-first" | "refuse" | "unavailable" | "clarify" | "nothing";
/** Every disposition, for checking a fixture or a labels file. */
export declare const DISPOSITIONS: readonly Disposition[];
/**
 * **Deterministic, and reads only the structured state** — never asks a
 * model to infer it. A read-only canvas refuses an edit intent; it never
 * turns it into a different intent. `accepted: false` (the judge was under
 * its frozen cut) is `clarify`, whatever the route.
 */
export declare function disposition(route: Route, state: RouteState, accepted?: boolean): Disposition;
/** Development (fits a head), calibration (chooses a cut), locked (scored once, never tuned on). */
export type Split = "dev" | "calibration" | "locked";
/** The three splits, in the order a report shows them. */
export declare const SPLITS: readonly Split[];
/**
 * **Which split a scenario falls in** — half development, a quarter
 * calibration, a quarter locked, by a hash of the seed and the SCENARIO, so
 * every paraphrase of one scenario lands together and the same seed cuts the
 * same way on any machine.
 */
export declare function splitOf(scenario: string, seed: string): Split;
/**
 * A real ask's scenario: its words, lowercased, mentions and punctuation
 * gone — so the same ask posted twice (or to two agents) is one scenario and
 * cannot sit on both sides of a split.
 */
export declare function scenarioOf(body: string): string;
/** A judge's whole distribution, read as the winner, its probability and its margin over the runner-up. */
export declare function winnerOf(probabilities: Partial<Record<Route, number>>): {
    route: Route;
    p: number;
    margin: number;
};
/** One case, judged. */
export interface Judged {
    id: string;
    truth: Route;
    predicted: Route;
    p: number;
    margin: number;
    state: RouteState;
    /** The disposition the case expects, where it says (the synthetic set does). */
    truthDisposition?: Disposition;
    tags?: string[];
}
interface Rate {
    k: number;
    n: number;
    rate: number | null;
    ci: {
        lo: number;
        hi: number;
    };
}
/** One judge's numbers on one split under one cut — what `scoreRoutes` returns. */
export interface RouteScore {
    n: number;
    /** Right among the answers the cut accepted. */
    accuracy: Rate;
    /** Accepted among all. */
    coverage: Rate;
    perRoute: Array<{
        route: Route;
        n: number;
        accepted: number;
        right: number;
        accuracy: Rate;
    }>;
    /**
     * **Confident errors where acting is worst**: accepted and wrong on a case
     * whose truth is *do nothing* (`just-a-comment`), and the subset tagged
     * unrelated. These are the ones a suggestion line would put in front of a
     * person who asked for nothing.
     */
    confidentErrors: {
        noAction: Rate;
        unrelated: Rate;
    };
    /** The policy's disposition from the judged route (abstaining → clarify) against the expected one, where cases carry one. */
    disposition: Rate | null;
}
/**
 * **A judge's numbers under a cut** — accuracy among accepted answers,
 * coverage, per route, confident errors on no-action and unrelated asks,
 * each with its Wilson interval. `cut: "all"` accepts every answer (judge A,
 * which has no confidence; or any judge before a threshold is frozen); a
 * null cut accepts nothing.
 */
export declare function scoreRoutes(rows: readonly Judged[], cut: Pick<MarginCut, "p" | "margin"> | null | "all"): RouteScore;
export {};
