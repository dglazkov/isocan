import { useCallback, useEffect, useRef, useState } from "react";
import {
  mainThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  type CanvasContents,
  type DialogFacts,
  type Operation,
  type OverlayFacts,
  type WebHost,
  type WebModule,
} from "@isocan/core";
import { Playback, capture, fromBytes, rmsOf, type Capture } from "@isocan/voice-agent/audio";
import { LIVE_MODEL, liveSetup, liveUrl, planForCall } from "@isocan/voice-agent/live";
import { voiceCore } from "./core.ts";

/**
 * **Talk to the canvas** — a Gemini Live session from THIS browser, with
 * THIS person's key, in two doors: the ⌘K dialog and a floating mic button
 * at the bottom of the screen. Both mount the same panel; the button is the
 * overlay slot, whose component anchors its own fixed bottom-right chrome.
 *
 * The standing harness (Paul, 11 Sep) is the machine's voice: one enrolled
 * agent, one key on the machine, summoned through the rc. This is the
 * browser's voice: whoever presses the mic talks as THEMSELVES — every op
 * the model asks for is sent through the shell's `host.send`, so it carries
 * the viewer's identity, undo and the oplog exactly like a click.
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
      const filename = String(op.filename ?? (mime === "text/markdown" ? "note.md" : "note.txt"));
      const { blobHash, size } = await facts.host.putBlob(new Blob([body]), filename);
      op.itemId = newItemId();
      op.version = { id: newVersionId(), blobHash, mimeType: mime, filename, size };
      delete op.content;
      delete op.text;
      delete op.mime;
      delete op.filename;
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

/** What the shared panel needs: the canvas, the host to write through, and
 *  whether writes are allowed. Both doors hand these — the dialog's facts
 *  carry more, the overlay's fewer, and the panel asks for nothing else. */
interface PanelFacts {
  canvasId: string;
  canvas: CanvasContents;
  host: WebHost;
  canEdit: boolean;
}

/** The panel both doors share: key, model, one mic button, the meters and
 *  the conversation. The microphone button pulses while live — the whole of
 *  the page's animation, kept to what a dialog-sized surface can use. */
function VoicePanel({ facts }: { facts: PanelFacts }) {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_SHELF) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_SHELF) ?? LIVE_MODEL);
  const [state, setState] = useState<SessionState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const inMeterRef = useRef<{ paint: (level: number) => void } | null>(null);
  const outMeterRef = useRef<{ paint: (level: number) => void } | null>(null);

  const say = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => [...prev.slice(-40), { who, text }]);
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    playbackRef.current?.stopNow();
    inMeterRef.current?.paint(0);
    outMeterRef.current?.paint(0);
    setState("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const listen = useCallback(async () => {
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
      inMeterRef.current?.paint(0);
      outMeterRef.current?.paint(0);
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
        say("system", "listening — talk, or press End");
      }
      const content = message.serverContent as Record<string, unknown> | undefined;
      if (content) {
        if (content.inputTranscription && (content.inputTranscription as { text?: string }).text)
          say("you", (content.inputTranscription as { text: string }).text);
        if (content.outputTranscription && (content.outputTranscription as { text?: string }).text)
          say("model", (content.outputTranscription as { text: string }).text);
        for (const part of (content.modelTurn as { parts?: unknown[] } | undefined)?.parts ?? []) {
          const inline = (part as { inlineData?: { data?: string } }).inlineData;
          if (inline?.data) {
            const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
            const pcm = await fromBytes(bytes.buffer as ArrayBuffer);
            outMeterRef.current?.paint(rmsOf(pcm));
            await playback.push(pcm);
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
          inMeterRef.current?.paint(rmsOf(pcm));
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

  return (
    <div className="talk-panel">
      <div className="talk-row">
        <button
          type="button"
          className={`talk-mic ${state === "live" ? "talk-mic-live" : ""}`}
          onClick={() => void listen()}
          disabled={state === "live"}
          aria-label={state === "live" ? "Listening — press End to stop" : "Listen"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
            />
          </svg>
        </button>
        <Meter label="You" live={state === "live"} onReady={(paint) => (inMeterRef.current = { paint })} />
        <Meter label="Voice" live={state === "live"} onReady={(paint) => (outMeterRef.current = { paint })} />
        <button type="button" onClick={stop} disabled={state !== "live"}>
          End
        </button>
        <span aria-live="polite" className="talk-state">
          {state}
        </span>
      </div>
      <label className="talk-field">
        Gemini API key
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="stored in this browser only"
          autoComplete="off"
        />
      </label>
      <label className="talk-field">
        Model
        <input value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
      </label>
      {!facts.canEdit && <p>This canvas is read-only here, so the model can talk but not write.</p>}
      <ul className="talk-lines" aria-live="polite">
        {lines.map((line, i) => (
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

/** The ⌘K dialog's mount: the panel, with the shell's facts. */
function VoiceDialog(facts: DialogFacts) {
  return <VoicePanel facts={{ canvasId: facts.canvasId, canvas: facts.canvas, host: facts.host, canEdit: facts.canEdit }} />;
}

/** The overlay: a floating mic button at the bottom of the screen that opens
 *  the panel in a popover of its own. The overlay slot's container sits
 *  mid-edge; this component anchors itself bottom-right with `fixed`, which
 *  is the "little icon near the bottom" the slot does not own. */
function MicOverlay({ canvasId, canvas, host }: OverlayFacts) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="talk-float"
        onClick={() => setOpen((v) => !v)}
        aria-label="Talk to the canvas"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>
      {open && (
        <div className="talk-pop" role="dialog" aria-label="Talk to the canvas">
          <button type="button" className="talk-pop-close" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
          <VoicePanel
            facts={{
              canvasId,
              canvas,
              canEdit: true,
              host,
            }}
          />
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
      `}</style>
    </>
  );
}

/** The module's shell record: one palette door and one dialog, plus the
 *  floating mic. */
export const talkWeb: WebModule<never, never, never, never, typeof MicOverlay, typeof VoiceDialog> = {
  core: voiceCore,
  actions: [
    {
      id: "talk",
      name: "Talk to the canvas",
      hint: "a Gemini Live session in this browser, with your own key",
      opens: "voice",
    },
  ],
  dialogs: [{ id: "voice", title: "Talk to the canvas", component: VoiceDialog }],
  overlays: [{ region: "right", label: "Voice", component: MicOverlay }],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default talkWeb;
