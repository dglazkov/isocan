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
  type WebModule,
} from "@isocan/core";
import { Playback, capture, fromBytes, type Capture } from "@isocan/voice-agent/audio";
import { LIVE_MODEL, liveSetup, liveUrl, planForCall } from "@isocan/voice-agent/live";
import { voiceCore } from "./core.ts";

/**
 * **Talk to the canvas** — a dialog that holds a Gemini Live session from
 * THIS browser, with THIS person's key.
 *
 * The standing harness (Paul, 11 Sep) is the machine's voice: one enrolled
 * agent, one key on the machine, summoned through the rc. This is the
 * browser's voice: whoever opens the dialog talks as THEMSELVES — every op
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

/** The executor, exported for the test that drives it with a fake host: the
 *  planner is pure, so the whole tool-call half runs without a browser. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  facts: DialogFacts,
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
  const listed = { items, threads: [] };
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

/** The dialog itself: key, model, one Listen button, and the conversation. */
function VoiceDialog(facts: DialogFacts) {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_SHELF) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_SHELF) ?? LIVE_MODEL);
  const [state, setState] = useState<SessionState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const say = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => [...prev.slice(-40), { who, text }]);
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    playbackRef.current?.stopNow();
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
    const socket = new WebSocket(liveUrl(key.trim()));
    socketRef.current = socket;
    const playback = new Playback();
    playbackRef.current = playback;

    socket.onopen = () => {
      socket.send(JSON.stringify(liveSetup(model.trim())));
    };
    socket.onclose = () => {
      captureRef.current?.stop();
      captureRef.current = null;
      if (state !== "idle") setState("idle");
    };
    socket.onerror = () => setState("refused");
    socket.onmessage = async (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
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
            await playback.push(await fromBytes(bytes.buffer as ArrayBuffer));
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
    <div style={{ display: "grid", gap: "12px" }}>
      <label style={{ display: "grid", gap: "4px" }}>
        Gemini API key
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="stored in this browser only"
          autoComplete="off"
        />
      </label>
      <label style={{ display: "grid", gap: "4px" }}>
        Model
        <input value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" onClick={() => void listen()} disabled={state === "live"}>
          Listen
        </button>
        <button type="button" onClick={stop} disabled={state !== "live"}>
          End
        </button>
        <span aria-live="polite">{state === "live" ? "live" : state === "refused" ? "refused" : "idle"}</span>
      </div>
      {!facts.canEdit && <p>This canvas is read-only here, so the model can talk but not write.</p>}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "4px", maxHeight: "40vh", overflow: "auto" }}>
        {lines.map((line, i) => (
          <li key={i}>
            <strong>{line.who}:</strong> {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The module's shell record: one palette door, one dialog. */
export const talkWeb: WebModule<never, never, never, never, never, typeof VoiceDialog> = {
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
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default talkWeb;
