/**
 * **The fast path in shadow** (voice-agent phase 6): Jev listens to every
 * finished turn and NEVER acts.
 *
 * A turn is what the person said and what the live model did about it,
 * paired on the one socket where both arrive: input transcription pieces
 * open it, the model's tool calls are gathered into it, and the provider's
 * own end-of-turn closes it. The canvas it was said about is captured when it
 * opens — before the model's act lands, because "move it left" was said about
 * where it was, not where it went.
 *
 * On close the resolver asks Jev once, through the home's judgment route,
 * and the turn is recorded: the utterance, every answer with its
 * probability, what Jev would have done, the model's calls, and — after a
 * window of `UNDO_WINDOW_MS` — whether the model's act was undone. That last
 * one is the label: an act a person took back was a wrong act, whatever it
 * looked like.
 *
 * **Why it cannot act.** This file is handed no host: no `send`, no
 * `putBlob`, no `runTool`. Its only outputs are a saved record and a line of
 * text. `decide` would say "escalate" anyway — phase 6 has no measured
 * threshold — but a shadow that is harmless only because a number happens to
 * be missing is one config change from not being a shadow.
 *
 * Loaded lazily, and only when the switch is on: a person who never turns it
 * on downloads none of it.
 */
import { JUDGMENT_ROUTE, type JudgmentRequest } from "@isocan/core";
import { homeAnswerer, type JevRequest, type JevResponse } from "@isocan/core/jev";
import { describeAct, fastPathQuestions, modelAct, readProposal, type CanonicalAct, type Proposal } from "./fastpath.ts";
import type { SnapshotItem } from "./live.ts";

/** How long after an act a take-back still counts as undoing it. */
export const UNDO_WINDOW_MS = 10_000;
/** Transcription that trails the end of the turn by this much still belongs to it. */
export const LATE_PIECE_MS = 800;
/** How many turns the record keeps — the oldest go first. ~1.5 KB a turn. */
export const SHADOW_MAX_TURNS = 500;

/** "Undo that", in the words a person says it — the spoken half of the label. */
const SAID_UNDO = /\b(undo|take (that|it) back|put it back|never ?mind|revert)\b/i;

/** One turn, as the record keeps it. Ids are the canvas's; `titles` names the ones the turn mentions. */
export interface ShadowTurn {
  v: 1;
  at: string;
  canvasId: string;
  utterance: string;
  /** Items on the canvas when the turn opened. */
  items: number;
  /** Jev's answers: the chosen option, its probability, and the runners-up. */
  answers?: Proposal["answers"];
  /** What Jev would have done, at argmax — never done. */
  proposed: CanonicalAct;
  call?: { name: string; args: Record<string, unknown> };
  /** Why it would have escalated (or why nothing was asked). */
  reasons: string[];
  /** The least certain answer the proposal relied on — what a threshold compares. */
  p?: number;
  /** What the live model did this turn. */
  model: { calls: { name: string; args: Record<string, unknown> }[]; act: CanonicalAct };
  /** Was the model's act taken back within the window? `null` when the window was cut short. */
  undone: boolean | null;
  undoneBy?: "canvas" | "said";
  titles: Record<string, string>;
  /** Jev's own round trip, its input tokens, and who answered. */
  ms?: number;
  tokens?: number;
  by?: string;
  error?: string;
  /** Milliseconds from the turn's first transcription piece: its last piece, the model's first call, and the end of the turn. */
  timing: { lastHeard?: number; firstCall?: number; done: number };
}

/** An item's place and size, or null when it is not on the canvas — what an undo would put back. */
type Place = { x: number; y: number; width: number; height: number } | null;

function placeOf(items: readonly SnapshotItem[], id: string): Place {
  const i = items.find((one) => one.id === id);
  return i ? { x: Math.round(i.x), y: Math.round(i.y), width: Math.round(i.width), height: Math.round(i.height) } : null;
}

