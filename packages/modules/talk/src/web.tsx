import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  besideBox,
  isBesideSide,
  mainThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  defaultSize,
  itemKind,
  type CanvasContents,
  type ComposerFacts,
  type DialogFacts,
  type Operation,
  type OverlayFacts,
  type WebHost,
  modifierClick,
  type WebModule,
} from "@isocan/core";
import { VoiceBeam } from "voice-glow";
import { LevelMeter, Playback, capture, fromBytes, type Capture } from "./audio.ts";
import { LIVE_MODEL, LIVE_VOICES, canvasSnapshotText, commandsBrief, isLiveVoice, liveSetup, liveUrl, planForCall, toolScheduling, type SnapshotItem } from "./live.ts";
import { voiceCore } from "./core.ts";

/**
 * **Talk to the canvas** — a Gemini Live session from THIS browser, with
 * THIS person's key, in two doors that have settled into two jobs:
 *
 * - The floating mic is the TALKING: one press starts (a stored key makes
 *   the press the whole gesture), one press stops, and the feedback — the
 *   pulsing button, the level bars, the last words — floats by the button
 *   and is gone when the turn is. Nothing pops up, the way the voice-agent
 *   page's chrome disappears.
 * - The ⌘K dialog is the CONFIGURATION: the key, the model, and a test
 *   listen. It only needs to open on first run.
 *
 * The module rule is honoured to the letter: the key is a string in this
 * browser's storage (per-user, per-origin — never on the canvas, never in
 * the daemon), tool calls are ordinary operations, and removing the module
 * leaves nothing that is not already a file or a comment.
 */

/** The key's shelf: this browser, this origin. A person's key, not the
 *  canvas's — the one scope a module may hold without a server route. */
const KEY_SHELF = "isocan:voice:key";
const MODEL_SHELF = "isocan:voice:model";
const VOICE_SHELF = "isocan:voice:voice";

/** How many bars each meter shows; the shared paint divides the level into
 *  this many buckets. */
const METER_COUNT = 5;
/** How often the meters are re-painted, in milliseconds. The CSS transition
 *  between paints is what makes the bars glide rather than jump. */
const METER_INTERVAL_MS = 60;

type SessionState = "idle" | "live" | "refused";

/**
 * **The meter's own rules, shared by every surface that draws one.**
 *
 * They lived inside the config dialog's `<style>` block, so the composer's
 * meters were unstyled spans with no width or height — invisible, which is
 * why the level appeared not to move at all while a session ran. Third time
 * today that a rule was scoped to a component that was not the one rendering
 * it; a stylesheet a component owns is only present while that component is.
 */
const METER_CSS = `
  .talk-meter { display: flex; align-items: center; gap: 3px; height: 24px; }
  .talk-meter span {
    width: 4px; border-radius: 2px; background: var(--line);
    height: 4px; transition: height 80ms linear;
  }
  /* Taller and brighter the louder it is — five bars, so a voice reads as a
     shape rather than as on/off. */
  .talk-meter[data-live="1"] span[data-on="1"] { background: var(--accent); height: 20px; }
`;

/** One line of the conversation, for the caption the person reads. */
export interface Line {
  who: "you" | "model" | "system";
  text: string;
  /**
   * **How many times this same system line happened in a row.** Absent means
   * once, so an ordinary line is the object it always was.
   *
   * A voice turn that rearranges a canvas emits one `move_item → done` per
   * item, and seven of them filled the transcript with a form while the
   * sentence that caused them scrolled out of sight. They are one fact —
   * "it moved things" — repeated, and the count is the honest way to say so
   * in one row.
   */
  count?: number;
  /**
   * **This speaker has finished the turn.** Transcription arrives in pieces
   * and is appended to the line in progress; `turnComplete` is what says the
   * next piece belongs to a new line rather than to this one.
   */
  done?: boolean;
}

/** How much of a conversation the panel keeps. Long enough to scroll back
 *  through a few exchanges, bounded so a long session cannot grow without
 *  end — the whole thing is posted to the Chat when it stops. */
const MAX_LINES = 60;

/**
 * **Two pieces of one sentence, joined.**
 *
 * Straight concatenation, because that is what an incremental text field
 * means: the provider's pieces carry their own leading spaces, and inserting
 * one here would break every word it split mid-token. The only tidying is
 * collapsing a doubled space, which is what happens when a piece brings a
 * leading space to a line that already ended in one.
 */
function joinSpeech(before: string, piece: string): string {
  return `${before}${piece}`.replace(/ {2,}/g, " ");
}

/** The last line of actual SPEECH, skipping the tool rows that landed inside
 *  it; -1 when nobody has spoken yet. */
function lastSpoken(lines: readonly Line[]): number {
  let at = lines.length - 1;
  while (at >= 0 && lines[at]!.who === "system") at--;
  return at;
}

/**
 * **One piece of transcription folded into the conversation so far** — the
 * whole of the panel's line bookkeeping, as a function of what came before,
 * so it can be tested without a socket or a microphone.
 *
 * See `useTalkSession`'s `say` for why a piece is appended rather than
 * replacing, and why a system row in between does not end a sentence.
 */
export function foldLine(lines: readonly Line[], who: Line["who"], text: string): Line[] {
  if (who === "system") {
    const last = lines[lines.length - 1];
    if (last?.who === "system" && last.text === text) {
      return [...lines.slice(0, -1), { ...last, count: (last.count ?? 1) + 1 }];
    }
    return [...lines, { who, text }].slice(-MAX_LINES);
  }
  const at = lastSpoken(lines);
  const open = at >= 0 && lines[at]!.who === who && !lines[at]!.done;
  if (!open) return [...lines, { who, text }].slice(-MAX_LINES);
  const grown = { ...lines[at]!, text: joinSpeech(lines[at]!.text, text) };
  return [...lines.slice(0, at), grown, ...lines.slice(at + 1)];
}

/** The speaker's turn is over: the next piece starts a new line. A second
 *  call changes nothing, so two end-of-turn signals cost one seal. */
export function sealLines(lines: readonly Line[]): Line[] {
  const at = lastSpoken(lines);
  if (at < 0 || lines[at]!.done) return [...lines];
  return [...lines.slice(0, at), { ...lines[at]!, done: true }, ...lines.slice(at + 1)];
}

/** One WebSocket frame, decoded — the browser delivers binary frames as
 *  Blob or ArrayBuffer, and every one of them is JSON on this wire. The
 *  provider's audio comes back as Blob frames, which is how the first build
 *  of this dialog spent a day parsing "[object Blob]". */
/**
 * **The canvas, as the facts a live session is handed** (#337).
 *
 * Geometry and kind travel with every item, because a session told only
 * titles and ids cannot be asked to move one thing next to another: the tool
 * takes pixels, and nothing it was shown says where anything is.
 *
 * `itemKind` is called here for the reason the standing harness does not have
 * to — the harness lists `ListedItem`, which carries the kind already, while
 * the shell hands this module ordinary `Item`s. Both surfaces must arrive at
 * the same row, so this is the one place the browser's half is spelled.
 */
export function snapshotItemsFor(
  canvas: CanvasContents,
  /** What the person has picked out, by id. The shell's, handed over. */
  selection: readonly string[] = [],
): SnapshotItem[] {
  const picked = new Set(selection);
  return Object.values(canvas.items ?? {}).map((i) => ({
    id: i.id,
    title: i.title,
    kind: itemKind(i),
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
    // The colour word is derived from these by `canvasSnapshotText`, not
    // here: both surfaces hand over the same bag, so deriving it once is what
    // keeps "red" meaning one thing on both.
    properties: i.properties,
    ...(i.containerId ? { containerId: i.containerId } : {}),
    ...(picked.has(i.id) ? { selected: true } : {}),
  }));
}

