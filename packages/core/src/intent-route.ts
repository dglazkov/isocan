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
import { categoriseAsk, type AskCategory } from "./evals.ts";
import { parseSlashCommand } from "./commands.ts";
import { JEV_MODEL, type JevQuestion, type JevRequest } from "./jev.ts";
import { accepts, wilson, type MarginCut } from "./threshold.ts";

// ---------- the routes

/** The seven acts a Chat line can be, in isocan's own commands. */
export const ROUTES = ["wire", "edit-selection", "variation", "find", "ask-agent", "clarify", "just-a-comment"] as const;
/** One of the seven routes. */
export type Route = (typeof ROUTES)[number];

/** Is this string one of the seven routes — the check a labels file or a reading meets. */
export function isRoute(x: unknown): x is Route {
  return typeof x === "string" && (ROUTES as readonly string[]).includes(x);
}

/**
 * **What each route means, as the criteria a judge scores.** One sentence
 * each, written for a model that reads the ask and the state together; the
 * same words go to the local judge and to Jev, so the two are asked the same
 * question.
 */
export const ROUTE_ABOUT: Record<Route, string> = {
  wire: "Make something new that does not exist yet: a new screen, page, app, wireframe, card, diagram or drawing",
  "edit-selection": "Change something that already exists: reword, restyle, fix, resize, reorder, tidy or delete the item it is about",
  variation: "Make several alternative versions or takes of an item to compare and choose between",
  find: "Locate or show an item that is already on the canvas, by what it is about",
  "ask-agent": "Ask an agent to think, answer a question, explain, review, critique, document or take on a piece of work",
  clarify: "A request too vague or ambiguous to act on without asking the person what they mean",
  "just-a-comment": "Not a request to act at all: thanks, a greeting, a note, a quotation, a decision not to change something, or talk between people",
};

/** The routing question, as a Jev choice — and so, through `jevToChoice`, as the local judge's. */
export const ROUTE_QUESTION: Extract<JevQuestion, { type: "choice" }> = {
  type: "choice",
  instructions: "A person wrote this message in a design canvas's chat. Which act does the message ask for?",
  criteria: { ...ROUTE_ABOUT },
};

// ---------- categoriseAsk, mapped

/**
 * **`categoriseAsk`'s fifteen categories onto the seven routes** — approach A.
 * `clean: false` marks a category that does not land on one route without
 * losing something; `why` says what. Nothing maps to `find` or `clarify`:
 * the categories came from asks people actually made of agents, and neither
 * "show me where X is" nor "this is too vague to act on" was one of them.
 */
export const CATEGORY_ROUTE: Record<AskCategory, { route: Route; clean: boolean; why?: string }> = {
  create: { route: "wire", clean: false, why: "create covers decks, cards and drawings as well as screens; wire is the screen-shaped half" },
  revise: { route: "edit-selection", clean: true },
  restyle: { route: "edit-selection", clean: true },
  variation: { route: "variation", clean: true },
  converge: { route: "edit-selection", clean: false, why: "picking or merging takes changes an existing item, but its own verb is `choose`, not an edit" },
  critique: { route: "ask-agent", clean: true },
  repair: { route: "edit-selection", clean: false, why: "a repair is often of the agent's last answer rather than of a selected item" },
  arrange: { route: "edit-selection", clean: false, why: "tidy and delete act on many items or the canvas, not one selection" },
  document: { route: "ask-agent", clean: false, why: "writing a doc creates an item, but no route makes documents" },
  question: { route: "ask-agent", clean: false, why: "a \"where is…\" question is find; the categories cannot tell it from \"how does…\"" },
  orchestrate: { route: "ask-agent", clean: true },
  ops: { route: "ask-agent", clean: true },
  cancel: { route: "just-a-comment", clean: false, why: "`/cancel` is a command of its own, outside the seven routes" },
  social: { route: "just-a-comment", clean: true },
  probe: { route: "just-a-comment", clean: true },
};

/** The route a `categoriseAsk` category maps to. */
export function routeOfCategory(category: AskCategory): Route {
  return CATEGORY_ROUTE[category].route;
}

/** **Judge A**: the regex classifier, mapped. Always answers; it has no confidence to threshold. */
export function baselineRoute(body: string): Route {
  return routeOfCategory(categoriseAsk(body, parseSlashCommand(body)?.name ?? null));
}

// ---------- the state a judge reads

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
export const STATE_TOKEN_CAP = 128;

/**
 * Tokens, estimated: four characters each. The model's own count is
 * MediaPipe's and lives in the browser; this is the bound the text is cut to
 * before it gets there, and the harness records the model's count beside it.
 */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * **The ask and its state, as the one string a judge reads**, capped at
 * `cap` tokens. The state line comes first and is never cut; the ask is cut
 * at a word boundary with an ellipsis, and `truncated` says so — a longer ask
 * is recorded as truncated, never silently shortened.
 */
export function routeStateText(ask: string, state: RouteState, cap = STATE_TOKEN_CAP): { text: string; truncated: boolean; tokens: number } {
  const selection = state.selected === 0 ? "nothing selected" : `${state.selected} item${state.selected === 1 ? "" : "s"} selected`;
  const head = `[${selection}; ${state.role === "viewer" ? "read-only" : "can edit"}${state.modules?.length ? `; modules: ${state.modules.join(", ")}` : ""}]\n`;
  const body = ask.replace(/\s+/g, " ").trim();
  const full = head + body;
  if (approxTokens(full) <= cap) return { text: full, truncated: false, tokens: approxTokens(full) };
  const room = Math.max(0, cap * 4 - head.length - 1);
  const cut = body.slice(0, room);
  const atWord = cut.lastIndexOf(" ") > room * 0.6 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  const text = `${head}${atWord}…`;
  return { text, truncated: true, tokens: approxTokens(text) };
}

