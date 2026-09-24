/**
 * **The fast path's resolver, pure** (voice-agent phase 6,
 * `docs/projects/voice-agent/fast-path.md`).
 *
 * One finished user turn becomes ONE question file for Jev: which of the
 * fast-path acts the utterance asks for, which item it acts on, where it puts
 * it, relative to which other item, and whether the whole thing is one act on
 * things already here. The options are generated — the acts from the voice
 * tools that exist (`LIVE_TOOLS`), the items from the same projection of the
 * canvas the live model is given — so nothing here is a list somebody has to
 * keep in step by hand.
 *
 * The answers become a PROPOSAL: a tool call in the live model's own
 * vocabulary (`move_item`, `resize_item`, …), or an escalation with its
 * reasons. Whether a proposal is acted on is `decide`, and it acts only above
 * a threshold MEASURED per action; phase 6 has none, so every proposal
 * escalates and the shadow record is where they are compared with what the
 * model actually did.
 *
 * No socket, no fetch, no host: this file can mint nothing. Both the talk
 * module and `scripts/fast-path-eval.ts` import it, which is what makes the
 * eval a measurement of the code that runs in the browser rather than of a
 * copy of it.
 */
import { JUDGMENT_MAX_BYTES, itemColour } from "@isocan/core";
import { JEV_MODEL, chosenOption, type JevAnswer, type JevQuestion, type JevRequest, type JevResponse } from "@isocan/core/jev";
import { LIVE_TOOLS, canvasSnapshotText, type SnapshotItem } from "./live.ts";

// ---------- the vocabulary

/**
 * **The fast-path acts, each one an existing tool.** No new tool and no new
 * operation (fast-path.md, *What it refuses*): an act is here only because a
 * tool the live model already calls does it, and `fastActs` drops any whose
 * tool is not declared.
 *
 * Resize is two acts rather than one because Jev answers choices, never
 * numbers: "make it bigger" is a choice, "make it 400 wide" is a number and
 * belongs to the model. `align` is in the design's list and NOT here — no
 * voice tool aligns (`move_item`'s `beside_ref` lines two things up, which is
 * `move` with a target); an act without a tool would be a second executor.
 */
export const FAST_ACTS = {
  move: {
    tool: "move_item",
    words: "Move ONE item: in a direction (left, right, up, down) or next to / left of / right of / above / below another item on the canvas.",
  },
  grow: {
    tool: "resize_item",
    words: "Make ONE item bigger (larger, enlarge, blow it up) — no exact size said.",
  },
  shrink: {
    tool: "resize_item",
    words: "Make ONE item smaller (shrink, reduce, tiny) — no exact size said.",
  },
  delete: {
    tool: "delete_item",
    words: "Delete or remove ONE item (it goes to the trash).",
  },
  undo: {
    tool: "undo",
    words: "Undo the last change: 'undo', 'take that back', 'never mind', 'put it back'.",
  },
  select: {
    tool: "selection_set",
    words: "Select, pick or highlight ONE item (nothing moves).",
  },
  show: {
    tool: "viewport_focus",
    words: "Show, find, zoom to, look at or go to ONE item (the view moves, the item does not).",
  },
} as const;

export type FastAct = keyof typeof FAST_ACTS;
export const FAST_ACT_NAMES = Object.keys(FAST_ACTS) as FastAct[];

/** Which acts are available: those whose tool the live session declares. */
export function fastActs(tools: readonly { name: string }[] = LIVE_TOOLS): FastAct[] {
  const declared = new Set(tools.map((t) => t.name));
  return FAST_ACT_NAMES.filter((a) => declared.has(FAST_ACTS[a].tool));
}

export const RELATIONS = {
  "left-of": "to the left, or on the left side of another item",
  "right-of": "to the right, or on the right side of another item",
  above: "up, or above another item",
  below: "down, or below / under another item",
  beside: "next to / beside another item, no side said",
  into: "inside a group, area or frame",
  none: "no place said",
} as const;
export type Relation = keyof typeof RELATIONS;