export async function decodeMessage(data: unknown): Promise<Record<string, unknown> | null> {
  let text: string;
  if (typeof data === "string") text = data;
  else if (data instanceof Blob) text = await data.text();
  else if (data instanceof ArrayBuffer) text = new TextDecoder().decode(data);
  else if (ArrayBuffer.isView(data)) text = new TextDecoder().decode(data as ArrayBufferView);
  else return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** What the shared pieces need: the canvas, the host to write through, and
 *  whether writes are allowed. Both doors hand these — the dialog's facts
 *  carry more, the overlay's fewer, and the session asks for nothing else. */
export interface PanelFacts {
  canvasId: string;
  /** What the person has picked out, when the surface has a selection to
   *  report. Absent from the ⌘K dialog, which is configuration. */
  selection?: readonly string[];
  canvas: CanvasContents;
  host: WebHost;
  canEdit: boolean;
  /** The saved canvas mode — `item.add` on a groups canvas must name its
   *  insertion (`containerId` + `groupPlacement`), which a legacy canvas
   *  never sees. */
  groupMode: "groups" | "legacy";
}

/**
 * **One tool call, as canvas operations.** The planner is the harness's own
 * (`@isocan/voice-agent/live`'s `planForCall`) — one spelling of every verb.
 * What this adds is the WEB half: ids are minted here, a `ref` becomes an
 * itemId against this canvas, and `item.add` content becomes a blob through
 * the host. Read tools answer from the facts the shell already handed over.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  facts: PanelFacts,
  /**
   * **What the PANEL adds to a call the model did not make.**
   *
   * `record` is the only one: the session block posts through `say` so it
   * takes that path's thread birth and undo, but a record is a thing the
   * panel knows and the model must not be able to claim — it is absent from
   * the tool declarations for that reason, so it cannot ride in on `args`
   * and the planner never sees it.
   */
  from: { record?: true } = {},
): Promise<Record<string, unknown>> {
  const { plans, what } = planForCall(name, args);

  // The four read tools the planner marks, answered locally — the model
  // asked what the canvas holds, and the shell already told the dialog.
  if (what === "__read_canvas__") {
    /**
     * **The same wording the session opened with.** This used to answer with
     * a shorter list of its own — titles and ids and nothing else — so a
     * model that re-read the canvas got LESS than it was told at setup: no
     * geometry, no colour, no selection. Re-reading to check something is
     * exactly when the facts must not get thinner.
     */
    const threads = Object.values(facts.canvas.threads ?? {});
    return {
      ok: true,
      answer: canvasSnapshotText(
        snapshotItemsFor(facts.canvas, facts.selection ?? []),
        threads as { id: string; comments: unknown[] }[],
      ),
    };
  }
  if (what === "__read_item__") {
    const ref = String(args.item_ref ?? "");
    const item = Object.values(facts.canvas.items ?? {}).find(
      (i) => i.id === ref || (i.title ?? "").toLowerCase().startsWith(ref.toLowerCase()),
    );
    if (!item) return { ok: false, error: `no item matches "${ref}"` };
    /**
     * **It used to answer with the title and the id.**
     *
     * Both of which the asker already had — that is how it addressed the
     * item. So "tell me about this one" returned nothing, and the session
     * filled the gap the way models do. One row of the projection says more
     * than the old answer did, so this answers in that wording and then adds
     * what a single item can say and a list cannot.
     */
    const [row] = snapshotItemsFor(facts.canvas, facts.selection ?? [])
      .filter((one) => one.id === item.id);
    const current = item.versions?.find((v) => v.id === item.currentVersionId);
    const reactions = Object.entries(item.reactions ?? {})
      .map(([mark, who]) => `${mark}×${who.length}`)
      .join(" ");
    return {
      ok: true,
      answer: [
        row ? canvasSnapshotText([row], []).split("\n").find((l) => l.startsWith("- ")) : null,
        item.description ? `description: ${item.description}` : null,
        current?.filename ? `file: ${current.filename} (${current.mimeType ?? "unknown type"})` : null,
        item.versions && item.versions.length > 1 ? `versions: ${item.versions.length}` : null,
        reactions ? `reactions: ${reactions}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  if (what === "__read_threads__") {
    const threads = Object.values(facts.canvas.threads ?? {});
    return {
      ok: true,
      answer: threads.map((t) => `${t.id} (${t.comments.length} comments)`).join("; ") || "no threads",
    };
  }
  if (what === "__undo__") {
    /**
     * The standing harness undoes through the daemon client; `WebHost` has
     * `send`, `putBlob`, `enrol` and `viewer` and no retract, so this dialog
     * cannot honour it without widening the module API — a versioned decision
     * with its own PROPOSED list, not something to slip into a bug fix.
     *
     * Declining in words is still strictly better than what happened before
     * the tool existed, which was the model inventing an inverse operation and
     * the log claiming both changes were meant. Same shape as presence below.
     */
    return {
      ok: false,
      error:
        "undo is not carried by the browser voice dialog yet — say so, and do NOT move, re-add or rename " +
        "anything to compensate; the collaborator can undo with the keyboard.",
    };
  }
  if (what === "__read_presence__") {
    return { ok: false, error: "presence is not carried by the browser voice dialog yet" };
  }
  /**
   * **The person's own view: selection and camera.**
   *
   * Neither is written — a selection and a camera are one person's, not the
   * canvas's — so these go through the host rather than through an operation,
   * and nobody else's screen moves.
   *
   * They were DECLARED and unwired: the model called `selection_set`, got
   * `{ok:false, error:"__selection_set__"}` back, and had an internal token
   * where a sentence should be. "Can you select the checkout screen" failed,
   * and the model could not say why because nothing told it.
   */
  if (what === "__selection_set__" || what === "__selection_clear__" || what === "__viewport_focus__") {
    const items = Object.values(facts.canvas.items ?? {});
    const refs = Array.isArray(args.item_refs) ? (args.item_refs as unknown[]).map(String) : [];
    const one = typeof args.item_ref === "string" ? [args.item_ref] : [];
    const wanted = [...refs, ...one];
    const found = wanted
      .map((ref) => items.find((i) => i.id === ref || (i.title ?? "").toLowerCase().startsWith(ref.toLowerCase())))
      .filter((i): i is NonNullable<typeof i> => i !== undefined);
    if (what === "__selection_clear__") {
      facts.host.select([]);
      return { ok: true, answer: "selection cleared" };
    }
    const missing = wanted.length - found.length;
    if (found.length === 0) {
      return { ok: false, error: `nothing here matches ${wanted.map((w) => JSON.stringify(w)).join(", ") || "that"}` };
    }
    if (what === "__selection_set__") facts.host.select(found.map((i) => i.id));
    facts.host.reveal(found.map((i) => i.id));
    const named = found.map((i) => `${i.title ?? "untitled"} [${i.id}]`).join("; ");
    return {
      ok: true,
      answer:
        (what === "__selection_set__" ? `selected ${named}` : `showing ${named}`) +
        (missing > 0 ? ` — ${missing} of what you named is not on this canvas` : ""),
    };
  }
  if (what === "__find_items__") {
    /* Answered from the facts the shell already handed over, in the
       projection's wording, so a search reads like the canvas does. */
    const query = String(args.query ?? args.text ?? "").toLowerCase().trim();
    const rows = snapshotItemsFor(facts.canvas, facts.selection ?? []).filter(
      (i) => query === "" || (i.title ?? "").toLowerCase().includes(query) || i.kind.toLowerCase().includes(query),
    );
    if (rows.length === 0) return { ok: true, answer: `nothing matches ${JSON.stringify(query)}` };
    return { ok: true, answer: canvasSnapshotText(rows, []) };
  }
  if (what === "__viewport_pan__") {
    /* `reveal` glides to ITEMS; there is no pan-by-delta on the host, and
       inventing one that scrolled a person's canvas by a guess is worse than
       saying so. Naming the thing that does work is what keeps the model from
       trying this again next turn. */
    return {
      ok: false,
      error: "panning by an amount is not carried here — name the items to look at instead and they will be shown",
    };
  }
  /* A sentinel is an internal token. If one ever reaches here it must not be
     handed to the model as though it were an explanation. */
  if (what) return { ok: false, error: `${name} is not carried by the browser voice dialog yet` };
  if (plans.length === 0) return { ok: false, error: `the model called ${name}, which this dialog does not wire` };

  const items = Object.values(facts.canvas.items ?? {});
  // Restore is the one verb that names something in the TRASH, which the
  // live list no longer holds.
  const trashItems = (facts.canvas.trash ?? []).map((t) => t.item);
  const resolve = (ref: string, pool: typeof items): (typeof items)[number] | null => {
    const byId = pool.find((i) => i.id === ref);
    if (byId) return byId;
    const byTitle = pool.filter((i) => (i.title ?? "").toLowerCase().startsWith(ref.toLowerCase()));
    return byTitle.length === 1 ? byTitle[0]! : null;
  };
  const ops: Operation[] = [];
  for (const plan of plans) {
    const op = { ...plan.op } as Record<string, unknown>;
    if (typeof op.ref === "string") {
      const ref = op.ref as string;
      const item =
        op.type === "item.restore" ? resolve(ref, trashItems) : resolve(ref, items);
      if (!item) return { ok: false, error: `no item matches "${ref}"` };
      // The planner speaks refs; each operation speaks its own field name.
      if (op.type === "thread.create" || op.type === "thread.setAnchor") {
        op.anchorItemId = item.id;
        // An anchored thread needs finite coordinates; the planner supplies
        // none. The item's own spot is where the pin goes.
        if (op.type === "thread.create" && (op.x === undefined || op.y === undefined)) {
          op.x = item.x;
          op.y = item.y;
        }
      } else {
        op.itemId = item.id;
      }
      delete op.ref;
      // A relative move is a delta the planner hands over with `by`; the wire
      // wants the absolute landing spot.
      if (op.type === "item.move" && op.by === true) {
        op.x = item.x + Number(op.x ?? 0);
        op.y = item.y + Number(op.y ?? 0);
        delete op.by;
      }
      // "Move it next to the checkout screen": a second referent, resolved
      // against this canvas and then handed to core's `besideBox` — the same
      // function the standing harness calls, because two spellings of "next
      // to" would put the item in two different places depending on which
      // surface heard the sentence.
      if (op.type === "item.move" && typeof op.besideRef === "string") {
        const anchorRef = op.besideRef;
        const anchor = resolve(anchorRef, items);
        if (!anchor) return { ok: false, error: `no item matches "${anchorRef}"` };
        const spot = besideBox(
          { width: item.width, height: item.height },
          { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height },
          isBesideSide(op.side) ? op.side : "right",
        );
        op.x = spot.x;
        op.y = spot.y;
        delete op.besideRef;
        delete op.side;
      }
      // "switch to the first/last/filename" resolves against the item's real
      // version stack — the wire wants a version id, never a ref.
      if (op.type === "item.setCurrentVersion") {
        const vRef = String(op.versionRef ?? "");
        const versions = item.versions ?? [];
        const byId = versions.find((v) => v.id === vRef);
        const byFile = byId ? null : versions.find((v) => v.filename === vRef || v.filename.startsWith(vRef));
        const versionId =
          vRef === "first" ? versions[0]?.id
          : vRef === "last" ? versions[versions.length - 1]?.id
          : byId?.id ?? byFile?.id;
        if (!versionId) return { ok: false, error: `no version matches "${vRef}" on "${item.title ?? ref}"` };
        op.versionId = versionId;
        delete op.versionRef;
      }
    }
    if (op.type === "item.add") {
      const body = String(op.content ?? op.text ?? "");
      const mime = String(op.mime ?? "text/markdown");
      // A drawing is an SVG file; a note is markdown. The mime says which.
      const filename = String(
        op.filename ??
          (mime === "image/svg+xml" ? "sketch.svg"
          : mime === "text/markdown" ? "note.md"
          : mime === "text/html" ? "index.html"
          : "note.txt"),
      );
      // The blob carries its declared type, so the daemon stores it under the
      // mime the op announces — an untyped blob uploads as octet-stream and
      // the renderer serves the wrong face.
      const { blobHash, size } = await facts.host.putBlob(new Blob([body], { type: mime }), filename);
      op.itemId = newItemId();
      op.version = { id: newVersionId(), blobHash, mimeType: mime, filename, size };
      delete op.content;
      delete op.text;
      delete op.mime;
      delete op.filename;
      // The wire wants geometry and a position, whatever the planner set:
      // a drawing carries its own box, a note takes the shared default size.
      const box = defaultSize(mime);
      op.width = Number(op.width ?? box.width);
      op.height = Number(op.height ?? box.height);
      op.placement = {
        x: Math.round(Number(op.x ?? 160)),
        y: Math.round(Number(op.y ?? 120)),
      };
      delete op.x;
      delete op.y;
      // A groups canvas refuses a bare item.add: the insertion has to be
      // named. Loose pile, auto — the same shape the shell's own creators
      // send when nothing is selected.
      if (facts.groupMode === "groups") {
        op.containerId = null;
        op.groupPlacement = "auto";
      }
    }
    if (op.type === "item.update") {
      // The planner speaks semantics; the wire speaks a patch. One spelling
      // of the conversion, here — the harness's applyPlan does the same act.
      op.patch = {
        ...(op.title !== undefined ? { title: String(op.title) } : {}),
        ...(op.description !== undefined ? { description: String(op.description) } : {}),
      };
      delete op.title;
      delete op.description;
    }
    if (op.type === "thread.reply" || op.type === "thread.create") {
      const body = String(op.body ?? "");
      /**
       * **A spoken request carries what it is about, the way a typed one
       * does.**
       *
       * The Chat composer attaches the selection to every message a person
       * sends, so an agent picking up "/redesign this" knows which item
       * "this" is. A comment the voice posted carried the words alone — so
       * the one path that HAS to delegate (generating a screen's contents is
       * not a canvas operation, it is work for an agent that can think) sent
       * its request with the subject stripped off.
       *
       * Absent rather than empty when nothing is picked: `items: []` says the
       * message is about no items in particular, which is a different claim
       * from not saying.
       */
      const attached = facts.selection ?? [];
      const comment = {
        id: newCommentId(),
        body,
        at: new Date().toISOString(),
        ...(attached.length > 0 ? { items: [...attached] } : {}),
        ...(from.record ? { record: true as const } : {}),
      };
      if (op.type === "thread.reply") {
        const threadId = String(op.threadId ?? mainThread(facts.canvas)?.id ?? "");
        if (!threadId) {
          // No main thread yet: birth it, the way the web app's own chat does.
          ops.push({
            type: "thread.create",
            threadId: newThreadId(),
            x: 80,
            y: 80,
            anchorItemId: null,
            main: true,
            comment,
          } as Operation);
          delete op.threadId;
          continue;
        }
        op.threadId = threadId;
      } else {
        op.threadId = newThreadId();
        if (op.anchorItemId === undefined) {
          op.x = 80;
          op.y = 80;
          op.anchorItemId = null;
        }
      }
      op.comment = comment;
      delete op.body;
      delete op.notify;
    }
    ops.push(op as Operation);
  }
  try {
    await facts.host.send(ops, newVersionId());
    return { ok: true, answer: ops.length === 1 ? `did one operation` : `did ${ops.length} operations` };
  } catch (err) {
    return { ok: false, error: String((err as Error).message ?? err) };
  }
}

/** Five level bars, painted imperatively from audio frames so a frame rate
 *  never becomes a re-render storm. Input bars are the mic; output bars are
 *  the model's voice. `onReady` hands the paint function out — a ref prop on
 *  a function component is not a thing in React 18. */
function Meter({ label, live, onReady }: { label: string; live: boolean; onReady?: (paint: (level: number) => void) => void }) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const paint = useCallback((level: number) => {
    const on = Math.round(level * 5);
    barsRef.current.forEach((bar, i) => {
      if (bar) bar.dataset.on = i < on ? "1" : "0";
    });
  }, []);
  useEffect(() => {
    onReady?.(paint);
  }, [onReady, paint]);
  return (
    <div className="talk-meter" aria-label={label} data-live={live ? "1" : "0"}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

/**
 * **One live session, wherever it is mounted** — the socket, the capture,
 * the playback, the captions and the meters. Both doors share it; the mic
 * overlay and the config dialog differ only in what chrome they put around
 * it. `autoStart`: the door was itself a press, so a stored key means the
 * session starts on open — one press, not two.
 */
function useTalkSession(facts: PanelFacts, autoStart = false) {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_SHELF) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_SHELF) ?? LIVE_MODEL);
  const [state, setState] = useState<SessionState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  /** Which voice answers. A ref as well as state because `start` reads it
   *  while building the setup frame, and a stale closure there would open the
   *  session on the voice you just changed away from. */
  const [voice, setVoiceState] = useState<string>(() => {
    const stored = localStorage.getItem(VOICE_SHELF);
    return isLiveVoice(stored) ? stored : "";
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const inPaintRef = useRef<(level: number) => void>(() => undefined);
  const outPaintRef = useRef<(level: number) => void>(() => undefined);
  const autoStartedRef = useRef(false);
  // The page's own meter maths: dB gating, attack, release, a held peak.
  // Raw PCM RMS would read 0..32767, which is how the first bars pegged.
  const inMeter = useRef(new LevelMeter(METER_COUNT));
  /* There is no out meter beside it: the reply's level is read from the
     playback itself (`Playback.level`), because what a listener wants the
     colour to follow is what the speaker is SAYING, and the chunks arrive
     long before they are spoken. */
  // The latest facts, read by the socket handlers: a handler closed over the
  // facts object from when start() ran would resolve tool calls against a
  // stale canvas (an item added earlier in the conversation would not exist).
  const factsRef = useRef(facts);
  factsRef.current = facts;
  // The capture's setup is abortable: a stop while the microphone permission
  // is still pending must not hand a live capture to an idle panel.
  const abortRef = useRef<AbortController | null>(null);

  /**
   * **Transcription arrives in PIECES, and the pieces are appended.**
   *
   * This used to replace the speaker's previous line, on the belief that the
   * provider sent growing partials ("read", "read the", "read the canvas").
   * It does not. `LiveServerContent` is documented as an *incremental* server
   * update, and the API carries a separate `interimInputTranscription` for
   * the low-latency field that IS re-sent as it grows — which is the tell:
   * a delta field and a partial field would not both exist if they meant the
   * same thing.
   *
   * So replacing kept only the LAST piece. On screen a whole answer read as
   * `Enceladus: you need on the canvas.` — the end of a sentence whose
   * beginning had been overwritten several times a second. Appending is both
   * the correct reading of the wire and the thing that was wanted from it:
   * the reply writes itself across the panel while it is being spoken.
   *
   * **A system line in between does not break the sentence.** Tool rows land
   * mid-turn, and treating them as a speaker change split one answer into
   * fragments around them, so the run being appended to is the last line of
   * actual SPEECH, wherever the tool rows fell.
   *
   * **Repeated system lines collapse.** Identical consecutive ones become one
   * row and a count rather than a column of the same sentence.
   */
  const say = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => foldLine(prev, who, text));
  }, []);

  /**
   * **The turn is over; the next piece starts a line.** Called on the
   * provider's own end-of-turn signals rather than guessed at from a pause,
   * because a pause mid-sentence is a person thinking, not a turn ending.
   */
  const seal = useCallback(() => {
    setLines((prev) => sealLines(prev));
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    abortRef.current?.abort();
    socketRef.current?.close();
    socketRef.current = null;
    // close(), not stopNow(): stopNow leaves the AudioContext behind, and a
    // browser only allows so many — repeated sessions used to leak one each.
    playbackRef.current?.close();
    inMeter.current.reset();
    inPaintRef.current(0);
    outPaintRef.current(0);
    setState("idle");
    // The once-guard is per SESSION, not per mount: StrictMode unmounts a
    // fresh mount in dev (start, stop, start), and the second mount must be
    // allowed to begin again — a guard that never resets is how the
    // auto-start silently became a dead panel on the dev server.
    autoStartedRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (!key.trim()) {
      setState("refused");
      say("system", "paste your Gemini API key first — it stays in this browser");
      return;
    }
    localStorage.setItem(KEY_SHELF, key.trim());
    localStorage.setItem(MODEL_SHELF, model.trim());
    say("system", "opening the live session…");
    const socket = new WebSocket(liveUrl(key.trim()));
    socketRef.current = socket;
    /**
     * The provider's own acknowledgement that it is ready for audio. An OPEN
     * socket is not that: the harness sent 192 of 208 frames before
     * `setupComplete` on a keyless run and 128 before acknowledgement on a real
     * key (isocan-xsh.8.5). A local, not React state — the capture callback
     * below closes over this scope, and state read from a closure is stale.
     */
    let providerReady = false;
    let gatedFrames = 0;
    const playback = new Playback();
    playbackRef.current = playback;

    socket.onopen = () => {
      // The session is handed the canvas it is standing on, in the one
      // wording the standing harness sends: ids are what a tool call echoes,
      // titles are what a person reads. The shell handed the module these
      // facts, so no store and no route were needed to know them.
      const snapshot = canvasSnapshotText(
        snapshotItemsFor(factsRef.current.canvas, factsRef.current.selection ?? []),
        Object.values(factsRef.current.canvas.threads ?? {}).map((t) => ({ id: t.id, comments: t.comments })),
      );
      const instructions = { source: "canvas", text: [commandsBrief(), snapshot].join("\n\n") };
      socket.send(JSON.stringify(liveSetup(model.trim(), instructions, undefined, voiceRef.current)));
    };
    socket.onclose = (event: CloseEvent) => {
      captureRef.current?.stop();
      captureRef.current = null;
      inPaintRef.current(0);
      outPaintRef.current(0);
      setState("idle");
      // The provider's own words, verbatim: an invalid key and a dead model
      // both close here, and a silent close is how a refusal reads as "nothing
      // happened".
      if (event.code !== 1000) {
        say("system", `provider closed: ${event.code}${event.reason ? ` — ${event.reason}` : ""}`);
      }
    };
    socket.onerror = () => {
      setState("refused");
      say("system", "the live socket refused the connection");
    };
    socket.onmessage = async (event: MessageEvent) => {
      const message = await decodeMessage(event.data);
      if (!message) return;
      if (message.error) {
        setState("refused");
        say("system", String((message.error as { message?: string })?.message ?? JSON.stringify(message.error)));
        return;
      }
      if (message.setupComplete) {
        providerReady = true;
        setState("live");
        say("system", "listening — talk, or press the mic to end");
        // Dropped rather than buffered: audio from before the provider was
        // ready is stale by the time it could use it, and the bead that filed
        // this asked for readiness handling without replaying stale effects.
        // Said, because a count nobody can see is the same silence.
        if (gatedFrames > 0) say("system", `${gatedFrames} microphone frame${gatedFrames === 1 ? "" : "s"} dropped before the provider was ready`);
      }      const content = message.serverContent as Record<string, unknown> | undefined;
      if (content) {
        if (content.inputTranscription && (content.inputTranscription as { text?: string }).text)
          say("you", (content.inputTranscription as { text: string }).text);
        if (content.outputTranscription && (content.outputTranscription as { text?: string }).text)
          say("model", (content.outputTranscription as { text: string }).text);
        // Barge-in: the person spoke over the model. Queued chunks must not
        // play on over the new turn — stopNow exists for exactly this.
        if (content.interrupted) {
          playbackRef.current?.stopNow();
          seal();
          say("system", "interrupted");
        }
        // The provider's own end-of-turn. `generationComplete` fires when the
        // model stops producing and `turnComplete` when the turn is closed;
        // either one means the next piece of transcription belongs to a new
        // line, and sealing twice is a no-op.
        if (content.turnComplete || content.generationComplete) seal();
        for (const part of (content.modelTurn as { parts?: unknown[] } | undefined)?.parts ?? []) {
          const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
          if (inline?.data) {
            // The model is multimodal: it can emit image parts beside the
            // audio. Only audio is this dialog's business — an image part fed
            // to the playback as PCM is exactly the noise the first build
            // made of it.
            const mime = String(inline.mimeType ?? "");
            if (mime.startsWith("audio/")) {
              const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
              const pcm = await fromBytes(bytes.buffer as ArrayBuffer);
              await playback.push(pcm);
            } else if (mime.startsWith("image/")) {
              say("system", "the model sent an image part — this dialog speaks and writes; the pen tool draws with strokes");
            }
          }
        }
      }
      if (message.toolCall && Array.isArray((message.toolCall as { functionCalls?: unknown }).functionCalls)) {
        const calls = (message.toolCall as { functionCalls: { id: string; name: string; args?: Record<string, unknown> }[] }).functionCalls;
        const responses: { id: string; name: string; response: Record<string, unknown> }[] = [];
        for (const call of calls) {
          const response = await runTool(call.name, call.args ?? {}, factsRef.current);
          say("system", `${call.name} → ${response.ok ? "done" : String(response.error)}`);
          /* A non-blocking tool's answer says WHEN it should reach the
             model; a blocking one's needs no scheduling and carries none. */
          const scheduling = toolScheduling(call.name);
          responses.push({
            id: call.id,
            name: call.name,
            response: scheduling ? { ...response, scheduling } : response,
          });
        }
        socket.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }
    };

    try {
      const abort = new AbortController();
      abortRef.current = abort;
      const captureHandle = await capture(
        (pcm) => {
          inMeter.current.feed(pcm);
          if (!providerReady) {
            gatedFrames++;
            return;
          }
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    data: btoa(String.fromCharCode(...new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))),
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              }),
            );
          }
        },
        undefined,
        undefined,
        abort.signal,
      );
      // Stopped while the permission was pending: the capture that just
      // resolved belongs to nobody, and a microphone left running under an
      // idle panel is the bug this closes.
      if (socketRef.current !== socket) {
        captureHandle.stop();
        return;
      }
      captureRef.current = captureHandle;
    } catch (err) {
      setState("refused");
      say("system", `microphone refused — ${String((err as Error).message ?? err)}`);
      socket.close();
    }
  }, [key, model, say, seal]);

  // The door was the press: with a key already in the shelf, open means
  // listen.
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && localStorage.getItem(KEY_SHELF)?.trim()) {
      autoStartedRef.current = true;
      void start();
    }
  }, [autoStart, start]);

  // The display half of the meters: one tick paints both bars from the
  // window each meter has accumulated, with the page's attack/release/peak
  // maths. The interval lives only while a session is live.
  useEffect(() => {
    if (state !== "live") return;
    const timer = setInterval(() => {
      inPaintRef.current(inMeter.current.tick().level);
      outPaintRef.current(playbackRef.current?.level() ?? 0);
    }, METER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => stop, [stop]);

  return {
    state,
    lines,
    key,
    model,
    setKey,
    setModel,
    start,
    stop,
    voice,
    /** Changing a voice RECONNECTS: `speechConfig` is a setup-time field and
     *  the provider documents no way to change one on a running socket. The
     *  transcript is React state and is untouched by the round trip, so the
     *  conversation reads as continuous even though the socket is not. */
    setVoice: (next: string) => {
      if (!isLiveVoice(next)) return;
      localStorage.setItem(VOICE_SHELF, next);
      setVoiceState(next);
      voiceRef.current = next;
    },
    registerInMeter: useCallback((paint: (level: number) => void) => (inPaintRef.current = paint), []),
    registerOutMeter: useCallback((paint: (level: number) => void) => (outPaintRef.current = paint), []),
  };
}

/** How many bars the wave draws. Odd, so there is a middle one for the arch
 *  to peak on. */
/**
 * **How many bars the wave is made of.**
 *
 * Eleven, at a fixed 3px each, drew a 63px stub at the left of a row three
 * times that wide — the bars had a fixed width while only their CONTAINER
 * stretched, so "the voice pattern is really small" was literally true. The
 * bars flex now, and the count is what sets density rather than extent: at a
 * composer's width this is a bar every few pixels, which reads as a
 * waveform, where a dozen fat ones read as a bar chart.
 */
const WAVE_BARS = 40;
/** Resting height of a bar, px — a flat line that is still visible. */
const WAVE_FLOOR = 3;
/** Fallback for the first frame, before the row has been measured. */
const WAVE_HEIGHT = 28;

/**
 * **One wave for the conversation, coloured by whoever is talking.**
 *
 * It replaces two five-bar meters standing side by side. Two were a VU meter
 * each and answered a question nobody had — the levels are never both high,
 * because the two of you take turns. One wave that CHANGES COLOUR answers the
 * question people actually have, which is whether it is hearing you or
 * answering you, and says it at a glance rather than by comparing two
 * columns.
 *
 * `--accent` is the app's own "this is yours" (it is the send button), and
 * `--away` is its PRESENCE colour — the other party who is here. So the
 * pairing is the app's vocabulary rather than two colours picked to look
 * different.
 *
 * ## Why it reads as a voice
 *
 * The bars are not a bar chart of the level. Each takes the level through an
 * arch — tall in the middle, short at the ends — and a slow per-bar wobble,
 * so a steady tone still moves and a loud one blooms from the centre. A
 * column of equal bars reads as a meter; this reads as a voice.
 *
 * It runs its own frame loop off the two refs rather than re-rendering: the
 * level changes many times a second and React has no business seeing it.
 */
function Wave({
  level,
  inLevel,
  outLevel,
}: {
  /**
   * **The glow's own smoothed level**, handed back by `VoiceBeam.onLevel`.
   *
   * The wave used to take the raw meter while the beam under it applied its
   * own attack, release and idle breathing, so the two read as two different
   * reactions to one voice — the bars snapping while the glow swelled behind
   * them. They are one instrument, so they move on one number, and the
   * number is the beam's because the beam is the thing being matched.
   */
  level: { current: number };
  /** Still the raw pair, and only for the COLOUR: who is speaking is a
   *  question about which meter is live, not about how bright the glow is. */
  inLevel: { current: number };
  outLevel: { current: number };
}) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const heard = inLevel.current;
      const spoken = outLevel.current;
      /* A small margin so a breath while it is answering does not flip the
         colour back and forth mid-sentence. */
      root.current?.setAttribute(
        "data-who",
        spoken > heard + 0.04 ? "voice" : heard > 0.02 ? "you" : "idle",
      );
      const loud = level.current;
      const t = performance.now() / 240;
      const height = root.current?.clientHeight ?? WAVE_HEIGHT;
      for (let i = 0; i < bars.current.length; i++) {
        const bar = bars.current[i];
        if (!bar) continue;
        /* Tall in the middle, short at the ends, so a voice blooms from the
           centre the way the glow under it does rather than filling the row
           like a level meter. */
        const arch = Math.sin(((i + 1) / (WAVE_BARS + 1)) * Math.PI);
        const wobble = 0.55 + 0.45 * Math.sin(t + i * 0.55);
        const reach = Math.max(0, height - WAVE_FLOOR);
        bar.style.height = `${(WAVE_FLOOR + loud * arch * wobble * reach).toFixed(1)}px`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level, inLevel, outLevel]);

  return (
    /* Decorative: whether it heard you is carried by the transcript, which a
       screen reader can actually read. A live region that fired on every
       frame would be unusable. */
    <div className="talk-wave" data-who="idle" ref={root} aria-hidden="true">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

/**
 * **What was said, with who said it** — the conversation's own record, in the
 * composer where there is room for one.
 *
 * The session has kept forty turns since it was written; until now two of
 * them were shown, as floating fragments with no attribution, so a glance
 * could not tell your words from the reply's and anything older was gone. The
 * history was there and the UI threw it away.
 *
 * ## Why it is not posted to the Chat
 *
 * The obvious idea is to put these in the thread above — it is right there,
 * it already scrolls, it already attributes. It is wrong: the Chat is the
 * CANVAS's conversation and reaches every collaborator and every agent
 * listening. Speech is ephemeral, half of it is partial ("read", "read the",
 * "read the canvas"), and a voice session would fill everybody else's thread
 * with a monologue nobody asked to hear. What a voice turn CAUSES lands as an
 * operation; what it said stays with the session and dies with it.
 *
 * ## The shape
 *
 * A name column and a line, oldest at the top, newest pinned at the bottom.
 * Names rather than colours because a person reading this is deciding "did it
 * hear me right", which is a question about WHOSE words those are. A run by
 * the same speaker drops the repeated name, so a back-and-forth reads as a
 * conversation rather than a form.
 *
 * System lines — the socket closing, a refusal — are neither speaker's and
 * are set apart rather than attributed to one.
 */
function Transcript({
  lines,
  you,
  them,
  expanded,
  onExpand,
}: {
  lines: Line[];
  you: string;
  /** What to call the other side — the voice they picked, so a transcript
   *  reads as a conversation with someone rather than with "Voice". */
  them: string;
  expanded: boolean;
  onExpand: () => void;
}) {
  const foot = useRef<HTMLDivElement | null>(null);
  const log = useRef<HTMLDivElement | null>(null);
  /* Follow the newest line. A transcript that has to be scrolled to see the
     thing that just arrived is a transcript nobody reads while talking. */
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  /**
   * **Is there anything to expand TO?**
   *
   * Two lines in a box that fits two lines had an Expand button that did
   * nothing when pressed — a control whose only effect is to disappoint. So
   * it appears when the log is actually taller than its box, and stays while
   * expanded so the state is always escapable.
   *
   * A ResizeObserver rather than a measurement on new lines alone: the Chat
   * panel is resizable, and a button that was right when the last line
   * arrived is wrong the moment somebody drags the panel taller.
   */
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lines, expanded]);

  if (lines.length === 0) return null;
  /* A first name in the column, the whole one to a screen reader and on
     hover. "Glow Tester" clipped to "Glow T…" at every turn, and a column of
     ellipses says less than a column of first names. */
  const shortYou = you.trim().split(/\s+/)[0] || you;
  return (
    <>
      <div className="talk-log-bar">
        {/* **Where this is going, said before it goes.** The session lands in
            the Chat as one block when it ends, and the Chat reaches every
            collaborator — so the person talking should know that while they
            are talking, not discover it afterwards. */}
        <span className="talk-log-dest">lands in Chat when you stop</span>
        {(expanded || overflowing) && (
          <button
            type="button"
            className="talk-log-act"
            onClick={onExpand}
            aria-expanded={expanded}
            title={expanded ? "Show fewer lines" : "Show more of the conversation"}
          >
            {expanded ? "Shrink" : "Expand"}
          </button>
        )}
      </div>
      <div
        ref={log}
        className={`talk-log${expanded ? " talk-log-tall" : ""}`}
        aria-live="polite"
        aria-label="What has been said"
      >
      {lines.map((line, i) => {
        if (line.who === "system") {
          return (
            <p key={i} className="talk-log-note">
              {line.text}
              {/* The count rides the row rather than repeating it. `×7` is
                  the whole difference between "it moved something" and "it
                  moved seven things", in the width of two characters. */}
              {line.count && line.count > 1 ? (
                <span className="talk-log-times"> ×{line.count}</span>
              ) : null}
            </p>
          );
        }
        const name = line.who === "you" ? shortYou : them;
        const full = line.who === "you" ? you : them;
        /* A run of one speaker says the name once: the second line of a
           sentence is not a new turn, and repeating the name makes it look
           like one. */
        const repeat = i > 0 && lines[i - 1]!.who === line.who;
        return (
          <p key={i} className={`talk-log-line talk-log-${line.who}`}>
            <span className="talk-log-who" aria-hidden={repeat || undefined} title={repeat ? undefined : full}>
              {repeat ? "" : name}
            </span>
            <span className="talk-log-text">
              {repeat ? "" : <span className="talk-log-sr">{full}: </span>}
              {line.text}
            </span>
          </p>
        );
      })}
        <div ref={foot} />
      </div>
    </>
  );
}

/**
 * **The key panel, in one spelling.** Both doors open it — the floating mic
 * and the composer's — and a second copy would be the one-string-two-spellings
 * bug wearing a dialog. It closes itself by calling back rather than owning
 * the flag, because which door opened it is the caller's business.
 */
function ConfigPop({
  session,
  onClose,
}: {
  session: ReturnType<typeof useTalkSession>;
  onClose: () => void;
}) {
  return (
      <div className="talk-pop" role="dialog" aria-label="Configure voice">
        <button type="button" className="talk-pop-close" onClick={() => onClose()} aria-label="Close">
          ×
        </button>
        <label className="talk-field">
          Gemini API key
          <input
            type="password"
            value={session.key}
            onChange={(e) => session.setKey(e.target.value)}
            placeholder="stored in this browser only"
            autoComplete="off"
          />
        </label>
        <label className="talk-field">
          Model
          <input value={session.model} onChange={(e) => session.setModel(e.target.value)} autoComplete="off" />
        </label>
        <p className="talk-note">Saved in this browser only — never on the canvas, never in the daemon.</p>
        <button
          type="button"
          className="talk-save"
          onClick={() => {
            localStorage.setItem(KEY_SHELF, session.key.trim());
            localStorage.setItem(MODEL_SHELF, session.model.trim());
            onClose();
            // Saving is the gesture: the session starts on the same press.
            void session.start();
          }}
          disabled={!session.key.trim()}
        >
          Save and start
        </button>
      </div>
  );
}

/** The ⌘K dialog is the CONFIGURATION surface: key, model, and a test
 *  listen with the full captions — open it when something needs changing. */
function ConfigDialog(facts: DialogFacts) {
  const session = useTalkSession(
    { canvasId: facts.canvasId, canvas: facts.canvas, host: facts.host, canEdit: facts.canEdit, groupMode: facts.groupMode },
    true,
  );
  return (
    <div className="talk-panel">
      <div className="talk-row">
        <button
          type="button"
          className={`talk-mic ${session.state === "live" ? "talk-mic-live" : ""}`}
          onClick={() => (session.state === "live" ? session.stop() : void session.start())}
          aria-label={session.state === "live" ? "Listening — press to end" : "Test listen"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
            />
          </svg>
        </button>
        <Meter label="You" live={session.state === "live"} onReady={session.registerInMeter} />
        <Meter label="Voice" live={session.state === "live"} onReady={session.registerOutMeter} />
        <span aria-live="polite" className="talk-state">
          {session.state}
        </span>
      </div>
      <label className="talk-field">
        Gemini API key
        <input
          type="password"
          value={session.key}
          onChange={(e) => session.setKey(e.target.value)}
          placeholder="stored in this browser only"
          autoComplete="off"
        />
      </label>
      <label className="talk-field">
        Model
        <input value={session.model} onChange={(e) => session.setModel(e.target.value)} autoComplete="off" />
      </label>
      {!facts.canEdit && <p>This canvas is read-only here, so the model can talk but not write.</p>}
      <ul className="talk-lines" aria-live="polite">
        {session.lines.map((line, i) => (
          <li key={i}>
            <strong>{line.who}:</strong> {line.text}
          </li>
        ))}
      </ul>
      <style>{`
        .talk-panel { display: grid; gap: 10px; }
        .talk-row { display: flex; align-items: center; gap: 10px; }
        .talk-mic {
          width: 44px; height: 44px; border-radius: 50%;
          display: grid; place-items: center; border: none;
          background: var(--ink); color: var(--card); cursor: pointer;
        }
        .talk-mic-live { animation: talk-pulse 1.6s ease-out infinite; }
        @keyframes talk-pulse {
          0% { box-shadow: 0 0 0 0 rgba(60, 140, 255, .45); }
          70% { box-shadow: 0 0 0 16px rgba(60, 140, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(60, 140, 255, 0); }
        }
        ${METER_CSS}
        .talk-field { display: grid; gap: 4px; font-size: 12px; color: var(--ink-muted); }
        .talk-lines { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px;
          max-height: 40vh; overflow: auto; font-size: 13px; }
      `}</style>
    </div>
  );
}

/**
 * **One stylesheet for every state this control has.**
 *
 * It used to live inside the idle branch's JSX, which meant none of it
 * rendered once a session started: the bar, its meters and its stop button
 * were unstyled exactly when they were on screen, and the beam's wrapper had
 * no width so a 294px row carried a 32px glow.
 */
const COMPOSER_CSS = `
  ${METER_CSS}
      .talk-composer-anchor { position: relative; display: flex; align-items: center; }
      /* **The key panel IS the row**, not a popover over it. As a popover it
         was 300px inside a 250px Chat panel and clipped whichever edge it was
         anchored to, and position:fixed did not even reach the corner it
         named, because the Chat panel's transform is the containing block. */
      .talk-pop {
        position: relative; width: 100%;
        background: var(--card); border: 1px solid var(--line);
        border-radius: 10px; padding: 14px; display: grid; gap: 8px;
      }
      .talk-pop-close {
        position: absolute; top: 8px; right: 8px; border: none; background: none;
        color: var(--ink-muted); font-size: 18px; cursor: pointer;
      }
      .talk-field { display: grid; gap: 4px; font-size: 12px; color: var(--ink-muted); }
      .talk-note { margin: 0; font-size: 12px; color: var(--ink-muted); }
      .talk-save { justify-self: start; }
      /* **28px and round.** The send button beside it measures 28 high and the
         form aligns its children to flex-END, so a 32px mic bottom-aligned
         with a 28px button and stood 4px proud of it — which is what looked
         crooked. Round rather than a rounded square because the mic starts a
         MODE and the square beside it submits; two squares read as two
         submits. Sized to sit with the composer's own buttons rather than to
         be noticed: a mic that outshouts Send is a mic people press by
         mistake. */
      /* A tag-qualified selector, so this ties with the shell's own
         .phone-face button on specificity and wins on source order — the
         module's stylesheet is injected after the app's. That leaves the
         44px touch target the phone rule is right to enforce, while keeping
         the shape a CIRCLE there too instead of a rounded square.

         Zero padding is the fix for the icon sitting off-centre: a rule
         further up gives panel buttons 1px 6px, which on a 28px border-box
         leaves a 16px content box for an 18px glyph — it overflows, and grid
         centring resolves the overflow to one side. Measured: 7px left, 3px
         right. */
      button.talk-composer-mic {
        width: 28px; height: 28px; border-radius: 50%; padding: 0;
        display: grid; place-items: center;
        border: 1px solid var(--line); background: var(--card);
        color: var(--ink); cursor: pointer; flex: none;
      }
      .talk-composer-mic:hover { background: var(--chip-hover); }
      .talk-composer-mic:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
      /* The bar stands where the message box was, so it takes the row's
         full width and the accent says a live session is the reason. */
      .talk-bar {
        display: flex; align-items: center; gap: 10px; width: 100%;
        padding: 6px 8px; border-radius: 10px;
        border: 1px solid var(--accent); background: var(--accent-wash);
      }
      /* The wave takes the room the two meters had, which is the point: one
         thing that says who is talking, rather than two that say how loud. */
      .talk-wave {
        display: flex; align-items: center; justify-content: space-between;
        gap: 2px; flex: 1; min-width: 0; height: 28px;
      }
      /* Flexing the bars is the fix for a wave that sat in the corner of its
         own row: they now divide the width they are given instead of taking
         3px each and leaving the rest empty. */
      .talk-wave span {
        flex: 1 1 0; min-width: 1px; height: 3px; border-radius: 2px;
        background: var(--line);
        /* No height transition: the frame loop already moves it, and a
           transition on top of that lags the voice by its own duration. */
        transition: background-color 180ms ease;
      }
      .talk-wave[data-who="you"] span { background: var(--accent); }
      .talk-wave[data-who="voice"] span { background: var(--away); }
      /* Sized down to sit with the meters: the picker is a setting you touch
     once, not the thing the bar is for. */
  .talk-voice select {
    max-width: 96px; border: 1px solid var(--line); border-radius: 6px;
    background: var(--card); color: var(--ink); font-size: 11px;
    padding: 2px 4px; cursor: pointer;
  }
  .talk-voice select:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  .talk-log-dest { flex: 1; font-size: 10px; color: var(--muted); font-style: italic; }
  .talk-log-bar { align-items: center; }
  .talk-bar-stop {
        width: 28px; height: 28px; border-radius: 50%; flex: none;
        display: grid; place-items: center; border: none;
        background: var(--accent); color: var(--accent-ink); cursor: pointer;
      }
      .talk-bar-stop:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  /* VoiceBeam wraps the bar in its own element, which is the thing the shell
     stretched — so it has to take the row it was given or the glow is drawn
     at the width of a button. */
  .talk-beam { flex: 1 1 100%; width: 100%; min-width: 0; display: block; }

  /* The transcript and the bar are one block, so the glow rises from under
     the whole conversation rather than from a strip inside it. */
  .talk-live-block {
    display: flex; flex-direction: column; gap: 6px; width: 100%;
    padding: 8px; border-radius: 10px;
    border: 1px solid var(--accent); background: var(--accent-wash);
  }
  /* Capped and scrolled: a conversation can run long and the composer is not
     allowed to eat the thread above it. dvh rather than a fixed height so a
     short window gives it less. */
  /* A row of actions above the words rather than beside them: the bar below
     is the LIVE controls (am I heard, stop), and mixing "keep this" in with
     "end this" is how a stop gets pressed by mistake. */
  .talk-log-bar { display: flex; justify-content: flex-end; gap: 4px; }
  .talk-log-act {
    border: none; background: none; cursor: pointer; padding: 2px 6px;
    border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--muted);
  }
  .talk-log-act:hover { background: var(--chip-hover); color: var(--ink); }
  .talk-log-act:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  .talk-log {
    max-height: min(180px, 28dvh); overflow-y: auto; overscroll-behavior: contain;
    display: flex; flex-direction: column; gap: 3px;
    font-size: 12px; line-height: 1.45;
  }
  /* Expanded takes most of the panel — the thread above is still there when
     you shrink it, and reading a long conversation is worth the room while
     you are in one. */
  .talk-log-tall { max-height: min(460px, 58dvh); }
  .talk-log-line { display: flex; gap: 8px; margin: 0; }
  /* One column, so names line up and the words start at the same place —
     which is what makes a run of turns scannable. */
  .talk-log-who {
    flex: none; width: 52px; text-align: right;
    color: var(--muted); font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .talk-log-text { min-width: 0; color: var(--ink); overflow-wrap: anywhere; }
  .talk-log-you .talk-log-text { color: var(--muted); }
  /* **Tool rows cost less room than speech.** They are what the session DID,
     and the sentence that caused them is what a person is reading — so they
     are set tighter and dimmer than a spoken line rather than given the same
     weight. A turn that moves seven things is now one row and a count, but
     even one row per DIFFERENT act adds up, and this is what keeps a burst of
     them from pushing the conversation off the top. */
  .talk-log-note {
    margin: 0; text-align: center; color: var(--muted);
    font-size: 11px; font-style: italic; line-height: 1.3;
    opacity: 0.8;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* The count reads as a tally, not as part of the sentence. */
  .talk-log-times { font-style: normal; font-weight: 600; opacity: 0.75; }
  /* The name is dropped from a repeated speaker's row for the eye, and kept
     for a screen reader, which has no column to see. */
  .talk-log-sr {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap;
  }
`;

/**
 * **The mic in the message composer, and the bar it becomes** (proposed:
 * `composer`).
 *
 * The floating mic below is the module's original door and stays: it works
 * with the Chat closed, which this cannot. But the gesture people arrive
 * expecting — every voice product they have used puts it here — is a mic
 * among the composer's own buttons that FLIPS the box into a conversation.
 *
 * The flip is the shell's to perform. This asks with `takeOver` when a
 * session goes live and gives the row back the moment it ends, including
 * when it ends by failing: a bar that stays after the socket drops is a
 * composer somebody has to reload to escape.
 *
 * It shares `useTalkSession` with the floating mic rather than opening a
 * second one, so the two doors are two ways into ONE conversation.
 */
function ComposerMic({ canvasId, canvas, host, groupMode, theme, selection, active, takeOver }: ComposerFacts) {
  const session = useTalkSession({ canvasId, canvas, canEdit: true, groupMode, host, selection });
  const [configOpen, setConfigOpen] = useState(false);
  const live = session.state === "live";

  /**
   * **The level the glow reads, kept out of React.**
   *
   * The meters already paint many times a second; this taps the same
   * callbacks into refs and hands the beam a getter it samples once per
   * frame. Setting state here instead would re-render the composer at the
   * frame rate, which is the mistake the package's own `level` docs warn
   * about.
   *
   * Whoever is talking drives it — your voice on the way in, the reply on
   * the way out — so the glow belongs to the conversation rather than to
   * the microphone.
   */
  const inLevel = useRef(0);
  const outLevel = useRef(0);
  const quietSince = useRef<number>(0);
  const [thinking, setThinking] = useState(false);
  const readLevel = useCallback(() => Math.max(inLevel.current, outLevel.current), []);
  /* What the BEAM settled on for this frame — its own attack, release and
     idle breathing applied to `readLevel`. The wave draws from this rather
     than from the raw meters so the bars and the glow are one movement; see
     `Wave`'s `level`. */
  const beamLevel = useRef(0);
  const takeBeamLevel = useCallback((level: number) => {
    beamLevel.current = level;
  }, []);

  /* The levels are tapped once, here, rather than by whatever happens to be
     drawing them — so the wave and the glow read the same numbers and a
     component can be swapped without the level going quiet. */
  useEffect(() => {
    session.registerInMeter((level) => (inLevel.current = level));
    session.registerOutMeter((level) => (outLevel.current = level));
  }, [session]);
  const [expanded, setExpanded] = useState(false);
  /* The picked voice's own name, or "Voice" when the provider's default is
     answering and there is no name to use. */
  const voiceName = isLiveVoice(session.voice) ? session.voice : "Voice";

  /**
   * **A finished session lands in the Chat as one block.**
   *
   * Not an item, and not a message per utterance. Per utterance would fill
   * everybody's thread with partials — speech arrives as "read", "read the",
   * "read the canvas" — and the Chat is the CANVAS's conversation, which
   * reaches every collaborator and every agent listening. One block per
   * session is the unit a person would actually want to scroll back to.
   *
   * It goes through the module's own `say` tool rather than a second
   * spelling: that path already births the main thread when there is none,
   * mints the comment id, and rides `host.send`, so the block is an ordinary
   * `thread.reply` with one undo and the speaker's name on it.
   *
   * Markdown carries the styling. A comment renderer of its own would need a
   * typed marker on `Comment`, and those are writer-owned by design — growing
   * core's comment vocabulary for one module is the thing the module rules
   * exist to stop. The heading says what this is in every surface that reads
   * markdown, including the CLI and an export.
   */
  const posted = useRef(false);
  const postSession = useCallback(async (lines: Line[]) => {
    const said = lines.filter((l) => l.who !== "system");
    if (said.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const body =
      `### 🎙 Voice session · ${stamp}\n\n` +
      said.map((l) => `**${l.who === "you" ? host.viewer.name : voiceName}:** ${l.text}`).join("\n\n");
    /* No selection attached: this is the RECORD of a conversation, not a
       request about whatever happened to be picked out when it ended. */
    /* `record`: the block is what WAS said, not a thing being asked of
       anybody. Without it the Chat wakes every parked agent and each one
       reads a person's half of a conversation with the voice as a request
       addressed to it — see `reasonFor` in core's `inbox.ts`. */
    await runTool("say", { text: body }, { canvasId, canvas, host, canEdit: true, groupMode, selection: [] }, { record: true });
  }, [host, canvasId, canvas, groupMode, voiceName]);

  /* Fires on the EDGE out of live, and once: a session that ends by failing
     posts what was said just as one ended by pressing stop, and a re-render
     while live must not post a second copy. */
  useEffect(() => {
    if (live) {
      posted.current = false;
      return;
    }
    if (posted.current) return;
    posted.current = true;
    void postSession(session.lines);
  }, [live, postSession, session.lines]);

  useEffect(() => {
    if (!live) {
      setThinking(false);
      return;
    }
    /* Silence between the two of you is the reply being thought about. A
       short hold keeps the beam from gathering in the gaps inside a
       sentence, which is the difference between "thinking" and "breathing". */
    const id = window.setInterval(() => {
      const quiet = Math.max(inLevel.current, outLevel.current) < 0.02;
      if (!quiet) {
        quietSince.current = 0;
        setThinking(false);
        return;
      }
      const now = performance.now();
      if (quietSince.current === 0) quietSince.current = now;
      else if (now - quietSince.current > 600) setThinking(true);
    }, 120);
    return () => window.clearInterval(id);
  }, [live]);


  /**
   * **Both states that are not "a button" want the row**, and asking for it
   * is what makes the key panel possible at all: as a popover it was 300px
   * inside a 250px panel and clipped whichever edge it was anchored to.
   * Flipping the composer is the same gesture the live bar makes, so there
   * is one mechanism here rather than a bar and a pop with different bugs.
   *
   * The shell is told what IS, never what was asked for: a start that fails
   * never reaches "live", so the row is never held for a session that is not
   * happening.
   */
  const wantsRow = live || configOpen;
  useEffect(() => {
    if (wantsRow !== active) takeOver(wantsRow);
  }, [wantsRow, active, takeOver]);

  if (configOpen && !live) {
    return (
      <>
        <ConfigPop session={session} onClose={() => setConfigOpen(false)} />
        <style>{COMPOSER_CSS}</style>
      </>
    );
  }

  if (live) {
    return (
      <>
        <VoiceBeam
        className="talk-beam"
        /* The bar IS the composer while a session runs, so the glow rises
           from the composer's own bottom edge — which is the effect this is,
           rather than a decoration sitting near it.

           default rather than pill. It was pill while the wrapped thing was a
           ~294x32 bar and that was right then — but pill carries scale 0.45,
           so the whole effect ran at 45% size, which is why it read as a
           faint wash once the transcript made the block tall. default is
           tuned for a chat input or card, which is now what this is. */
        type="default"
        /* Rise and spread up, resting presence DOWN. The ask was for it to
           bump around more, and what reads as movement is the CONTRAST
           between quiet and loud rather than the absolute size — a glow that
           idles bright has nowhere to go when a voice arrives. */
        reach={2.2}
        spread={1.4}
        idle={0.1}
        /* A getter, not a number: the level changes many times a second and
           the package samples this once per frame, so the glow is smooth
           without React re-rendering the row 60 times a second. */
        level={readLevel}
        /* Handed straight to a ref, never to state: this fires every frame. */
        onLevel={takeBeamLevel}
        /* Silence in a live session is the reply being thought about, which
           is exactly what the travelling beam is for. */
        processing={thinking}
        theme={theme}
        active
      >
        <div className="talk-live-block" role="group" aria-label="Voice conversation">
        <Transcript
          lines={session.lines}
          you={host.viewer.name}
          them={voiceName}
          expanded={expanded}
          onExpand={() => setExpanded((v) => !v)}
        />
        <div className="talk-bar">
          <Wave level={beamLevel} inLevel={inLevel} outLevel={outLevel} />
          {/* No toast here: the transcript above says the same thing with a
              name on it, and two copies of the last line is the one-string-
              two-spellings bug in pixels. The floating mic keeps its toast —
              it has no panel to hold a transcript. */}
          {/* **Who answers.** A native select, so it is one tap on a phone and
              arrow keys on a desktop, and thirty names do not need chrome of
              our own. Changing it reconnects — said in the label rather than
              discovered when the reply stops mid-word. */}
          <label className="talk-voice">
            <span className="talk-log-sr">Voice</span>
            <select
              value={session.voice}
              onChange={(e) => {
                session.setVoice(e.target.value);
                /* Reconnect on the new voice, keeping the transcript: the
                   provider takes speechConfig at setup and nowhere else. */
                session.stop();
                void session.start();
              }}
              title="Who answers — changing this reconnects the session"
            >
              {!isLiveVoice(session.voice) && <option value="">Default voice</option>}
              {LIVE_VOICES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="talk-bar-stop"
            onClick={() => session.stop()}
            aria-label="End the conversation"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </button>
        </div>
        </div>
        </VoiceBeam>
        <style>{COMPOSER_CSS}</style>
      </>
    );
  }

  return (
    <span className="talk-composer-anchor">
      <button
        type="button"
        className="talk-composer-mic"
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || !session.key.trim()) {
            setConfigOpen((v) => !v);
            return;
          }
          void session.start();
        }}
        title={`Talk · ${modifierClick()} to configure`}
        aria-label="Talk to the canvas"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>
      <style>{COMPOSER_CSS}</style>
    </span>
  );
}

/**
 * **The module's shell record: the composer's control, and the palette door.**
 *
 * There used to be a floating mic against the canvas's right edge as well,
 * and it is gone. It was the module's first door and the composer's control
 * outgrew it: the composer has the transcript, the names, the voice picker
 * and a full row for the glow to rise from, while the floating one could only
 * show two unattributed fragments over the canvas — which is what it looked
 * like, a button hanging next to the tool rail with captions colliding with
 * it.
 *
 * **The rail was the other candidate and is not available**: the rail and the
 * dock keep FIXED lists precisely so two modules cannot fight over them
 * (`ModuleOverlays`), so a mic there would be the shell's, not a module's.
 * It would also be the wrong shape — a voice bar wants horizontal room for
 * the transcript and the glow, and a rail is a narrow vertical strip.
 *
 * Nothing is unreachable with the Chat closed: ⌘K → "Configure voice" carries
 * its own test listen.
 */
export const talkWeb: WebModule<never, never, never, never, never, typeof ConfigDialog, never, typeof ComposerMic> = {
  core: voiceCore,
  actions: [
    {
      id: "talk",
      name: "Configure voice",
      hint: "your Gemini API key, the model, and a test listen",
      opens: "voice",
    },
  ],
  dialogs: [{ id: "voice", title: "Voice settings", component: ConfigDialog }],
  composer: [{ label: "Talk to the canvas", component: ComposerMic }],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default talkWeb;
