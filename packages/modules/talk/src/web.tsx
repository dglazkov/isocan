import { useCallback, useEffect, useRef, useState } from "react";
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
  type WebModule,
} from "@isocan/core";
import { LevelMeter, Playback, capture, fromBytes, type Capture } from "./audio.ts";
import { LIVE_MODEL, canvasSnapshotText, commandsBrief, liveSetup, liveUrl, planForCall, type SnapshotItem } from "./live.ts";
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

/** How many bars each meter shows; the shared paint divides the level into
 *  this many buckets. */
const METER_COUNT = 5;
/** How often the meters are re-painted, in milliseconds. The CSS transition
 *  between paints is what makes the bars glide rather than jump. */
const METER_INTERVAL_MS = 60;

type SessionState = "idle" | "live" | "refused";

/** One line of the conversation, for the caption the person reads. */
interface Line {
  who: "you" | "model" | "system";
  text: string;
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
export function snapshotItemsFor(canvas: CanvasContents): SnapshotItem[] {
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
): Promise<Record<string, unknown>> {
  const { plans, what } = planForCall(name, args);

  // The four read tools the planner marks, answered locally — the model
  // asked what the canvas holds, and the shell already told the dialog.
  if (what === "__read_canvas__") {
    const items = Object.values(facts.canvas.items ?? {});
    const threads = Object.values(facts.canvas.threads ?? {});
    return {
      ok: true,
      answer:
        `items: ${items.map((i) => `${i.title ?? "untitled"} [${i.id}]`).join("; ") || "none"}\n` +
        `threads: ${threads.map((t) => `${t.id} (${t.comments.length} comments)`).join("; ") || "none"}`,
    };
  }
  if (what === "__read_item__") {
    const ref = String(args.item_ref ?? "");
    const item = Object.values(facts.canvas.items ?? {}).find(
      (i) => i.id === ref || (i.title ?? "").toLowerCase().startsWith(ref.toLowerCase()),
    );
    return item
      ? { ok: true, answer: `${item.title ?? "untitled"} [${item.id}]` }
      : { ok: false, error: `no item matches "${ref}"` };
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
  if (what) return { ok: false, error: what };
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
      const comment = { id: newCommentId(), body, at: new Date().toISOString() };
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
  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const inPaintRef = useRef<(level: number) => void>(() => undefined);
  const outPaintRef = useRef<(level: number) => void>(() => undefined);
  const autoStartedRef = useRef(false);
  // The page's own meter maths: dB gating, attack, release, a held peak.
  // Raw PCM RMS would read 0..32767, which is how the first bars pegged.
  const inMeter = useRef(new LevelMeter(METER_COUNT));
  const outMeter = useRef(new LevelMeter(METER_COUNT));
  // The latest facts, read by the socket handlers: a handler closed over the
  // facts object from when start() ran would resolve tool calls against a
  // stale canvas (an item added earlier in the conversation would not exist).
  const factsRef = useRef(facts);
  factsRef.current = facts;
  // The capture's setup is abortable: a stop while the microphone permission
  // is still pending must not hand a live capture to an idle panel.
  const abortRef = useRef<AbortController | null>(null);

  const say = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => {
      // Transcriptions arrive as PARTIALS that grow within a turn ("read",
      // "read the", "read the canvas") — a person's line and the model's line
      // each REPLACE their previous one until the next speaker, so the
      // captions evolve instead of stacking. System lines still append.
      const rest = (who === "you" || who === "model") &&
          prev.length > 0 && prev[prev.length - 1]!.who === who
        ? prev.slice(0, -1)
        : prev;
      return [...rest.slice(-40), { who, text }];
    });
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
    outMeter.current.reset();
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
        snapshotItemsFor(factsRef.current.canvas),
        Object.values(factsRef.current.canvas.threads ?? {}).map((t) => ({ id: t.id, comments: t.comments })),
      );
      const instructions = { source: "canvas", text: [commandsBrief(), snapshot].join("\n\n") };
      socket.send(JSON.stringify(liveSetup(model.trim(), instructions)));
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
          outMeter.current.reset();
          say("system", "interrupted");
        }
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
              outMeter.current.feed(pcm);
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
          responses.push({ id: call.id, name: call.name, response });
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
  }, [key, model, say]);

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
      outPaintRef.current(outMeter.current.tick().level);
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
    registerInMeter: useCallback((paint: (level: number) => void) => (inPaintRef.current = paint), []),
    registerOutMeter: useCallback((paint: (level: number) => void) => (outPaintRef.current = paint), []),
  };
}