/** Jev's per-question option limit — a choice over more is refused, so a canvas with more items than fit escalates. */
export const MAX_OPTIONS = 255;
/** How far a bare "move it left" goes, in world pixels. The model picks its own; agreement is on the direction. */
export const NUDGE = 160;
/** "Bigger" and "smaller", as a factor on both sides. */
export const GROW = 1.5;
/** Headroom under the home's question-file limit for the envelope (`canvasId`, `model`). */
const BYTES_HEADROOM = 512;

// ---------- the canvas, as the fast path sees it

export interface FastPathCanvas {
  /** The projection the model is given — `snapshotItemsFor` in the browser, a fixture in the eval. */
  items: SnapshotItem[];
  /** The last act on this canvas in this conversation, in words ("moved “Login page”"), for "it" and "that". */
  lastAct?: string;
}

/** Coarse place words from an item's centre against the canvas's extent — "the one on the left" needs a word, not a number. */
function placeWords(item: SnapshotItem, items: readonly SnapshotItem[]): string {
  if (items.length < 2) return "";
  const cx = (i: SnapshotItem) => i.x + i.width / 2;
  const cy = (i: SnapshotItem) => i.y + i.height / 2;
  const xs = items.map(cx);
  const ys = items.map(cy);
  const third = (v: number, lo: number, hi: number, words: [string, string, string]) => {
    if (hi - lo < 1) return words[1];
    const t = (v - lo) / (hi - lo);
    return t < 1 / 3 ? words[0] : t > 2 / 3 ? words[2] : words[1];
  };
  const h = third(cx(item), Math.min(...xs), Math.max(...xs), ["left", "centre", "right"]);
  const v = third(cy(item), Math.min(...ys), Math.max(...ys), ["top", "middle", "bottom"]);
  return v === "middle" && h === "centre" ? "in the middle" : `${v === "middle" ? "" : `${v} `}${h === "centre" ? "centre" : h}`.trim();
}

/** One item as an option's description: what it is, what colour the canvas knows, where it sits, whether it is picked out. */
function describeItem(item: SnapshotItem, items: readonly SnapshotItem[]): string {
  const colour = itemColour({ properties: item.properties });
  const bits = [item.kind, colour ? `${colour}` : null, placeWords(item, items), item.selected ? "SELECTED" : null];
  return bits.filter(Boolean).join(", ");
}

/**
 * Option keys for the items: the title as a person says it, unique, never
 * `none`. Two items called "Home" become "Home" and "Home (2)" — reading
 * order decides which is which, the same order the projection lists them in.
 */
export function itemOptions(items: readonly SnapshotItem[]): { criteria: Record<string, string>; ids: Record<string, string> } {
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const criteria: Record<string, string> = {};
  const ids: Record<string, string> = {};
  for (const item of ordered) {
    const base = (item.title?.trim() || `untitled ${item.kind}`).replace(/\s+/g, " ").slice(0, 60);
    let key = base.toLowerCase() === "none" ? `${base} (item)` : base;
    for (let n = 2; key in criteria; n++) key = `${base} (${n})`;
    criteria[key] = describeItem(item, ordered);
    ids[key] = item.id;
  }
  return { criteria, ids };
}

// ---------- the questions

export const QUESTION_IDS = ["action", "subject", "relation", "target", "simple"] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

/** A question file, with what its option keys mean on this canvas. */
export interface FastPathAsk {
  request: JevRequest;
  /** Option key → item id, for `subject` and `target`. */
  ids: Record<string, string>;
  acts: FastAct[];
  items: SnapshotItem[];
}

export type Generated = { ok: true; ask: FastPathAsk } | { ok: false; reason: string };

/**
 * **One finished turn, as Jev's question file** — or the reason it is not
 * asked at all. Not asking is an escalation that costs nothing: an empty
 * turn, a canvas with more items than a choice may carry, a file the home
 * would refuse for size.
 */