function samePlace(a: Place, b: Place): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ShadowDeps {
  canvasId: string;
  /** Ask Jev — the home's judgment route in the browser. Nothing else leaves this file. */
  ask: (request: JevRequest) => Promise<{ response: JevResponse; ms: number; by: string }>;
  /** The canvas projection now — `snapshotItemsFor` over the shell's facts. */
  items: () => SnapshotItem[];
  /** Keep one finished turn. */
  save: (turn: ShadowTurn) => void | Promise<void>;
  /** Say one line in the transcript. */
  note?: (text: string) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface Open {
  utterance: string;
  items: SnapshotItem[];
  lastAct?: string;
  started: number;
  lastHeard?: number;
  firstCall?: number;
  calls: { name: string; args: Record<string, unknown> }[];
}

interface Watching {
  turn: ShadowTurn;
  /** The item the model's act touched, or null for an act with none (undo, escalate). */
  subject: string | null;
  before: Place;
  moved: boolean;
  until: number;
  timer: unknown;
  /** Jev's answer arriving — the turn is saved only after both it and the window. */
  asked: Promise<void>;
  windowOver: boolean;
}

export interface Shadow {
  heard(text: string): void;
  toolCall(name: string, args: Record<string, unknown>): void;
  turnDone(): void;
  canvasChanged(items: readonly SnapshotItem[]): void;
  /** Save everything still pending — the session ended. Turns whose window was cut short say so (`undone: null`). */
  flush(): Promise<void>;
}

/**
 * **The shadow, for one live session.** Feed it what the socket says —
 * `heard` for each input transcription piece, `toolCall` for each call the
 * model makes (before it runs, so the canvas is still as it was), `turnDone`
 * on the provider's end of turn — and `canvasChanged` whenever the canvas
 * moves, which is how an undo by keyboard is seen.
 */
export function createShadow(deps: ShadowDeps): Shadow {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let open: Open | null = null;
  /** The turn just closed, still taking late transcription for `LATE_PIECE_MS`. */
  let closing: { turn: Open; timer: unknown } | null = null;
  const watching = new Set<Watching>();
  let lastAct: string | undefined;

  const begin = (): Open => ({ utterance: "", items: deps.items(), ...(lastAct ? { lastAct } : {}), started: now(), calls: [] });

  const finish = async (w: Watching, cutShort: boolean) => {
    if (!watching.has(w)) return;
    clearTimer(w.timer);
    w.windowOver = true;
    await w.asked;
    if (!watching.delete(w)) return;
    if (cutShort && !w.turn.undone && w.subject !== null) w.turn.undone = null;
    await deps.save(w.turn);
  };

  /** Ask Jev about one closed turn, and write its answers into the record in place. */
  const ask = async (turn: Open, entry: ShadowTurn) => {
    const generated = fastPathQuestions(entry.utterance, { items: turn.items, ...(turn.lastAct ? { lastAct: turn.lastAct } : {}) });
    if (!generated.ok) {
      entry.reasons = [generated.reason];
    } else {
      try {
        const answered = await deps.ask(generated.ask.request);
        const proposal = readProposal(generated.ask, answered.response);
        entry.answers = proposal.answers;
        entry.proposed = proposal.act;
        if (proposal.call) entry.call = proposal.call;
        entry.reasons = proposal.reasons;
        entry.p = proposal.p;
        entry.ms = answered.ms;
        entry.tokens = answered.response.usage?.input_tokens ?? 0;
        entry.by = answered.by;
      } catch (error) {
        entry.error = String((error as Error).message ?? error);
        entry.reasons = ["Jev was not asked successfully"];
      }
    }
    for (const a of [entry.proposed, entry.model.act]) {
      for (const id of ["subject" in a ? a.subject : null, "target" in a ? a.target : null]) {
        const item = id ? turn.items.find((i) => i.id === id) : undefined;
        if (item) entry.titles[item.id] = item.title ?? "";
      }
    }
    deps.note?.(
      entry.error
        ? `fast path (shadow): Jev could not be asked — ${entry.error}`
        : `fast path (shadow, did nothing): Jev would ${describeAct(entry.proposed, turn.items)}` +
            (entry.p !== undefined ? ` · p ${entry.p.toFixed(2)}` : "") +
            (entry.proposed.act === "escalate" && entry.reasons.length ? ` (${entry.reasons[0]})` : ""),
    );
  };

  const close = (turn: Open) => {
    const utterance = turn.utterance.replace(/\s+/g, " ").trim();
    if (!utterance && turn.calls.length === 0) return;
    const done = now();
    const act = modelAct(turn.calls, turn.items);
    if (act.act !== "escalate") lastAct = describeAct(act, turn.items);
    const entry: ShadowTurn = {
      v: 1,
      at: new Date(turn.started).toISOString(),
      canvasId: deps.canvasId,
      utterance,
      items: turn.items.length,
      proposed: { act: "escalate" },
      reasons: [],
      model: { calls: turn.calls, act },
      undone: false,
      titles: {},
      timing: {
        ...(turn.lastHeard !== undefined ? { lastHeard: turn.lastHeard - turn.started } : {}),
        ...(turn.firstCall !== undefined ? { firstCall: turn.firstCall - turn.started } : {}),
        done: done - turn.started,
      },
    };
    // The label: the model's act is watched for a take-back from now, while
    // Jev is still being asked — a quick "no, undo" must not slip between.
    const subject = "subject" in act ? act.subject : null;
    const before = subject ? placeOf(turn.items, subject) : null;
    const w: Watching = {
      turn: entry,
      subject,
      before,
      // The act has usually landed already (the call ran before the turn
      // ended), so "has it moved" is asked of the canvas now, not only on the
      // next change.
      moved: subject ? !samePlace(placeOf(deps.items(), subject), before) : false,
      until: done + UNDO_WINDOW_MS,
      timer: null,
      asked: ask(turn, entry),
      windowOver: false,
    };
    w.timer = setTimer(() => void finish(w, false), UNDO_WINDOW_MS);
    watching.add(w);
  };

  /** A take-back said out loud (or asked of the model) inside a watched act's window. */
  const heardUndo = () => {
    const t = now();
    for (const w of watching) {
      const act = w.turn.model.act.act;
      if (!w.windowOver && t <= w.until && act !== "escalate" && act !== "undo" && !w.turn.undone) {
        w.turn.undone = true;
        w.turn.undoneBy = "said";
      }
    }
  };

  return {
    heard(text) {
      if (!text) return;
      if (!open && closing) {
        // A piece that trails the end of the turn is the end of what was
        // said, not the start of something new.
        closing.turn.utterance += text;
        closing.turn.lastHeard = now();
        return;
      }
      open ??= begin();
      open.utterance += text;
      open.lastHeard = now();
      if (SAID_UNDO.test(open.utterance)) heardUndo();
    },
    toolCall(name, args) {
      // A call with no transcription yet still opens the turn — and the
      // canvas it captures is the one before this call runs.
      open ??= begin();
      open.calls.push({ name, args });
      open.firstCall ??= now();
      if (name === "undo") heardUndo();
    },
    turnDone() {
      if (!open) return;
      const turn = open;
      open = null;
      if (closing) {
        clearTimer(closing.timer);
        close(closing.turn);
      }
      closing = {
        turn,
        timer: setTimer(() => {
          if (closing?.turn === turn) closing = null;
          close(turn);
        }, LATE_PIECE_MS),
      };
    },
    canvasChanged(items) {
      for (const w of watching) {
        if (!w.subject || w.turn.undone || w.windowOver) continue;
        const place = placeOf(items, w.subject);
        if (!w.moved) {
          if (!samePlace(place, w.before)) w.moved = true;
        } else if (samePlace(place, w.before)) {
          w.turn.undone = true;
          w.turn.undoneBy = "canvas";
        }
      }
    },
    async flush() {
      if (closing) {
        clearTimer(closing.timer);
        const turn = closing.turn;
        closing = null;
        close(turn);
      }
      if (open) {
        const turn = open;
        open = null;
        close(turn);
      }
      await Promise.all([...watching].map((w) => finish(w, true)));
    },
  };
}


// ---------- how Jev is asked

/**
 * **Jev, through the home's judgment route** — the key stays on the home
 * (fast-path.md, *No key in the browser*). A dialog's host carries `judge`
 * (wireframes phase 5) and it is used when handed; the composer's host does
 * not, so the same route is posted to directly, on this origin with this
 * tab's badge cookie — the door is the route's own (the badge must be able to
 * edit this canvas), so nothing is widened by asking from here.
 *
 * Given the judge function and nothing else of the host: this cannot send an
 * operation because it is never handed the thing that could.
 */
export function homeAsk(canvasId: string, judge?: (question: JudgmentRequest) => Promise<unknown>): ShadowDeps["ask"] {
  const post = judge ?? (async (question: JudgmentRequest): Promise<unknown> => {
    const res = await fetch(JUDGMENT_ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(question),
    });
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (!res.ok) throw Object.assign(new Error(body?.error ?? `the home answered ${res.status}`), { code: body?.code });
    return body;
  });
  const answerer = homeAnswerer(post, canvasId);
  return (request) => answerer.answer(request);
}