/** One request for one ask: the routing question over its state text. */
export function routeRequest(text: string, model = JEV_MODEL): JevRequest {
  return { model, state: text, questions: { route: ROUTE_QUESTION } };
}

// ---------- the policy layer

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
export const DISPOSITIONS: readonly Disposition[] = ["suggest", "select-first", "refuse", "unavailable", "clarify", "nothing"];

const CHANGES_CANVAS: ReadonlySet<Route> = new Set(["wire", "edit-selection", "variation"]);
const NEEDS_SELECTION: ReadonlySet<Route> = new Set(["edit-selection", "variation"]);
/** The module a route's command lives in, when it lives in one. */
const NEEDS_MODULE: Partial<Record<Route, string>> = { wire: "wireframe" };

/**
 * **Deterministic, and reads only the structured state** — never asks a
 * model to infer it. A read-only canvas refuses an edit intent; it never
 * turns it into a different intent. `accepted: false` (the judge was under
 * its frozen cut) is `clarify`, whatever the route.
 */
export function disposition(route: Route, state: RouteState, accepted = true): Disposition {
  if (!accepted || route === "clarify") return "clarify";
  if (route === "just-a-comment") return "nothing";
  if (CHANGES_CANVAS.has(route) && state.role === "viewer") return "refuse";
  const module = NEEDS_MODULE[route];
  if (module && state.modules && !state.modules.includes(module)) return "unavailable";
  if (NEEDS_SELECTION.has(route) && state.selected === 0) return "select-first";
  return "suggest";
}

// ---------- the splits

/** Development (fits a head), calibration (chooses a cut), locked (scored once, never tuned on). */
export type Split = "dev" | "calibration" | "locked";
/** The three splits, in the order a report shows them. */
export const SPLITS: readonly Split[] = ["dev", "calibration", "locked"];

/** FNV-1a, 32-bit, as a number in [0, 1). */
function unitHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 2 ** 32;
}

/**
 * **Which split a scenario falls in** — half development, a quarter
 * calibration, a quarter locked, by a hash of the seed and the SCENARIO, so
 * every paraphrase of one scenario lands together and the same seed cuts the
 * same way on any machine.
 */
export function splitOf(scenario: string, seed: string): Split {
  const u = unitHash(`${seed}\u0000${scenario}`);
  return u < 0.5 ? "dev" : u < 0.75 ? "calibration" : "locked";
}

/**
 * A real ask's scenario: its words, lowercased, mentions and punctuation
 * gone — so the same ask posted twice (or to two agents) is one scenario and
 * cannot sit on both sides of a split.
 */
export function scenarioOf(body: string): string {
  return body
    .toLowerCase()
    .replace(/@[\w'’.-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// ---------- scoring

/** A judge's whole distribution, read as the winner, its probability and its margin over the runner-up. */
export function winnerOf(probabilities: Partial<Record<Route, number>>): { route: Route; p: number; margin: number } {
  const ranked = ROUTES.map((r) => ({ r, p: probabilities[r] ?? 0 })).sort((a, b) => b.p - a.p);
  return { route: ranked[0]!.r, p: ranked[0]!.p, margin: ranked[0]!.p - (ranked[1]?.p ?? 0) };
}

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

interface Rate { k: number; n: number; rate: number | null; ci: { lo: number; hi: number } }
const rate = (k: number, n: number): Rate => ({ k, n, rate: n ? k / n : null, ci: wilson(k, n) });

/** One judge's numbers on one split under one cut — what `scoreRoutes` returns. */
export interface RouteScore {
  n: number;
  /** Right among the answers the cut accepted. */
  accuracy: Rate;
  /** Accepted among all. */
  coverage: Rate;
  perRoute: Array<{ route: Route; n: number; accepted: number; right: number; accuracy: Rate }>;
  /**
   * **Confident errors where acting is worst**: accepted and wrong on a case
   * whose truth is *do nothing* (`just-a-comment`), and the subset tagged
   * unrelated. These are the ones a suggestion line would put in front of a
   * person who asked for nothing.
   */
  confidentErrors: { noAction: Rate; unrelated: Rate };
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
export function scoreRoutes(rows: readonly Judged[], cut: Pick<MarginCut, "p" | "margin"> | null | "all"): RouteScore {
  const ok = (r: Judged) => (cut === "all" ? true : accepts(cut, r));
  const kept = rows.filter(ok);
  const right = (r: Judged) => r.predicted === r.truth;
  const noAction = rows.filter((r) => r.truth === "just-a-comment");
  const unrelated = rows.filter((r) => r.tags?.includes("unrelated"));
  const withDisposition = rows.filter((r) => r.truthDisposition !== undefined);
  return {
    n: rows.length,
    accuracy: rate(kept.filter(right).length, kept.length),
    coverage: rate(kept.length, rows.length),
    perRoute: ROUTES.map((route) => {
      const of = rows.filter((r) => r.truth === route);
      const acc = of.filter(ok);
      return { route, n: of.length, accepted: acc.length, right: acc.filter(right).length, accuracy: rate(acc.filter(right).length, acc.length) };
    }),
    confidentErrors: {
      noAction: rate(noAction.filter((r) => ok(r) && !right(r)).length, noAction.length),
      unrelated: rate(unrelated.filter((r) => ok(r) && !right(r)).length, unrelated.length),
    },
    disposition: withDisposition.length
      ? rate(withDisposition.filter((r) => disposition(r.predicted, r.state, ok(r)) === r.truthDisposition).length, withDisposition.length)
      : null,
  };
}