export function fastPathQuestions(
  utterance: string,
  canvas: FastPathCanvas,
  tools: readonly { name: string }[] = LIVE_TOOLS,
): Generated {
  const said = utterance.replace(/\s+/g, " ").trim();
  if (!said) return { ok: false, reason: "nothing was said" };
  // Items plus `none` must fit in one choice.
  if (canvas.items.length + 1 > MAX_OPTIONS) {
    return { ok: false, reason: `the canvas has ${canvas.items.length} items — more than one choice can carry (${MAX_OPTIONS - 1})` };
  }
  const acts = fastActs(tools);
  if (acts.length === 0) return { ok: false, reason: "no fast-path act has a tool in this session" };
  const { criteria, ids } = itemOptions(canvas.items);
  const pronoun =
    "\"it\", \"this\", \"that one\" mean the SELECTED item when one is selected, otherwise the item of the last act.";
  const questions: Record<string, JevQuestion> = {
    action: {
      type: "choice",
      instructions:
        "Which ONE canvas act does the person's spoken utterance ask for? It is a speech transcript, so words may be misheard. " +
        "Choose none when it asks for anything else: adding, writing, renaming or drawing something, a comment, a question, conversation, " +
        "an exact number or size, several acts, or an act not listed.",
      criteria: { ...Object.fromEntries(acts.map((a) => [a, FAST_ACTS[a].words])), none: "none of these" },
    },
    subject: {
      type: "choice",
      instructions: `Which item on the canvas does the utterance act on? ${pronoun} Choose none when it names nothing on the canvas, or something not listed.`,
      criteria: { ...criteria, none: "no item on this canvas" },
    },
    relation: {
      type: "choice",
      instructions: "Where does the utterance put the item? Choose none when it says no place.",
      criteria: { ...RELATIONS },
    },
    target: {
      type: "choice",
      instructions:
        "Which OTHER item is the place measured from (\"next to the Home screen\", \"left of the logo\")? Choose none when no second item is named.",
      criteria: { ...criteria, none: "no second item" },
    },
    simple: {
      type: "noul",
      instructions:
        "Is this exactly ONE act on things already on the canvas — nothing new to write or name, no number to choose, nothing else asked?",
      criteria: { true: "one act on existing things", false: "anything more, or anything else" },
    },
  };
  const request: JevRequest = {
    model: JEV_MODEL,
    state: {
      utterance: said,
      canvas: canvasSnapshotText(canvas.items, [], MAX_OPTIONS),
      ...(canvas.lastAct ? { lastAct: canvas.lastAct } : {}),
    },
    questions,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(request)).length;
  if (bytes > JUDGMENT_MAX_BYTES - BYTES_HEADROOM) {
    return { ok: false, reason: `the question file is ${bytes} bytes — over what the home takes` };
  }
  return { ok: true, ask: { request, ids, acts, items: canvas.items } };
}

// ---------- acts, in one comparable shape

export type Direction = "left" | "right" | "up" | "down";
export type Side = "left" | "right" | "above" | "below";

/**
 * **An act, reduced to what "the same act" means** — so Jev's proposal, the
 * model's tool calls and a fixture's intent are compared in one shape. A
 * nudge is the same act at any distance in the same direction; a resize is
 * the same act at any size in the same sense.
 */
export type CanonicalAct =
  | { act: "move-by"; subject: string; direction: Direction }
  | { act: "move-beside"; subject: string; target: string; side: Side }
  | { act: "grow" | "shrink" | "delete" | "select" | "show"; subject: string }
  | { act: "undo" }
  /** Not a fast-path act: Jev should escalate; the model did something else, or nothing. */
  | { act: "escalate" };

export type ActKind = CanonicalAct["act"];

export function sameAct(a: CanonicalAct, b: CanonicalAct): boolean {
  return JSON.stringify(canonicalKey(a)) === JSON.stringify(canonicalKey(b));
}

function canonicalKey(a: CanonicalAct): unknown[] {
  switch (a.act) {
    case "move-by":
      return [a.act, a.subject, a.direction];
    case "move-beside":
      return [a.act, a.subject, a.target, a.side];
    case "undo":
    case "escalate":
      return [a.act];
    default:
      return [a.act, a.subject];
  }
}