// ---------- where the record lives

/**
 * **The record lives in this browser's OPFS** — `voice/fast-path-shadow.jsonl`
 * under the page's origin, the store the voice-agent page already uses for
 * its own state (`packages/voice-agent/src/main.ts`, *Memory*). Per person,
 * per browser, never on the canvas and never on the home: the utterances are
 * what somebody said out loud. Bounded to `SHADOW_MAX_TURNS`, oldest first
 * out. Without OPFS (a private window) it lives in this tab and says so.
 */
export const SHADOW_DIR = "voice";
export const SHADOW_FILE = "fast-path-shadow.jsonl";

interface FileHandle {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
}
interface DirHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
}

let inTab: ShadowTurn[] = [];
/** Writes queue behind each other: two turns saved at once must not race one file. */
let writing: Promise<unknown> = Promise.resolve();

async function shadowFile(create: boolean): Promise<FileHandle | null> {
  try {
    const storage = (globalThis.navigator as { storage?: { getDirectory?: () => Promise<DirHandle> } } | undefined)?.storage;
    if (!storage?.getDirectory) return null;
    const root = await storage.getDirectory();
    const dir = await root.getDirectoryHandle(SHADOW_DIR, { create });
    return await dir.getFileHandle(SHADOW_FILE, { create });
  } catch {
    return null;
  }
}

