import type { LogEntry, Operation } from "@isocan/core";
import { FIDELITY_PROP, KEEP_BY_PROP, KEEP_PROP, WIRE_FIDELITY, isAnswerer, type WireFacts } from "./wire-format.ts";

/**
 * **The calibration corpus, read back off the oplog** (judge phase 1).
 *
 * Every screen a wireframe flow draws is a judgment the flow already acted
 * on: round 1 said how likely the request is to need it (`need`), and the
 * flow put the confident ones in the prototype itself and drew the unsure
 * ones marked *maybe*. What the person then did is the label. This file turns
 * one canvas's log into those pairs, and writes nothing.
 *
 * **The unit is the row, not the screen.** `need` is P(yes) for an archetype
 * — "does the request need a list screen?" — and a variation is the same
 * archetype drawn another way. So a screen and its variations are one row
 * with one P, and the row's verdict is whether the person ended with ANY of
 * its screens in the prototype. Folding screen by screen would read a swap
 * (Jev's pick out, its variation in) as a *no* to a question the person
 * answered *yes*.
 *
 * **Acts are read with their hands, not off the final snapshot.** An unkeep
 * removes `wireKeepBy` with the mark, so the snapshot forgets who; and the
 * flow's own writes go out as the person who asked for it. Three hands:
 *
 * - *flow* — any entry in the flow's op group (the composer writes every op
 *   of a request under the flow's id, so one undo takes it back), and any
 *   keep signed with an answerer's name. An undo or redo belongs to the hand
 *   of the entry it ultimately reverses: undoing a whole flow withdraws it,
 *   it does not take its screens out.
 * - *person* — anything else the running person did.
 * - *other* — a collaborator. Not counted: whose decisions count is the open
 *   consent question (`docs/projects/judge/design.md`), and until somebody
 *   decides it only the reader's own are labels.
 *
 * The fold keeps two replays of each row — the flow's acts alone, and the
 * flow's with the person's — and the verdict is where they disagree:
 * **kept** when the person's replay has the row in the prototype and the
 * flow's does not, **taken out** the other way round, **none** when they
 * agree or the person never touched the row. None is no label, not a yes.
 */

export type Verdict = "kept" | "taken-out" | "none";
/** The band round 1 drew the screen in: `maybe` (drawn dashed, waiting for a keep) or `sure`. */
export type Band = "sure" | "maybe";
/** Which side of the held-out line a row falls on — a stable function of its ids, never of a run. */
export type Split = "tune" | "held-out";

export const VERDICTS: readonly Verdict[] = ["kept", "taken-out", "none"];
export const BANDS: readonly Band[] = ["sure", "maybe"];
export const SPLITS: readonly Split[] = ["tune", "held-out"];
/** What `by.answerer` said, or `unknown` for a flow drawn on 24 Sep 2026 between `need` landing and `by` landing. */
export const PAIR_ANSWERERS = ["jev", "stub", "agent", "unknown"] as const;
export type PairAnswerer = (typeof PAIR_ANSWERERS)[number];

/** One labelled pair, with the real strings — the local set, never committed. */
export interface Pair {
  canvasId: string;
  flow: string;
  /** The row's screen: the one its variations vary. */
  itemId: string;
  request: string;
  title: string;
  archetype: string;
  /** Round 1's P(yes), from the spec's `need`. */
  p: number;
  answerer: PairAnswerer;
  model?: string;
  band: Band;
  /** Whether the flow itself put the row in the prototype. */
  flowPut: boolean;
  verdict: Verdict;
  /**
   * Whether the person acted on ANY row of this flow. A row they left alone
   * in a flow they worked through is not the same absence as one in a flow
   * they never opened — phase 2 decides what, if anything, that is worth.
   */
  engaged: boolean;
  split: Split;
  /** When the person's last act on the row landed, if they acted. */
  decidedAt?: string;
}

/** Rows the reader saw and did not fold, by why. */
export interface Excluded {
  /** The row's screen has no `need`: a flow from before 24 Sep 2026, or a spec rendered by hand. */
  noNeed: number;
  /** The screen arrived by some other hand than a flow on this canvas — copied in, or `wire render`. */
  notDrawnHere: number;
  /** The flow was undone: its screens are no judgment anybody saw through. */
  withdrawn: number;
}

