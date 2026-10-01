/**
 * **The fast path acts** (voice-agent phase 7, `docs/projects/voice-agent/fast-path.md`).
 *
 * The shadow (`shadow.ts`) listens and never acts; this is the half that
 * does, and it is a separate file so the shadow can stay provably harmless.
 * It is HANDED its executor — `runTool`, the very function the model's own
 * tool call goes through in `web.tsx` — and owns nothing that writes: one
 * executor, so a fast act mints the same `Operation`, is one undo, and wears
 * the same identity as the model's would have.
 *
 * ## The hold
 *
 * Nobody has yet read, from a real record, whether a spoken sentence's
 * transcript finishes before the live model's first tool call. So this does
 * not race the model: while a turn's words are still arriving, or its Jev
 * question is in flight, the model's tool calls for that turn are HELD — not
 * run, not answered — for at most `HOLD_MS`.
 *
 * - Jev says **act**: the act runs through `runTool`, is announced, and the
 *   model's calls for the turn are dropped — each answered, honestly, with
 *   "already done by the fast path", so the provider session is never left
 *   waiting on a call nobody will answer.
 * - Jev says **escalate**, or the deadline passes first: the held calls are
 *   released unchanged, in order, and the fast path does nothing more for
 *   that turn even if Jev answers later — acting then would be the second
 *   executor this design refuses.
 *
 * Every turn's held time is written into its record, so the microphone walk
 * can say what the hold costs.
 *
 * ## When "the words are done"
 *
 * The provider's own end-of-turn arrives only after the model has answered
 * — after its tool calls have been answered — so it cannot be the signal.
 * The words are taken as done once the model has begun answering (its first
 * audio, or a tool call) and no new piece of transcription has arrived for
 * `QUIET_MS`. A piece that arrives after Jev was asked voids the answer (the
 * question was about half a sentence) and the turn escalates; one that
 * arrives after the act is recorded as `late`, which is the number the walk
 * exists to read.
 */
import { canonicalCall, decide, describeAct, fastPathQuestions, modelAct, readProposal, sameAct, saysANumber, type CanonicalAct, type Thresholds } from "./fastpath.ts";
import type { ShadowDeps, ShadowTurn } from "./shadow.ts";
import type { SnapshotItem } from "./live.ts";

/**
 * **How long a model tool call may be held** waiting on the fast path. Jev's
 * measured p50 is 120–220 ms and its slow tail under a second (phase 6), plus
 * `QUIET_MS` for the words to settle: 1.5 s covers the tail with room and is
 * still shorter than the pause a person reads as "it didn't hear me". Past it
 * the model's calls run as they always did, so the worst a slow judge costs
 * is this much delay, never a lost or doubled act.
 */
export const HOLD_MS = 1500;
/** Silence in the transcription, once the model has begun answering, that says the sentence is finished. */
export const QUIET_MS = 300;
/** How long after a fast act a model call that does the same act is still a duplicate. */
export const ECHO_MS = 10_000;

export interface ModelCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
}

/** What to do with one of the model's calls: run it, or answer it without running it. */
export type Verdict = { run: true } | { run: false; response: Record<string, unknown> };