/** Lines of JSON, bounded — the parse the script's `--record` reads too. */
export function parseShadow(text: string): ShadowTurn[] {
  const out: ShadowTurn[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const t = JSON.parse(line) as ShadowTurn;
      if (t && t.v === 1 && typeof t.utterance === "string") out.push(t);
    } catch {
      /* a torn last line from a closed tab — skipped, not fatal */
    }
  }
  return out;
}

export async function readShadow(): Promise<{ turns: ShadowTurn[]; where: "opfs" | "tab" }> {
  const handle = await shadowFile(false);
  if (!handle) return { turns: inTab, where: (await shadowFile(true)) ? "opfs" : "tab" };
  return { turns: parseShadow(await (await handle.getFile()).text()), where: "opfs" };
}

async function writeAll(turns: ShadowTurn[]): Promise<void> {
  const kept = turns.slice(-SHADOW_MAX_TURNS);
  const handle = await shadowFile(true);
  if (!handle) {
    inTab = kept;
    return;
  }
  const w = await handle.createWritable();
  await w.write(kept.map((t) => JSON.stringify(t)).join("\n") + (kept.length ? "\n" : ""));
  await w.close();
}

export function saveShadowTurn(turn: ShadowTurn): Promise<void> {
  const next = writing.then(async () => {
    const { turns } = await readShadow();
    await writeAll([...turns, turn]);
  });
  writing = next.catch(() => undefined);
  return next;
}

export function clearShadow(): Promise<void> {
  const next = writing.then(() => writeAll([]));
  writing = next.catch(() => undefined);
  return next;
}