/** A ref as the browser's `runTool` resolves it: an id, else a unique case-insensitive title prefix. */
export function resolveRef(ref: unknown, items: readonly SnapshotItem[]): SnapshotItem | null {
  if (typeof ref !== "string" || ref.trim() === "") return null;
  const byId = items.find((i) => i.id === ref);
  if (byId) return byId;
  const lower = ref.toLowerCase();
  const byTitle = items.filter((i) => (i.title ?? "").toLowerCase().startsWith(lower));
  return byTitle.length === 1 ? byTitle[0]! : null;
}

/** What `planForCall` hears as a side — the same words, so the two cannot disagree about "under". */
function spokenSide(raw: unknown): Side | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const map: Record<string, Side> = {
    "": "right", left: "left", right: "right", above: "above", below: "below",
    "next to": "right", beside: "right", under: "below", underneath: "below", beneath: "below", over: "above", "on top of": "above",
  };
  return map[s] ?? null;
}

function direction(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
}

/** Calls that only look — the preliminaries a model makes before acting, which are not the act. */
const LOOKS = new Set(["read_canvas", "read_item", "read_threads", "read_presence", "find_items", "project_list", "search_memory", "read_memory", "list_dir", "read_file"]);

/**
 * **One tool call, as a canonical act** — `null` for a call that only looks,
 * `{act: "escalate"}` for a call that is not a fast-path act (anything the
 * fast path could not have done). Refs are resolved against the canvas as it
 * was BEFORE the act, which is what "move it left" was said about.
 */
export function canonicalCall(name: string, args: Record<string, unknown>, items: readonly SnapshotItem[]): CanonicalAct | null {
  if (LOOKS.has(name)) return null;
  const refs = (key: string) => (Array.isArray(args[key]) ? (args[key] as unknown[]) : []);
  const single = (ref: unknown) => resolveRef(ref, items);
  switch (name) {
    case "undo":
      return { act: "undo" };
    case "move_item": {
      const item = single(args.item_ref);
      if (!item) return { act: "escalate" };
      if (typeof args.beside_ref === "string" && args.beside_ref.trim() !== "") {
        const target = single(args.beside_ref);
        const side = spokenSide(args.side);
        if (!target || !side || target.id === item.id) return { act: "escalate" };
        return { act: "move-beside", subject: item.id, target: target.id, side };
      }
      const by = args.by_x !== undefined || args.by_y !== undefined;
      const dx = by ? Number(args.by_x ?? 0) : args.to_x !== undefined ? Number(args.to_x) - item.x : 0;
      const dy = by ? Number(args.by_y ?? 0) : args.to_y !== undefined ? Number(args.to_y) - item.y : 0;
      const d = direction(dx, dy);
      return d ? { act: "move-by", subject: item.id, direction: d } : { act: "escalate" };
    }
    case "items_move": {
      const list = refs("item_refs");
      if (list.length !== 1) return { act: "escalate" };
      const item = single(list[0]);
      const d = direction(Number(args.by_x ?? 0), Number(args.by_y ?? 0));
      return item && d ? { act: "move-by", subject: item.id, direction: d } : { act: "escalate" };
    }
    case "resize_item": {
      const item = single(args.item_ref);
      if (!item) return { act: "escalate" };
      const w = Number(args.width);
      const h = Number(args.height);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return { act: "escalate" };
      const before = item.width * item.height;
      const after = w * h;
      return after > before ? { act: "grow", subject: item.id } : after < before ? { act: "shrink", subject: item.id } : { act: "escalate" };
    }
    case "delete_item": {
      const item = single(args.item_ref);
      return item ? { act: "delete", subject: item.id } : { act: "escalate" };
    }
    case "items_delete": {
      const list = refs("item_refs");
      const item = list.length === 1 ? single(list[0]) : null;
      return item ? { act: "delete", subject: item.id } : { act: "escalate" };
    }
    case "selection_set": {
      const list = refs("item_refs");
      const item = list.length === 1 ? single(list[0]) : null;
      return item ? { act: "select", subject: item.id } : { act: "escalate" };
    }
    case "viewport_focus": {
      const item = single(args.item_ref);
      return item ? { act: "show", subject: item.id } : { act: "escalate" };
    }
    default:
      return { act: "escalate" };
  }
}