export interface FastActDeps {
  canvasId: string;
  /** Measured, per action (`thresholds.ts`). An action with none escalates. */
  thresholds: Thresholds;
  /** Ask Jev — the home's judgment route in the browser (`shadow.ts`'s `homeAsk`). */
  ask: ShadowDeps["ask"];
  /** The canvas projection now — `snapshotItemsFor` over the shell's facts. */
  items: () => SnapshotItem[];
  /** **The executor, injected**: the same `runTool` the model's call goes through. */
  runTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Tell the live session, in a text turn, what was done for it. */
  tell: (text: string) => void;
  /** Say one line in the transcript. */
  note?: (text: string) => void;
  /** The last act in this conversation before the fast path started listening, for "it" and "that". */
  lastAct?: string;
  /** Keep one finished turn (the shadow's record, with a `fast` block). */
  save?: (turn: ShadowTurn) => void | Promise<void>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

type Phase = "listening" | "asking" | "acting" | "acted" | "escalated" | "released";
const PENDING: ReadonlySet<Phase> = new Set(["listening", "asking", "acting"]);

interface Turn {
  utterance: string;
  items: SnapshotItem[];
  lastAct?: string;
  started: number;
  lastHeard?: number;
  firstCall?: number;
  modelBegan: boolean;
  calls: { name: string; args: Record<string, unknown> }[];
  phase: Phase;
  quiet: unknown;
  /** Resolves when the phase leaves listening/asking/acting. */
  settled: Promise<void>;
  settle: () => void;
  /** Words arrived after Jev was asked: its answer was about half a sentence. */
  stale: boolean;
  /** Words arrived after the act. */
  late: boolean;
  /** Calls held right now. */
  holding: number;
  held: number;
  dropped: number;
  asked?: number;
  acted?: number;
  act?: CanonicalAct;
  announced?: string;
  entry: Partial<ShadowTurn>;
  reasons: string[];
}

export interface FastPath {
  /** One piece of the person's transcription. */
  heard(text: string): void;
  /** The model began answering (audio, or its words) — the person's sentence is ending. */
  modelBegan(): void;
  /** The model's tool calls, held while the fast path decides; one verdict per call, in order. */
  gate(calls: readonly ModelCall[]): Promise<Verdict[]>;
  /** The provider's end of turn (or a barge-in). */
  turnDone(): void;
  /** Save everything still pending — the session ended. */
  flush(): Promise<void>;
}

/** An act in the past tense, for the announcement. */
export function announce(act: CanonicalAct, items: readonly SnapshotItem[]): string {
  if (act.act === "undo") return "undid your last change";
  const said = describeAct(act, items);
  const past = said
    .replace(/^move /, "moved ")
    .replace(/^make /, "made ")
    .replace(/^delete /, "deleted ")
    .replace(/^select /, "selected ")
    .replace(/^show /, "showing ");
  return `${past} — say undo`;
}

export function createFastPath(deps: FastActDeps): FastPath {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let current: Turn | null = null;
  let lastAct: string | undefined = deps.lastAct;
  /** The last fast act, and the canvas it was done on — for the duplicate a later turn may still carry. */
  let lastFast: { act: CanonicalAct; items: SnapshotItem[]; at: number; said: string } | null = null;
  const closing = new Set<Promise<void>>();

  const open = (): Turn => {
    let settle!: () => void;
    const settled = new Promise<void>((r) => (settle = r));
    const t: Turn = {
      utterance: "", items: deps.items(), ...(lastAct ? { lastAct } : {}), started: now(), modelBegan: false, calls: [],
      phase: "listening", quiet: null, settled, settle, stale: false, late: false, holding: 0, held: 0, dropped: 0, entry: {}, reasons: [],
    };
    current = t;
    return t;
  };

  const finish = (t: Turn, phase: "acted" | "escalated" | "released", reasons: string[] = []) => {
    if (!PENDING.has(t.phase)) return;
    t.phase = phase;
    if (reasons.length) t.reasons = reasons;
    clearTimer(t.quiet);
    t.settle();
  };

  const scheduleQuiet = (t: Turn) => {
    if (t.phase !== "listening" || !t.modelBegan) return;
    clearTimer(t.quiet);
    t.quiet = setTimer(() => void ask(t), QUIET_MS);
  };

  /** One Jev question for the turn, and — above a measured threshold — the act. */
  const ask = async (t: Turn) => {
    if (t.phase !== "listening") return;
    t.phase = "asking";
    clearTimer(t.quiet);
    const said = t.utterance.replace(/\s+/g, " ").trim();
    t.asked = now() - t.started;
    const generated = fastPathQuestions(said, { items: t.items, ...(t.lastAct ? { lastAct: t.lastAct } : {}) });
    if (!generated.ok) return finish(t, "escalated", [generated.reason]);
    let proposal;
    try {
      const answered = await deps.ask(generated.ask.request);
      proposal = readProposal(generated.ask, answered.response);
      Object.assign(t.entry, {
        answers: proposal.answers, proposed: proposal.act, ...(proposal.call ? { call: proposal.call } : {}), p: proposal.p,
        ms: answered.ms, tokens: answered.response.usage?.input_tokens ?? 0, by: answered.by,
      });
    } catch (error) {
      t.entry.error = String((error as Error).message ?? error);
      deps.note?.(`fast path: Jev could not be asked — ${t.entry.error}; the model has it`);
      return finish(t, "escalated", ["Jev was not asked successfully"]);
    }
    // The deadline let the model's calls go while Jev was thinking: the model
    // has it now, and a second act would be the double this design refuses.
    if (t.phase !== "asking") {
      t.reasons = [...proposal.reasons, "the model's calls were released before Jev answered"];
      return;
    }
    if (t.stale) return finish(t, "escalated", ["the words were still arriving when Jev was asked"]);
    if (proposal.act.act !== "escalate" && saysANumber(said, t.items)) return finish(t, "escalated", ["a number was said — numbers are the model's"]);
    const decision = decide(proposal, deps.thresholds);
    if (decision.decision === "escalate") return finish(t, "escalated", decision.reasons);
    t.phase = "acting";
    let result: Record<string, unknown>;
    try {
      result = await deps.runTool(decision.call.name, decision.call.args);
    } catch (error) {
      result = { ok: false, error: String((error as Error).message ?? error) };
    }
    if (result.ok !== true) {
      deps.note?.(`fast path: tried to ${describeAct(decision.act, t.items)} and could not (${String(result.error)}) — the model has it`);
      return finish(t, "escalated", [`the fast act failed: ${String(result.error)}`]);
    }
    t.acted = now() - t.started;
    t.act = decision.act;
    t.announced = announce(decision.act, t.items);
    lastFast = { act: decision.act, items: t.items, at: now(), said };
    lastAct = describeAct(decision.act, t.items);
    deps.note?.(`fast path: ${t.announced}`);
    // A model call already held for this turn will be answered "already done"
    // — that answer IS the telling. With none held, the session is told in a
    // turn of its own, so whatever it was about to do, it does not do this.
    if (t.holding === 0) {
      deps.tell(
        `[fast path] The collaborator's request "${said}" has ALREADY been carried out on the canvas: ${t.announced.replace(/ — say undo$/, "")}. ` +
          "Do NOT do it again — a tool call for it will be refused. Confirm it in a few words.",
      );
    }
    finish(t, "acted");
  };

  /** The model's call, against the turn's outcome. Calls that only look always run: they cannot do anything twice. */
  const verdict = (t: Turn, call: ModelCall): Verdict => {
    const args = call.args ?? {};
    const looks = canonicalCall(call.name, args, t.items) === null;
    if (looks) return { run: true };
    const refuse = (what: string): Verdict => {
      t.dropped++;
      return {
        run: false,
        response: { ok: false, error: `already done by the fast path: ${what}. Do NOT do it again — tell the collaborator it is done.` },
      };
    };
    if (t.phase === "acted") return refuse(t.announced!.replace(/ — say undo$/, ""));
    if (lastFast && now() - lastFast.at <= ECHO_MS) {
      const theirs = canonicalCall(call.name, args, lastFast.items);
      if (theirs && theirs.act !== "escalate" && sameAct(theirs, lastFast.act)) return refuse(announce(lastFast.act, lastFast.items).replace(/ — say undo$/, ""));
    }
    return { run: true };
  };

  const close = (t: Turn) => {
    const done = (async () => {
      await t.settled;
      const model = modelAct(t.calls, t.items);
      if (!t.act && model.act !== "escalate") lastAct = describeAct(model, t.items);
      const titles: Record<string, string> = {};
      for (const a of [t.entry.proposed, model, t.act]) {
        if (!a) continue;
        for (const id of ["subject" in a ? a.subject : null, "target" in a ? a.target : null]) {
          const item = id ? t.items.find((i) => i.id === id) : undefined;
          if (item) titles[item.id] = item.title ?? "";
        }
      }
      const doneAt = now();
      const turn: ShadowTurn = {
        v: 1,
        at: new Date(t.started).toISOString(),
        canvasId: deps.canvasId,
        utterance: t.utterance.replace(/\s+/g, " ").trim(),
        items: t.items.length,
        proposed: { act: "escalate" },
        reasons: t.reasons,
        ...t.entry,
        model: { calls: t.calls, act: model },
        // Act mode does not watch for take-backs; the walk asks the person.
        undone: null,
        titles,
        timing: {
          ...(t.lastHeard !== undefined ? { lastHeard: t.lastHeard - t.started } : {}),
          ...(t.firstCall !== undefined ? { firstCall: t.firstCall - t.started } : {}),
          done: doneAt - t.started,
        },
        fast: {
          decision: t.phase === "acted" ? "act" : t.phase === "released" ? "released" : "escalate",
          held: t.held,
          dropped: t.dropped,
          ...(t.asked !== undefined ? { asked: t.asked } : {}),
          ...(t.acted !== undefined ? { acted: t.acted } : {}),
          ...(t.late ? { late: true } : {}),
        },
      };
      await deps.save?.(turn);
    })();
    closing.add(done);
    void done.finally(() => closing.delete(done));
  };

  const turnDone = () => {
    const t = current;
    if (!t) return;
    current = null;
    // Still listening at the end of a turn means the words never settled —
    // or a barge-in cut across them. Asking now would be asking about half a
    // sentence, so the turn is the model's, as it always was.
    if (t.phase === "listening") {
      finish(t, "escalated", [t.utterance.trim() ? "the turn ended while the words were still arriving" : "nothing was said"]);
    }
    close(t);
  };

  return {
    heard(text) {
      if (!text) return;
      const t = current ?? open();
      t.utterance += text;
      t.lastHeard = now();
      if (t.phase === "asking") t.stale = true;
      else if (t.phase === "acting" || t.phase === "acted") t.late = true;
      scheduleQuiet(t);
    },
    modelBegan() {
      const t = current ?? open();
      if (t.modelBegan) return;
      t.modelBegan = true;
      scheduleQuiet(t);
    },
    async gate(calls) {
      const t = current ?? open();
      for (const c of calls) t.calls.push({ name: c.name, args: c.args ?? {} });
      t.firstCall ??= now();
      if (!t.modelBegan) {
        t.modelBegan = true;
        scheduleQuiet(t);
      } else if (t.phase === "listening" && t.quiet === null) scheduleQuiet(t);
      if (PENDING.has(t.phase)) {
        const arrived = now();
        t.holding++;
        let timer: unknown = null;
        const deadline = new Promise<"deadline">((r) => (timer = setTimer(() => r("deadline"), HOLD_MS)));
        const first = await Promise.race([t.settled.then(() => "settled" as const), deadline]);
        clearTimer(timer);
        // An act already running finishes; it is never cut in half to make a deadline.
        if (first === "deadline" && t.phase === "acting") await t.settled;
        else if (first === "deadline" && PENDING.has(t.phase)) {
          finish(t, "released", [...t.reasons, `held ${HOLD_MS} ms without an answer — released to the model`]);
          deps.note?.(`fast path: no answer in ${HOLD_MS} ms — the model has it`);
        }
        t.holding--;
        t.held += now() - arrived;
      }
      return calls.map((c) => verdict(t, c));
    },
    turnDone,
    async flush() {
      turnDone();
      await Promise.all([...closing]);
    },
  };
}
