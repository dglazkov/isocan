import type { Actor, CanvasContents, Comment, Item } from "./model.ts";
import type { DesignBrief } from "./design-partner.ts";
import type { DesignBriefFields } from "./design-request.ts";
import { itemKind } from "./kinds.ts";
import { parentOf } from "./lineage.ts";
import { proposalCites, proposalMarked, proposalsOf } from "./proposal.ts";

/**
 * **The brief, as a card** (proactive-agent phase 5, design §7).
 *
 * A design request's brief already lives on the canvas as an item (the
 * `design.request` record, `design-brief.ts`), and its facts already say who
 * said them: `origin` is `supplied` (the person said it), `context` (read off
 * the canvas) or `assumed` (an agent inferred it). This is the one reading of
 * that record as six lines a person can scan — **Making**, **For**, **Should
 * feel**, **Never**, **Constraints**, **Right now** — with the said ones drawn
 * solid and the inferred ones in pencil, so the web card, `isocan design
 * card` and the tests all print one answer.
 *
 * **The card is a view of the brief, not a copy.** Every edit it offers —
 * *Right* (an inferred line becomes the person's), *Wrong* (it goes, and the
 * person says what it should be), or a new value — is a patch for the
 * ordinary `design brief --update` door (`briefEditPatch`), so the brief stays
 * the record and its history names whoever made each change.
 *
 * **An edit changes nothing by itself; it only re-reads** (`briefChanges`,
 * `briefReread`). Every screen in the brief's scope is sorted, derived and
 * unwritten: *assumed the old line* when a proposal beneath it cites the
 * changed line (`brief:<line>`) or its evidence was checked against the brief
 * before the edit; *matters more now* when the canvas's lead agent says so,
 * through the ordinary summons (`rereadAsk`), with its ONE clarifying
 * question (`rereadBody`); *still holds* otherwise. Nothing here calls a
 * model and nothing here writes: with nobody to answer, the card still works
 * and says the re-read waits.
 */

/** The six lines, in the card's order. */
type BriefLineKey = "making" | "for" | "feel" | "never" | "constraints" | "now";

type BriefFact = DesignBrief["facts"][number];

/** How each line is found: the brief's own field first, then a fact whose id or name is one of these words. */
const LINES: ReadonlyArray<{ key: BriefLineKey; label: string; field?: "primaryTask" | "audience" | "constraints"; names: readonly string[] }> = [
  { key: "making", label: "Making", field: "primaryTask", names: ["making", "primarytask", "task", "product"] },
  { key: "for", label: "For", field: "audience", names: ["for", "audience", "users", "who"] },
  { key: "feel", label: "Should feel", names: ["feel", "shouldfeel", "tone", "mood"] },
  { key: "never", label: "Never", names: ["never", "nevers", "avoid"] },
  { key: "constraints", label: "Constraints", field: "constraints", names: ["constraints", "constraint"] },
  { key: "now", label: "Right now", names: ["now", "rightnow", "mode"] },
];

/** How many inferred lines the card shows at once (design §7): more reads as presumption. */
export const BRIEF_ASSUMED_CAP = 4;

/** What the person seems to be doing, read from the canvas — the sensed half of **Right now**. */
type BriefMode = "exploring" | "refining" | "shipping";
/** The three, for the card's choice and the CLI's refusal. */
export const BRIEF_MODES: readonly BriefMode[] = ["exploring", "refining", "shipping"];

const INTENT_WORDS: Record<DesignBrief["intent"], string> = {
  create: "make something new",
  extend: "extend existing work",
  refine: "refine existing work",
};

/** One line of the card. */
export interface BriefCardLine {
  /** One of the six, or `fact:<id>` for a fact that is none of them. */
  key: BriefLineKey | `fact:${string}`;
  label: string;
  /** Null: nobody has said or inferred it yet. */
  value: string | null;
  /** The person said it (solid rule); otherwise inferred (pencil rule, with Right and Wrong). */
  said: boolean;
  /** Where the value came from; `sensed` is Right now read off the canvas. */
  origin: BriefFact["origin"] | "sensed" | null;
  /** The fact holding it, when a fact does — what Right and Wrong change. */
  factId: string | null;
  /** What a proposal answering this line cites: `--cites brief:<cite>`. */
  cite: string;
}

