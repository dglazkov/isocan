import { useCallback, useEffect, useRef, useState } from "react";
import {
  mainThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  defaultSize,
  type CanvasContents,
  type DialogFacts,
  type Operation,
  type OverlayFacts,
  type WebHost,
  type WebModule,
} from "@isocan/core";
import { LevelMeter, Playback, capture, fromBytes, type Capture } from "@isocan/voice-agent/audio";
import { LIVE_MODEL, liveSetup, liveUrl, planForCall } from "@isocan/voice-agent/live";
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
  if (what === "__read_presence__") {
    return { ok: false, error: "presence is not carried by the browser voice dialog yet" };
  }
  if (what) return { ok: false, error: what };
  if (plans.length === 0) return { ok: false, error: `the model called ${name}, which this dialog does not wire` };

  const items = Object.values(facts.canvas.items ?? {}).map((i) => ({ id: i.id, title: i.title }));
  const ops: Operation[] = [];
  for (const plan of plans) {
    const op = { ...plan.op } as Record<string, unknown>;
    if (typeof op.ref === "string") {
      const ref = op.ref;
      const byId = items.find((i) => i.id === ref);
      const byTitle = byId ? [] : items.filter((i) => (i.title ?? "").toLowerCase().startsWith(ref.toLowerCase()));
      const item = byId ?? (byTitle.length === 1 ? byTitle[0] : null);
      if (!item) return { ok: false, error: `no item matches "${ref}"` };
      op.itemId = item.id;
      delete op.ref;
    }
    if (op.type === "item.add") {
      const body = String(op.content ?? op.text ?? "");
      const mime = String(op.mime ?? "text/markdown");
      // A drawing is an SVG file; a note is markdown. The mime says which.
      const filename = String(
        op.filename ?? (mime === "image/svg+xml" ? "sketch.svg" : mime === "text/markdown" ? "note.md" : "note.txt"),
      );
      const { blobHash, size } = await facts.host.putBlob(new Blob([body]), filename);
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

  const say = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => [...prev.slice(-40), { who, text }]);
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    playbackRef.current?.stopNow();
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
    const playback = new Playback();
    playbackRef.current = playback;

    socket.onopen = () => {
      socket.send(JSON.stringify(liveSetup(model.trim())));
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
        setState("live");
        say("system", "listening — talk, or press the mic to end");
      }      const content = message.serverContent as Record<string, unknown> | undefined;
      if (content) {
        if (content.inputTranscription && (content.inputTranscription as { text?: string }).text)
          say("you", (content.inputTranscription as { text: string }).text);
        if (content.outputTranscription && (content.outputTranscription as { text?: string }).text)
          say("model", (content.outputTranscription as { text: string }).text);
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
          const response = await runTool(call.name, call.args ?? {}, facts);
          say("system", `${call.name} → ${response.ok ? "done" : String(response.error)}`);
          responses.push({ id: call.id, name: call.name, response });
        }
        socket.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }
    };

    try {
      const captureHandle = await capture(
        (pcm) => {
          inMeter.current.feed(pcm);
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
        new AbortController().signal,
      );
      captureRef.current = captureHandle;
    } catch (err) {
      setState("refused");
      say("system", `microphone refused — ${String((err as Error).message ?? err)}`);
      socket.close();
    }
  }, [key, model, say, facts]);

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

/** The floating mic: one press starts (or stops), and the feedback — the
 *  pulse, the bars, the last words — floats with it and is gone when the
 *  turn is. The config panel only opens when there is no key yet; with a
 *  key, a press is the whole gesture. */
function MicOverlay({ canvasId, canvas, host }: OverlayFacts) {
  const session = useTalkSession({
    canvasId,
    canvas,
    canEdit: true,
    // OverlayFacts does not carry the canvas mode, so the overlay assumes
    // the groups default — canvases born today.
    groupMode: "groups",
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
      {configOpen && (
        <div className="talk-pop" role="dialog" aria-label="Configure voice">
          <button type="button" className="talk-pop-close" onClick={() => setConfigOpen(false)} aria-label="Close">
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
              setConfigOpen(false);
              // Saving is the gesture: the session starts on the same press.
              void session.start();
            }}
            disabled={!session.key.trim()}
          >
            Save and start
          </button>
        </div>
      )}
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
          position: fixed; right: 20px; bottom: 84px; z-index: 9999;
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

/** The module's shell record: the floating mic, the config dialog, the
 *  palette door. */
export const talkWeb: WebModule<never, never, never, never, typeof MicOverlay, typeof ConfigDialog> = {
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
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default talkWeb;