/**
 * **What the model did in one turn, as one act.** No act at all (it talked,
 * or asked) and several different acts are both "escalate" — neither is a
 * thing the fast path could have done in its place. The same act twice is
 * that act.
 */
export function modelAct(calls: readonly { name: string; args?: Record<string, unknown> }[], items: readonly SnapshotItem[]): CanonicalAct {
  const acts = calls.map((c) => canonicalCall(c.name, c.args ?? {}, items)).filter((a): a is CanonicalAct => a !== null);
  if (acts.length === 0) return { act: "escalate" };
  return acts.every((a) => sameAct(a, acts[0]!)) ? acts[0]! : { act: "escalate" };
}

// ---------- reading Jev's answers

export interface ReadAnswer {
  value: string;
  p: number;
  /** The three likeliest options, for the record. */
  top: Array<[string, number]>;
}

export interface Proposal {
  answers: Record<QuestionId, ReadAnswer>;
  /** The act the answers name — `{act: "escalate"}` when they name none. */
  act: CanonicalAct;
  /** The fast-path act asked about (`action`'s answer), even when the proposal escalates. */
  action: FastAct | "none";
  /** The tool call that would do it — in the live model's own vocabulary, so phase 7 runs it through the same `runTool`. */
  call?: { name: string; args: Record<string, unknown> };
  /** Why it escalates, structurally — empty when it names an act. */
  reasons: string[];
  /** The least certain answer the act relied on: what a threshold is compared with. */
  p: number;
}

function read(request: JevRequest, response: JevResponse, id: QuestionId): ReadAnswer {
  const q = request.questions[id]!;
  const a = response.answers[id] as JevAnswer;
  const { value, p, distribution } = chosenOption(q, a);
  const top = Object.entries(distribution).sort((x, y) => y[1] - x[1]).slice(0, 3) as Array<[string, number]>;
  return { value, p, top };
}

const SIDE_OF: Record<Exclude<Relation, "into" | "none">, Side> = { "left-of": "left", "right-of": "right", above: "above", below: "below", beside: "right" };
const DIRECTION_OF: Partial<Record<Relation, Direction>> = { "left-of": "left", "right-of": "right", above: "up", below: "down" };

/**
 * **Jev's answers, as a proposal** — the act they name and the tool call that
 * would do it, or the reasons they name none. Argmax only; nothing sampled.
 * Thresholds are NOT applied here (`decide` does that): the record keeps
 * what Jev would have done at any threshold, so the threshold can be read
 * off the record afterwards rather than assumed before it.
 */