export interface CanvasCorpus {
  pairs: Pair[];
  excluded: Excluded;
}

// ---------- which items are wires, and which files hold their specs

/** One entry per seq, in seq order — however the archived and live halves arrived. */
export function ordered(entries: readonly LogEntry[]): LogEntry[] {
  const bySeq = new Map<number, LogEntry>();
  for (const entry of entries) bySeq.set(entry.seq, entry);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/** A wireframe screen as the log shows it: every HTML version it has carried. */
export interface WireItem {
  itemId: string;
  /** Blob hashes of its HTML versions, oldest first. */
  versions: string[];
}

/**
 * Every item added as a wireframe screen, with the HTML files it has carried —
 * the blobs whose specs the reader must fetch. Pure: the fetching is the
 * caller's (`readCanvas` in `cli.ts`).
 */
export function wireItems(entries: readonly LogEntry[]): WireItem[] {
  const items = new Map<string, WireItem>();
  for (const entry of ordered(entries)) {
    const op = entry.envelope.op;
    if (op.type === "item.add") {
      if (op.properties?.[FIDELITY_PROP] !== WIRE_FIDELITY || items.has(op.itemId)) continue;
      items.set(op.itemId, { itemId: op.itemId, versions: op.version.mimeType === "text/html" ? [op.version.blobHash] : [] });
    } else if (op.type === "item.addVersion" || op.type === "item.edit") {
      const item = items.get(op.itemId);
      if (item && op.version.mimeType === "text/html") item.versions.push(op.version.blobHash);
    }
  }
  return [...items.values()];
}

/**
 * The facts a row needs from one screen's files: the newest version whose
 * spec carries `need`, or failing that the newest that is a wire at all (a
 * variation's `variantOf` and `flow` are worth having even where `need` is
 * not). `read` returns null for a file that is not a wire or cannot be read.
 */
export async function factsOf(item: WireItem, read: (blobHash: string) => Promise<WireFacts | null>): Promise<WireFacts | null> {
  let fallback: WireFacts | null = null;
  for (const hash of [...item.versions].reverse()) {
    const facts = await read(hash);
    if (!facts) continue;
    if (facts.need !== undefined) return facts;
    fallback ??= facts;
  }
  return fallback;
}

// ---------- the split

/** The share of rows held out from anything a later phase tunes against. */
export const HELD_OUT_SHARE = 0.3;
/** Versioned, so a re-split is a deliberate act with a new name rather than a quiet reshuffle. */
const SPLIT_SALT = "judge-split-v1";

/** FNV-1a, 32-bit: small, pure, and the same on every machine and every run. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * **Which side a row falls on**: a function of the canvas and the row's
 * screen, and of nothing else — not the order rows were read in, not how
 * many there are, not the day. The same screen lands on the same side on
 * every run, so a later phase that tunes on `tune` never sees `held-out`.
 */
export function splitOf(canvasId: string, itemId: string): Split {
  return fnv1a(`${SPLIT_SALT}:${canvasId}/${itemId}`) / 0x1_0000_0000 < HELD_OUT_SHARE ? "held-out" : "tune";
}

// ---------- the fold

type Hand = "flow" | "person" | "other";

interface ScreenState {
  present: boolean;
  kept: boolean;
}

/** The item ids an op touches, with what it does to a screen's two facts. */
function effects(op: Operation): Array<{ itemId: string; present?: boolean; kept?: boolean }> {
  switch (op.type) {
    case "item.add":
      return [{ itemId: op.itemId, present: true, kept: Boolean(op.properties?.[KEEP_PROP]) }];
    case "item.delete":
      return [{ itemId: op.itemId, present: false }];
    case "items.delete":
      return op.itemIds.map((itemId) => ({ itemId, present: false }));
    case "item.restore":
      return [{ itemId: op.itemId, present: true }];
    case "items.restore":
      return op.itemIds.map((itemId) => ({ itemId, present: true }));
    case "item.update":
    case "item.edit": {
      if (op.patch.properties?.[KEEP_PROP] !== undefined) return [{ itemId: op.itemId, kept: true }];
      if (op.patch.removeProperties?.includes(KEEP_PROP)) return [{ itemId: op.itemId, kept: false }];
      return [];
    }
    default:
      return [];
  }
}

/** A keep signed with an answerer's name: the flow's own pick, whoever sent it. */
function machineKeep(op: Operation): boolean {
  return (op.type === "item.update" || op.type === "item.edit") && isAnswerer(op.patch.properties?.[KEEP_BY_PROP]);
}

export interface FoldInput {
  canvasId: string;
  /** The canvas's whole log — archived and live, in any order; duplicates by seq are fine. */
  entries: readonly LogEntry[];
  /** Each wire item's facts, from `factsOf`. An item missing here is not a wire the reader could read. */
  facts: ReadonlyMap<string, WireFacts>;
  /** The running person's actor id: whose acts are labels. */
  me: string;
}

/** Fold one canvas's log into its labelled pairs. Pure. */
export function foldCorpus({ canvasId, entries, facts, me }: FoldInput): CanvasCorpus {
  const log = ordered(entries);
  const bySeq = new Map(log.map((entry) => [entry.seq, entry]));

  /** The entry an undo or redo ultimately reverses — itself, for an ordinary act. */
  const origin = (entry: LogEntry): LogEntry => {
    let at = entry;
    const seen = new Set<number>();
    while (at.cause && !seen.has(at.seq)) {
      seen.add(at.seq);
      const target = bySeq.get(at.cause.targetSeq);
      if (!target) break;
      at = target;
    }
    return at;
  };

  // Rows: each wire's root screen — the one no `variantOf` leads away from.
  const rootOf = (itemId: string): string => {
    let at = itemId;
    const seen = new Set<string>();
    while (!seen.has(at)) {
      seen.add(at);
      const next = facts.get(at)?.variantOf;
      if (!next || !facts.has(next)) break;
      at = next;
    }
    return at;
  };
  const addedAt = new Map<string, number>();
  for (const entry of log) if (entry.envelope.op.type === "item.add" && !addedAt.has(entry.envelope.op.itemId)) addedAt.set(entry.envelope.op.itemId, entry.seq);
  const rows = new Map<string, string[]>();
  for (const itemId of [...facts.keys()].sort((a, b) => (addedAt.get(a) ?? Infinity) - (addedAt.get(b) ?? Infinity) || a.localeCompare(b))) {
    const root = rootOf(itemId);
    rows.set(root, [...(rows.get(root) ?? []), itemId]);
  }
  const rowOf = new Map<string, string>();
  for (const [root, members] of rows) for (const m of members) rowOf.set(m, root);

  const flowState = new Map<string, ScreenState>();
  const personState = new Map<string, ScreenState>();
  const touchedAt = new Map<string, string>();
  const addedByFlow = new Set<string>();
  const handOf = (entry: LogEntry, flow: string | undefined): Hand => {
    const first = origin(entry);
    if (flow !== undefined && first.group === flow) return "flow";
    if (machineKeep(first.envelope.op)) return "flow";
    return entry.envelope.actor.id === me ? "person" : "other";
  };
  const apply = (states: Map<string, ScreenState>, e: { itemId: string; present?: boolean; kept?: boolean }) => {
    const was = states.get(e.itemId) ?? { present: false, kept: false };
    states.set(e.itemId, { present: e.present ?? was.present, kept: e.kept ?? was.kept });
  };

  for (const entry of log) {
    for (const e of effects(entry.envelope.op)) {
      const root = rowOf.get(e.itemId);
      if (root === undefined) continue;
      const hand = handOf(entry, facts.get(root)?.flow);
      if (hand === "other") continue;
      if (hand === "flow") {
        apply(flowState, e);
        if (e.itemId === root && entry.envelope.op.type === "item.add") addedByFlow.add(root);
      } else {
        touchedAt.set(root, entry.envelope.ts);
      }
      apply(personState, e);
    }
  }

  const inPrototype = (states: Map<string, ScreenState>, root: string) =>
    rows.get(root)!.some((m) => states.get(m)?.present && states.get(m)?.kept);

  const excluded: Excluded = { noNeed: 0, notDrawnHere: 0, withdrawn: 0 };
  const drawn: Array<{ root: string; row: WireFacts & { need: number } }> = [];
  for (const root of rows.keys()) {
    const row = facts.get(root)!;
    if (row.need === undefined) excluded.noNeed++;
    else if (!addedByFlow.has(root)) excluded.notDrawnHere++;
    else if (!flowState.get(root)?.present) excluded.withdrawn++;
    else drawn.push({ root, row: row as WireFacts & { need: number } });
  }
  const engagedFlows = new Set(drawn.filter((d) => touchedAt.has(d.root)).map((d) => d.row.flow));

  const pairs = drawn.map(({ root, row }): Pair => {
    const flowPut = inPrototype(flowState, root);
    const personPut = inPrototype(personState, root);
    const decidedAt = touchedAt.get(root);
    const verdict: Verdict = decidedAt === undefined || personPut === flowPut ? "none" : personPut ? "kept" : "taken-out";
    const answerer = row.by?.answerer;
    return {
      canvasId,
      flow: row.flow,
      itemId: root,
      request: row.request,
      title: row.title,
      archetype: row.archetype,
      p: row.need,
      answerer: answerer === "jev" || answerer === "stub" || answerer === "agent" ? answerer : "unknown",
      ...(row.by?.model ? { model: row.by.model } : {}),
      band: row.maybe ? "maybe" : "sure",
      flowPut,
      verdict,
      engaged: engagedFlows.has(row.flow),
      split: splitOf(canvasId, root),
      ...(decidedAt ? { decidedAt } : {}),
    };
  });
  return { pairs, excluded };
}

// ---------- counts, and the shape that may be committed

export interface Counts {
  rows: number;
  labelled: number;
  kept: number;
  takenOut: number;
  none: number;
  heldOut: number;
}

export function countsOf(pairs: readonly Pair[]): Counts {
  const kept = pairs.filter((p) => p.verdict === "kept").length;
  const takenOut = pairs.filter((p) => p.verdict === "taken-out").length;
  return {
    rows: pairs.length,
    labelled: kept + takenOut,
    kept,
    takenOut,
    none: pairs.length - kept - takenOut,
    heldOut: pairs.filter((p) => p.split === "held-out").length,
  };
}

/** A pair with every real string taken out: what a fixture, a page or a commit may carry. */
export interface ShapePair {
  p: number;
  verdict: Verdict;
  band: Band;
  split: Split;
  answerer: PairAnswerer;
  engaged: boolean;
}

export interface Shape {
  v: 1;
  pairs: ShapePair[];
}

/** The committed half: numbers and closed vocabularies, in a stable order, and nothing anybody typed. */
export function shapeOf(pairs: readonly Pair[]): Shape {
  const rows = pairs.map(({ p, verdict, band, split, answerer, engaged }) => ({ p, verdict, band, split, answerer, engaged }));
  rows.sort((a, b) => a.p - b.p || a.verdict.localeCompare(b.verdict) || a.band.localeCompare(b.band) || a.split.localeCompare(b.split) || a.answerer.localeCompare(b.answerer) || Number(a.engaged) - Number(b.engaged));
  return { v: 1, pairs: rows };
}

/** The keys a shape may carry — any other key is a field somebody added, and may be carrying a real string. */
const SHAPE_KEYS = new Set(["v", "pairs", "p", "verdict", "band", "split", "answerer", "engaged"]);
/** Every string a shape may hold: the closed vocabularies, and nothing else. */
const SHAPE_WORDS = new Set<string>([...VERDICTS, ...BANDS, ...SPLITS, ...PAIR_ANSWERERS]);

/**
 * **The synthetic grammar**: every string in a committed fixture — key or
 * value, at any depth — must be a word from the closed vocabularies above.
 * There is no free-text field in a shape, so a request, a screen title or a
 * canvas name can only appear by breaking this, and this says which string
 * broke it. Empty means the fixture is safe to commit.
 */
export function fixtureProblems(value: unknown, at = "$"): string[] {
  if (typeof value === "string") return SHAPE_WORDS.has(value) ? [] : [`${at}: ${JSON.stringify(value)} is not a word of the synthetic grammar`];
  if (Array.isArray(value)) return value.flatMap((v, i) => fixtureProblems(v, `${at}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, v]) => [
      ...(SHAPE_KEYS.has(key) ? [] : [`${at}: key ${JSON.stringify(key)} is not a field of the shape`]),
      ...fixtureProblems(v, `${at}.${key}`),
    ]);
  }
  return [];
}