/** The two line-fragments that float by the mic while a turn is on — the
 *  person's last words and the model's. */
function CaptionToast({ lines }: { lines: Line[] }) {
  const said = lines.filter((l) => l.who !== "system").slice(-2);
  if (said.length === 0) return null;
  return (
    <div className="talk-toast" aria-live="polite">
      {said.map((line, i) => (
        <div key={i} className={line.who === "you" ? "talk-toast-you" : "talk-toast-model"}>
          {line.text}
        </div>
      ))}
    </div>
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
  placement = "float",
}: {
  session: ReturnType<typeof useTalkSession>;
  onClose: () => void;
  /** **Where it is being opened from**, because the two doors are in opposite
   *  corners. The floating mic's panel is pinned to the viewport; the
   *  composer's must sit above the composer, and a `fixed` panel does not
   *  even land there — the Chat panel's transform makes it the containing
   *  block, which is how the first draft of this ended up half off-screen. */
  placement?: "float" | "composer";
}) {
  return (
      <div className={`talk-pop talk-pop-${placement}`} role="dialog" aria-label="Configure voice">
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

/** The floating mic: one press starts (or stops), and the feedback — the
 *  pulse, the bars, the last words — floats with it and is gone when the
 *  turn is. The config panel only opens when there is no key yet; with a
 *  key, a press is the whole gesture. */
function MicOverlay({ canvasId, canvas, host, groupMode }: OverlayFacts) {
  const session = useTalkSession({
    canvasId,
    canvas,
    canEdit: true,
    groupMode,
    host,
  });
  const [configOpen, setConfigOpen] = useState(false);

  const onMic = (event: { ctrlKey?: boolean; metaKey?: boolean }) => {
    // Ctrl/⌘-click is the configuration door even when a key is stored —
    // changing the model must not require losing the key first.
    if (event.ctrlKey || event.metaKey) {
      setConfigOpen((v) => !v);
      return;
    }
    if (!session.key.trim()) {
      setConfigOpen((v) => !v);
      return;
    }
    if (session.state === "live") session.stop();
    else void session.start();
  };

  return (
    <>
      {session.state === "live" && (
        <div className="talk-live">
          <CaptionToast lines={session.lines} />
          <div className="talk-live-meters">
            <Meter label="You" live onReady={session.registerInMeter} />
            <Meter label="Voice" live onReady={session.registerOutMeter} />
          </div>
        </div>
      )}
      <button
        type="button"
        className={`talk-float ${session.state === "live" ? "talk-float-live" : ""}`}
        onClick={onMic}
        title="Talk · ctrl-click to configure"
        aria-label={session.state === "live" ? "End the conversation" : "Talk to the canvas"}
        aria-pressed={session.state === "live"}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>
      {configOpen && <ConfigPop session={session} onClose={() => setConfigOpen(false)} />}
      <style>{`
        .talk-float {
          position: fixed; right: 20px; bottom: 20px; z-index: 9999;
          width: 48px; height: 48px; border-radius: 50%;
          display: grid; place-items: center; border: 1px solid var(--line);
          background: var(--card); color: var(--ink);
          box-shadow: var(--shadow-pop); cursor: pointer;
        }
        .talk-float-live { background: var(--ink); color: var(--card);
          animation: talk-pulse 1.6s ease-out infinite; }
        @keyframes talk-pulse {
          0% { box-shadow: 0 0 0 0 rgba(60, 140, 255, .45); }
          70% { box-shadow: 0 0 0 16px rgba(60, 140, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(60, 140, 255, 0); }
        }
        .talk-live {
          position: fixed; right: 20px; bottom: 80px; z-index: 9999;
          display: grid; gap: 6px; justify-items: end; pointer-events: none;
        }
        .talk-live-meters { display: flex; gap: 10px; padding: 6px 10px;
          background: var(--card); border: 1px solid var(--line);
          border-radius: 12px; box-shadow: var(--shadow-pop); }
        .talk-toast { display: grid; gap: 4px; max-width: min(320px, calc(100vw - 40px)); }
        .talk-toast div { padding: 6px 10px; border-radius: 10px; font-size: 13px;
          background: var(--card); border: 1px solid var(--line);
          box-shadow: var(--shadow-pop); }
        .talk-toast-model { color: var(--ink); }
        .talk-toast-you { color: var(--ink-muted); }
        .talk-meter { display: flex; align-items: center; gap: 3px; height: 24px; }
        .talk-meter span {
          width: 4px; border-radius: 2px; background: var(--line);
          height: 4px; transition: height 80ms linear;
        }
        .talk-meter[data-live="1"] span[data-on="1"] { background: #3c8cff; height: 20px; }
        .talk-pop {
          z-index: 9999;
          background: var(--card); border: 1px solid var(--line);
          border-radius: 16px; box-shadow: var(--shadow-pop);
          padding: 14px; display: grid; gap: 8px;
        }
        .talk-pop-float {
          position: fixed; right: 20px; bottom: 84px;
          width: min(360px, calc(100vw - 40px));
          background: var(--card); border: 1px solid var(--line);
          border-radius: 16px; box-shadow: var(--shadow-pop);
          padding: 14px; display: grid; gap: 8px;
        }
        .talk-pop-close {
          position: absolute; top: 8px; right: 8px; border: none; background: none;
          color: var(--ink-muted); font-size: 18px; cursor: pointer;
        }
        .talk-field { display: grid; gap: 4px; font-size: 12px; color: var(--ink-muted); }
        .talk-note { margin: 0; font-size: 12px; color: var(--ink-muted); }
        .talk-save { justify-self: start; }
      `}</style>
    </>
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
        .talk-meter { display: flex; align-items: center; gap: 3px; height: 24px; }
        .talk-meter span {
          width: 4px; border-radius: 2px; background: var(--line);
          height: 4px; transition: height 80ms linear;
        }
        .talk-meter[data-live="1"] span[data-on="1"] { background: #3c8cff; height: 20px; }
        .talk-field { display: grid; gap: 4px; font-size: 12px; color: var(--ink-muted); }
        .talk-lines { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px;
          max-height: 40vh; overflow: auto; font-size: 13px; }
      `}</style>
    </div>
  );
}

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
function ComposerMic({ canvasId, canvas, host, groupMode, active, takeOver }: ComposerFacts) {
  const session = useTalkSession({ canvasId, canvas, canEdit: true, groupMode, host });
  const [configOpen, setConfigOpen] = useState(false);
  const live = session.state === "live";

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
    return <ConfigPop session={session} onClose={() => setConfigOpen(false)} placement="composer" />;
  }

  if (live) {
    return (
      <div className="talk-bar" role="group" aria-label="Voice conversation">
        <div className="talk-bar-meters">
          <Meter label="You" live onReady={session.registerInMeter} />
          <Meter label="Voice" live onReady={session.registerOutMeter} />
        </div>
        <CaptionToast lines={session.lines} />
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
        title="Talk · ctrl-click to configure"
        aria-label="Talk to the canvas"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>
      <style>{`
        /* The composer's panel is anchored to the control rather than to a
           corner of the viewport, so it opens where the press happened. */
        .talk-composer-anchor { position: relative; display: flex; align-items: center; }
        /* In the composer the panel IS the row — no popover, so nothing to
           clip. The floating mic's copy is still pinned to its corner. */
        .talk-pop-composer { position: static; width: 100%; box-shadow: none; }
        /* Sized to sit with the composer's own buttons rather than to be
           noticed: a mic that outshouts Send is a mic people press by
           mistake. */
        .talk-composer-mic {
          width: 32px; height: 32px; border-radius: 8px;
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
        .talk-bar-meters { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .talk-bar-stop {
          width: 28px; height: 28px; border-radius: 50%; flex: none;
          display: grid; place-items: center; border: none;
          background: var(--accent); color: var(--accent-ink); cursor: pointer;
        }
        .talk-bar-stop:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
      `}</style>
    </span>
  );
}

/** The module's shell record: the floating mic, the config dialog, the
 *  palette door. */
export const talkWeb: WebModule<never, never, never, never, typeof MicOverlay, typeof ConfigDialog, never, typeof ComposerMic> = {
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
  overlays: [{ region: "right", label: "Voice", component: MicOverlay }],
  composer: [{ label: "Talk to the canvas", component: ComposerMic }],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default talkWeb;
