import { useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor } from "@isocan/core";
import { MAX_COPY_VARIANTS } from "@isocan/core/copy-variants";
import { canEditNow } from "../lib/capability.ts";
import { landFlowVoice, previewFlowVoice, writeFlowVoices, type FlowVoices, type VoicePreview } from "../lib/flowvoice.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { Pane, Shell } from "./VersionCompare.tsx";
import "./version-compare.css";
import "./copy-compare.css";

/**
 * **Choose a voice…** — N voices for a whole wire flow, each previewed on
 * the flow's first two screens side by side, and one applied to every
 * screen (copy-edit phase 5, journey scene 5) — `isocan wire voice` on the
 * canvas.
 *
 * Opened from the item menu of any screen of a fleshed flow or of its
 * prototype, loaded on that click: it mounts its own root on
 * `document.body`, as *Compare the copy…* does, and draws each screen with
 * the Compare inspector's `Pane` in that panel's `Shell` — the same lone
 * `allow-scripts` frame, with what the voice changed marked inside it. Its
 * first column is the flow as it reads now. *Use this voice* lands the
 * chosen one on every screen as ONE op group with the prototype rebuilt once
 * (`lib/flowvoice.ts`), so one ⌘Z restores every word.
 */
interface ChooseVoiceRequest {
  canvasId: string;
  actor: Actor;
  /** A screen of the flow, or its prototype. */
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the panel, replacing one already open. */
export function openChooseVoice(request: ChooseVoiceRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.chooseVoice = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<ChooseVoice key={request.itemId} {...request} onClose={closeChooseVoice} />);
}

function closeChooseVoice(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

/** The tallest a screen is drawn whole; a longer page scrolls inside its frame. */
const DOC_MAX_H = 2400;

function ChooseVoice({ canvasId, actor, itemId, onClose }: ChooseVoiceRequest & { onClose: () => void }) {
  const title = useCanvasStore((s) => s.canvas?.items[itemId]?.title) ?? "this flow";
  const [n, setN] = useState("3");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "landing">("");
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<FlowVoices | null>(null);
  const [previews, setPreviews] = useState<VoicePreview[][] | null>(null);
  const count = Number(n);
  const valid = Number.isInteger(count) && count >= 1 && count <= MAX_COPY_VARIANTS;
  const canWrite = canEditNow();

  // Each frame reports its document's size, so every screen is drawn at one scale.
  const frames = useRef<Array<HTMLIFrameElement | null>>([]);
  const [sizes, setSizes] = useState<Record<number, [number, number]>>({});
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      const size = (e.data as { isocanDiffSize?: unknown } | null)?.isocanDiffSize;
      const at = frames.current.findIndex((f) => f?.contentWindow === e.source);
      if (at < 0 || !Array.isArray(size) || size.length !== 2 || !size.every((v) => typeof v === "number" && v > 0 && v < 100_000)) return;
      setSizes((was) => ({ ...was, [at]: [Math.round(size[0] as number), Math.round(size[1] as number)] }));
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const write = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy("writing");
    setError("");
    setPreviews(null);
    setSizes({});
    writeFlowVoices(canvasId, actor, itemId, { n: count, ...(brief.trim() ? { brief: brief.trim() } : {}) })
      .then(async (written) => {
        const drawn = await Promise.all(written.voices.map((v) => previewFlowVoice(written, v, itemId)));
        setVoices(written);
        setPreviews(drawn);
        setBusy("");
      })
      .catch((err: unknown) => {
        setBusy("");
        setError((err as Error)?.message ?? String(err));
      });
  };

  const choose = (k: number) => {
    if (!voices || busy) return;
    const voice = voices.voices[k]!;
    setBusy("landing");
    setError("");
    landFlowVoice(canvasId, actor, itemId, voices, voice)
      .then((done) => {
        onClose();
        flashNotice(`“${voice.stance}” on ${done.changed.length} screen${done.changed.length === 1 ? "" : "s"}${done.prototypes ? ", prototype rebuilt" : ""} — one undo takes it all back`, 6000);
      })
      .catch((err: unknown) => {
        setBusy("");
        setError((err as Error)?.message ?? String(err));
      });
  };

  const reported = Object.values(sizes);
  const docW = reported.length ? Math.max(...reported.map((s) => s[0]), 120) : 390;
  const docH = Math.min(DOC_MAX_H, reported.length ? Math.max(...reported.map((s) => s[1]), 80) : 760);
  const columns = voices && previews
    ? [
        { key: "now", stance: "Now", why: "The words the flow says now.", screens: previews[0]!.map((p) => ({ ...p, srcdoc: p.before })), k: -1, strings: 0 },
        ...voices.voices.map((v, k) => ({ key: `v${k}`, stance: v.stance, why: v.why, screens: previews[k]!.map((p) => ({ ...p, srcdoc: p.after })), k, strings: v.edits.length })),
      ]
    : [];
  let frameAt = 0;

  return (
    <Shell title={<>Choose a voice · <span className="vc-title">{title}</span></>} label="Choose a voice" onClose={onClose}>
      <form className="vc-bar cv-bar" onSubmit={write}>
        <label>
          Voices
          <input type="number" min={1} max={MAX_COPY_VARIANTS} value={n} onChange={(e) => setN(e.target.value)} disabled={!!busy} />
        </label>
        <label className="cv-brief">
          For what
          <input type="text" value={brief} placeholder="warmer, for first-time buyers" onChange={(e) => setBrief(e.target.value)} disabled={!!busy} />
        </label>
        <span className="spacer" />
        <span>{voices ? `${voices.voices.length} voice${voices.voices.length === 1 ? "" : "s"} for ${voices.screens.length} screen${voices.screens.length === 1 ? "" : "s"} by ${voices.by}` : ""}</span>
        {canWrite && (
          <button className="btn primary" type="submit" disabled={!valid || !!busy}>
            {busy === "writing" ? `Writing ${count} voice${count === 1 ? "" : "s"}…` : voices ? "Write again" : `Write ${valid ? count : ""} voice${count === 1 ? "" : "s"}`}
          </button>
        )}
      </form>
      {error && <p className="vc-empty cc-error" role="alert">{error}</p>}
      {!voices && !error && (
        <p className="vc-empty">{busy === "writing" ? "Writing the voices…" : "Voices for the whole flow's words, each previewed on its first two screens — one is applied to every screen, words only."}</p>
      )}
      {voices && previews && (
        <div className="cc-main">
          <div className="cc-panes cv-panes" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}>
            {columns.map((c) => (
              <div key={c.key} className="cc-col" data-voice-column={c.k < 0 ? "now" : String(c.k + 1)}>
                {c.screens.map((s) => {
                  const at = frameAt++;
                  return (
                    <Pane
                      key={s.itemId}
                      caption={`${c.stance} · ${s.title}`}
                      face={{ kind: "frame", srcdoc: s.srcdoc }}
                      docW={docW}
                      docH={docH}
                      frame={(f) => (frames.current[at] = f)}
                    />
                  );
                })}
                <p className="cc-why">{c.why}</p>
                {c.k >= 0 && (
                  <>
                    <p className="cc-why">{c.strings} string{c.strings === 1 ? "" : "s"} across the flow</p>
                    {canWrite && (
                      <button className="btn primary cc-all" disabled={!!busy} onClick={() => choose(c.k)} title={`Every screen of the flow says “${c.stance}”: one version each, the prototype rebuilt, one undo (isocan wire voice --pick)`}>
                        {busy === "landing" ? "Applying…" : "Use this voice"}
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