/** The card: its lines (inferred ones capped), how many inferred lines wait unshown, and the request's intent. */
export interface BriefCard {
  lines: BriefCardLine[];
  quiet: number;
  intent: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * **The line a `brief:` cite answers**, as its chip says it (`cites · For`) —
 * or null for a ref that names no line (a fact's own id, read without the
 * brief in hand). A line answers to its key (`for`), the brief field behind
 * it (`audience`), and the words a fact for it is named by.
 */
export function briefLineLabel(ref: string): string | null {
  const n = norm(ref);
  return LINES.find((l) => l.key === n || l.names.includes(n))?.label ?? null;
}

/**
 * **Right now, as the canvas reads it** (design §7: a mode the agent reads
 * from behaviour). A finished request is *shipping*; two or more takes in
 * play — open proposals or variations beneath its screens — is *exploring*;
 * a new request on screens nobody has reworked yet is *exploring*; anything
 * else is *refining*. Drawn as an assumed line: the lead may overrule it by
 * writing a `now` fact, and the person by Right or Wrong.
 */
export function sensedMode(canvas: CanvasContents, brief: DesignBrief): BriefMode {
  if (brief.progress === "completed") return "shipping";
  const screens = briefScreens(canvas, brief);
  const ids = new Set(screens.map((s) => s.id));
  const takes = Object.values(canvas.items).filter((item) => {
    const parent = parentOf(item);
    return parent !== null && ids.has(parent);
  });
  if (takes.length >= 2) return "exploring";
  if (brief.intent === "create" && screens.every((s) => s.versions.length <= 1)) return "exploring";
  return "refining";
}

const modeOfIntent = (intent: DesignBrief["intent"]): BriefMode => (intent === "create" ? "exploring" : "refining");

/**
 * **The card, from the brief** — and from the canvas, for the sensed half of
 * Right now (without it, the mode is read off the intent alone, which is what
 * a comparison of two briefs wants). A line is the brief's own field when it
 * has one and it is set (the person's, solid), else the first fact named for
 * it (solid when `supplied`, pencil otherwise), else empty; facts that are
 * none of the six follow as lines of their own. At most `BRIEF_ASSUMED_CAP`
 * inferred lines show; `quiet` counts the rest.
 */
export function briefCard(brief: DesignBrief, canvas?: CanvasContents): BriefCard {
  const all = everyLine(brief, canvas);
  let inferred = 0;
  const lines = all.filter((l) => l.said || l.value === null || ++inferred <= BRIEF_ASSUMED_CAP);
  return { lines, quiet: all.length - lines.length, intent: INTENT_WORDS[brief.intent] };
}

function everyLine(brief: DesignBrief, canvas?: CanvasContents): BriefCardLine[] {
  const used = new Set<string>();
  const all: BriefCardLine[] = [];
  for (const line of LINES) {
    const field = line.field === "constraints" ? (brief.constraints.length ? brief.constraints.join(" · ") : null) : line.field ? brief[line.field] : null;
    if (field && field.trim()) {
      all.push({ key: line.key, label: line.label, value: field, said: true, origin: "supplied", factId: null, cite: line.key });
      continue;
    }
    const fact = brief.facts.find((f) => !used.has(f.id) && (line.names.includes(norm(f.id)) || line.names.includes(norm(f.name))));
    if (fact) {
      used.add(fact.id);
      all.push({ key: line.key, label: line.label, value: fact.value, said: fact.origin === "supplied", origin: fact.origin, factId: fact.id, cite: line.key });
    } else if (line.key === "now") {
      all.push({ key: "now", label: line.label, value: canvas ? sensedMode(canvas, brief) : modeOfIntent(brief.intent), said: false, origin: "sensed", factId: null, cite: "now" });
    } else {
      all.push({ key: line.key, label: line.label, value: null, said: false, origin: null, factId: null, cite: line.key });
    }
  }
  for (const fact of brief.facts) {
    if (!used.has(fact.id)) all.push({ key: `fact:${fact.id}`, label: fact.name, value: fact.value, said: fact.origin === "supplied", origin: fact.origin, factId: fact.id, cite: fact.id });
  }
  return all;
}

/** The line a person or an agent names — its key (`for`), its label (`Should feel`), or a fact's id or name. */
export function findBriefLine(card: BriefCard, name: string): BriefCardLine | null {
  const n = norm(name);
  // The exact names first — a fact's own id or cite, then a label — and the
  // words a line answers to last, so a fact called "Tone of voice" is found
  // as itself rather than as the Should feel line "tone" also names.
  return card.lines.find((l) => norm(l.cite) === n || (l.factId !== null && norm(l.factId) === n))
    ?? card.lines.find((l) => norm(l.label) === n)
    ?? card.lines.find((l) => LINES.find((d) => d.key === l.key)?.names.includes(n))
    ?? null;
}

/** An edit the card offers: Right, Wrong (with the right value, or none), or a new value. */
export type BriefEdit = { act: "right" } | { act: "wrong"; value?: string } | { act: "set"; value: string };

/**
 * **The `design brief --update` patch for one edit to one line**, or why it
 * is not one. *Right* turns an inferred line into the person's (`origin:
 * supplied`; a sensed Right now becomes a `now` fact); *Wrong* removes the
 * inferred fact, and with a value puts the person's in its place; a value on
 * any line sets it as the person's. Nothing but the brief is patched.
 */
export function briefEditPatch(brief: DesignBrief, line: BriefCardLine, edit: BriefEdit): Partial<DesignBriefFields> | { refused: string } {
  const named = `“${line.label}”`;
  const given = edit.act === "right" ? null : (edit.value ?? "").replace(/\s+/g, " ").trim();
  // The person's own words cite nothing: whatever an inference was drawn from is not why they said it.
  const supplied = (value: string): BriefFact => ({ id: line.factId ?? line.key, name: line.label, value, origin: "supplied", sources: [] });
  if (edit.act === "right") {
    if (line.value === null) return { refused: `${named} is empty — there is nothing to confirm; say what it is instead` };
    if (line.said) return { refused: `${named} is already what the person said` };
    if (line.factId) return { facts: brief.facts.map((f) => (f.id === line.factId ? { ...f, origin: "supplied" as const } : f)) };
    return { facts: [...brief.facts, supplied(line.value)] };
  }
  if (edit.act === "wrong") {
    if (line.said) return { refused: `${named} is what the person said, not an inference — change it with a new value` };
    if (!line.factId && !given) return { refused: `${named} was read off the canvas, not written down — say what it is instead (${BRIEF_MODES.join(", ")})` };
    const rest = brief.facts.filter((f) => f.id !== line.factId);
    return { facts: given ? [...rest, supplied(given)] : rest };
  }
  if (!given) return { refused: `say what ${named} should be` };
  if (!line.factId && line.key === "making") return { primaryTask: given };
  if (!line.factId && line.key === "for") return { audience: given };
  if (!line.factId && line.key === "constraints") return { constraints: given.split(/\s*(?:·|;|\n)\s*/).filter(Boolean) };
  if (line.factId) return { facts: brief.facts.map((f) => (f.id === line.factId ? { ...f, value: given, origin: "supplied" as const } : f)) };
  return { facts: [...brief.facts, supplied(given)] };
}

// ---------- the re-read

/** One line an edit changed. */
interface BriefChange {
  key: BriefCardLine["key"];
  label: string;
  /** Every ref a cite of this line may use: its key, its field, its fact's id. */
  refs: string[];
  before: string | null;
  after: string | null;
}

const FIELD_OF: Partial<Record<BriefLineKey, string>> = { making: "primaryTask", for: "audience", constraints: "constraints" };

/**
 * **What an edit changed**: the lines whose words differ between two
 * versions of a brief. A Right that only turns pencil to ink changes no
 * words, so it re-reads nothing — the screens already assumed that line.
 */
export function briefChanges(before: DesignBrief, after: DesignBrief): BriefChange[] {
  // The cap is for the eye, not for the comparison: every line is read.
  const was = everyLine(before);
  const now = everyLine(after);
  const keys = [...new Set([...was, ...now].map((l) => l.key))];
  const out: BriefChange[] = [];
  for (const key of keys) {
    const a = was.find((l) => l.key === key);
    const b = now.find((l) => l.key === key);
    if ((a?.value ?? null) === (b?.value ?? null)) continue;
    const field = FIELD_OF[key as BriefLineKey];
    const refs = [...new Set([key.startsWith("fact:") ? key.slice(5) : key, ...(field ? [field] : []), ...[a?.factId, b?.factId].filter((x): x is string => !!x)])];
    out.push({ key, label: (b ?? a)!.label, refs, before: a?.value ?? null, after: b?.value ?? null });
  }
  return out;
}

/** The screens a brief is about: every screen on the canvas, or in its group when it has one — proposals aside. */
export function briefScreens(canvas: CanvasContents, brief: Pick<DesignBrief, "groupId">): Item[] {
  return Object.values(canvas.items)
    .filter((item) => itemKind(item) === "screen" && !proposalMarked(item) && (brief.groupId === null || item.containerId === brief.groupId))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** One screen, sorted, with why when it is not simply *still holds*. */
export interface RereadScreen {
  itemId: string;
  title: string;
  because?: string;
}

/** The re-read: what changed, and every screen in one of three piles. */
export interface BriefReread {
  changes: BriefChange[];
  /** Assumed the old line: something beneath it cites it, or its evidence predates the edit. */
  old: RereadScreen[];
  /** The lead agent's call, with its question. */
  more: RereadScreen[];
  holds: RereadScreen[];
}

/** A receipt as the re-read reads it: the screen it vouched for and the brief version it was checked against. */
interface RereadReceipt {
  outputItemId: string | null;
  briefVersionId: string;
}

/**
 * **Sort every screen after an edit** — derived, and written nowhere. A
 * screen *assumed the old line* when an open proposal beneath it cites a
 * changed line (`brief:<key|field|fact>`), or a receipt vouched for it
 * against a brief version before `afterVersionId`; it *matters more now* when
 * the lead named it (`matters`); otherwise it *still holds*.
 */
export function briefReread(canvas: CanvasContents, brief: DesignBrief, changes: BriefChange[], opts: { afterVersionId: string; receipts?: readonly RereadReceipt[]; matters?: readonly string[] }): BriefReread {
  const refs = new Map(changes.flatMap((c) => c.refs.map((r) => [norm(r), c.label] as const)));
  const out: BriefReread = { changes, old: [], more: [], holds: [] };
  for (const screen of briefScreens(canvas, brief)) {
    const row = { itemId: screen.id, title: screen.title || "Untitled" };
    const citing = refs.size === 0 ? undefined : proposalsOf(canvas, screen.id).map((p) => ({ p, cite: proposalCites(p).find((c) => c.kind === "brief" && refs.has(norm(c.ref))) })).find((x) => x.cite);
    const checked = (opts.receipts ?? []).find((r) => r.outputItemId === screen.id && r.briefVersionId !== opts.afterVersionId);
    if (citing && changes.length) out.old.push({ ...row, because: `its proposal “${citing.p.title || "Untitled"}” cites ${refs.get(norm(citing.cite!.ref))}` });
    else if (checked && changes.length) out.old.push({ ...row, because: "its evidence was checked against the brief before this edit" });
    else if (opts.matters?.includes(screen.id)) out.more.push(row);
    else out.holds.push(row);
  }
  return out;
}

// ---------- the lead's half: the ask, and its answer

const ASK_MARK = "Brief re-read, please";
const ANSWER_HEAD = "Re-read of the brief";

/** Where a re-read is about: the brief item and the version the edit made. */
export interface RereadAt {
  itemId: string;
  versionId: string;
}

const at$ = (at: RereadAt) => `(${at.itemId}@${at.versionId})`;
const quote = (s: string | null) => (s === null ? "nothing" : `“${s.length > 80 ? `${s.slice(0, 79)}…` : s}”`);
const names = (rows: RereadScreen[]) => rows.map((r) => `“${r.title}”`).join(", ") || "none";

/**
 * **What an edit posts to the lead** — an ordinary summons, as Explain's
 * Critique is: what changed, the derived sort, and how to answer. The lead
 * names the screens that matter more now and asks ONE clarifying question.
 */
export function rereadAsk(lead: Pick<Actor, "name">, at: RereadAt, reread: BriefReread): string {
  const changed = reread.changes.map((c) => `“${c.label}” is now ${quote(c.after)} (was ${quote(c.before)})`).join("; ");
  return `@${lead.name} ${ASK_MARK} ${at$(at)}: ${changed}. Assumed the old line: ${names(reread.old)}. Still holds: ${names(reread.holds)}. Nothing on the canvas changed. Say which screens matter more now, and ask the person ONE clarifying question — \`isocan design card --reread --matters <screen> --question "…"\`.`;
}

/** Why a question is not ONE clarifying question, or null. */
export function rereadQuestionRefusal(question: string): string | null {
  const q = question.replace(/\s+/g, " ").trim();
  if (!q) return "ask the person one clarifying question: --question \"…?\"";
  if (!q.endsWith("?")) return "a clarifying question ends with a question mark";
  if ((q.match(/\?/g) ?? []).length > 1) return "one question, not several — the re-read asks ONE";
  return null;
}

/** The lead's answer, as its `record` comment says it — the shape `rereadAnswer` reads back. */
export function rereadBody(at: RereadAt, matters: ReadonlyArray<Pick<Item, "id" | "title">>, question: string): string {
  return [
    `${ANSWER_HEAD} ${at$(at)}`,
    `Matters more now: ${matters.map((m) => `“${m.title || "Untitled"}” (${m.id})`).join(", ") || "none"}`,
    `Question: ${question.replace(/\s+/g, " ").trim()}`,
  ].join("\n");
}

function comments(canvas: CanvasContents): Comment[] {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The lead's latest answer to a re-read of this version, if it has come. */
export function rereadAnswer(canvas: CanvasContents, at: RereadAt): { by: Actor; matters: string[]; question: string; commentId: string } | null {
  const head = `${ANSWER_HEAD} ${at$(at)}`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const line = (label: string) => c.body.split("\n").find((l) => l.startsWith(label))?.slice(label.length).trim() ?? "";
  return { by: c.author, matters: [...line("Matters more now:").matchAll(/\((itm_[\w-]+)\)/g)].map((m) => m[1]!), question: line("Question:"), commentId: c.id };
}

/** Whether a re-read of this version was asked for. */
export function rereadAsked(canvas: CanvasContents, at: RereadAt): boolean {
  return comments(canvas).some((c) => c.body.includes(`${ASK_MARK} ${at$(at)}`));
}