export function readProposal(ask: FastPathAsk, response: JevResponse): Proposal {
  const answers = Object.fromEntries(QUESTION_IDS.map((id) => [id, read(ask.request, response, id)])) as Record<QuestionId, ReadAnswer>;
  const action = answers.action.value as FastAct | "none";
  const reasons: string[] = [];
  const used: number[] = [answers.action.p, answers.simple.p];
  const escalate = (why: string): Proposal => {
    reasons.push(why);
    return { answers, act: { act: "escalate" }, action, reasons, p: Math.min(...used) };
  };
  if (answers.simple.value !== "true") reasons.push("not one simple act");
  if (action === "none") return escalate("not a fast-path act");
  if (reasons.length > 0) return { answers, act: { act: "escalate" }, action, reasons, p: Math.min(...used) };

  if (action === "undo") return { answers, act: { act: "undo" }, action, call: { name: "undo", args: {} }, reasons, p: Math.min(...used) };

  used.push(answers.subject.p);
  const subjectId = ask.ids[answers.subject.value];
  const subject = subjectId ? ask.items.find((i) => i.id === subjectId) : undefined;
  if (!subject) return escalate("no item on the canvas is named");
  const targetId = ask.ids[answers.target.value];
  used.push(answers.target.p);

  if (action === "move") {
    used.push(answers.relation.p);
    const relation = answers.relation.value as Relation;
    if (relation === "none") return escalate("a move with no place");
    if (relation === "into") return escalate("no voice tool puts an item into a group");
    if (targetId) {
      if (targetId === subjectId) return escalate("an item cannot move beside itself");
      const side = SIDE_OF[relation];
      return {
        answers, action, reasons, p: Math.min(...used),
        act: { act: "move-beside", subject: subject.id, target: targetId, side },
        call: { name: "move_item", args: { item_ref: subject.id, beside_ref: targetId, side } },
      };
    }
    const d = DIRECTION_OF[relation];
    if (!d) return escalate("beside nothing");
    const by = { left: [-NUDGE, 0], right: [NUDGE, 0], up: [0, -NUDGE], down: [0, NUDGE] }[d];
    return {
      answers, action, reasons, p: Math.min(...used),
      act: { act: "move-by", subject: subject.id, direction: d },
      call: { name: "move_item", args: { item_ref: subject.id, by_x: by[0], by_y: by[1] } },
    };
  }

  // Every other act is on one item: a second item named is a second referent.
  if (targetId) return escalate("a second item is named");
  if (action === "grow" || action === "shrink") {
    const f = action === "grow" ? GROW : 1 / GROW;
    return {
      answers, action, reasons, p: Math.min(...used),
      act: { act: action, subject: subject.id },
      call: { name: "resize_item", args: { item_ref: subject.id, width: Math.round(subject.width * f), height: Math.round(subject.height * f) } },
    };
  }
  const call =
    action === "delete" ? { name: "delete_item", args: { item_ref: subject.id } }
    : action === "select" ? { name: "selection_set", args: { item_refs: [subject.id] } }
    : { name: "viewport_focus", args: { item_ref: subject.id } };
  return { answers, action, reasons, p: Math.min(...used), act: { act: action, subject: subject.id }, call };
}

// ---------- the rule

/** A measured threshold per action; an action with none stays with the model. */
export type Thresholds = Partial<Record<FastAct, number>>;

export type Decision =
  | { decision: "act"; call: { name: string; args: Record<string, unknown> }; act: CanonicalAct }
  | { decision: "escalate"; reasons: string[] };

/**
 * **Act only above a measured threshold** (fast-path.md, *The threshold is
 * measured, never guessed*). A proposal that names no act escalates; one
 * whose action has no measured threshold escalates; one whose least certain
 * answer is under its action's threshold escalates. Phase 6 passes `{}` —
 * no action has been measured yet — so this answers "escalate" for every
 * turn, and the shadow never acts by construction as well as by wiring.
 */
export function decide(proposal: Proposal, thresholds: Thresholds): Decision {
  if (proposal.act.act === "escalate" || !proposal.call || proposal.action === "none") {
    return { decision: "escalate", reasons: proposal.reasons.length ? proposal.reasons : ["not a fast-path act"] };
  }
  const t = thresholds[proposal.action];
  if (t === undefined) return { decision: "escalate", reasons: [`no measured threshold for ${proposal.action}`] };
  if (proposal.p < t) return { decision: "escalate", reasons: [`p ${proposal.p.toFixed(2)} under ${proposal.action}'s threshold ${t.toFixed(2)}`] };
  return { decision: "act", call: proposal.call, act: proposal.act };
}

/** An act in words, with titles — for the transcript's shadow line and for the next turn's `lastAct`. */
export function describeAct(act: CanonicalAct, items: readonly SnapshotItem[]): string {
  const name = (id: string) => `“${items.find((i) => i.id === id)?.title ?? id}”`;
  switch (act.act) {
    case "move-by":
      return `move ${name(act.subject)} ${act.direction}`;
    case "move-beside":
      return `move ${name(act.subject)} ${act.side === "left" || act.side === "right" ? `${act.side} of` : act.side} ${name(act.target)}`;
    case "grow":
      return `make ${name(act.subject)} bigger`;
    case "shrink":
      return `make ${name(act.subject)} smaller`;
    case "delete":
      return `delete ${name(act.subject)}`;
    case "select":
      return `select ${name(act.subject)}`;
    case "show":
      return `show ${name(act.subject)}`;
    case "undo":
      return "undo";
    case "escalate":
      return "hand it to the model";
  }
}
