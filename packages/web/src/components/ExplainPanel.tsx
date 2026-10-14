import { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor, ExplainDepth, ExplainLine } from "@isocan/core";
import { EXPLAIN_DEPTHS, TEXT_FILENAME, TEXT_MIME, critiqueAsk, explainSections, explainStory, newItemId, newVersionId, rationaleSpot, rationaleText, textLookProperties } from "@isocan/core";
import { canEditNow } from "../lib/capability.ts";
import { postToMain } from "../lib/mainthread.ts";
import { uploadOrStageTextBlob } from "../lib/upload.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import "./explain.css";

/**
 * **Explain this item** (proactive-agent phase 4, design §6) — a panel beside
 * the live canvas, never a mode: the canvas stays where it was, the selection
 * stays, and Escape (or ✕) closes it. Opened from the item menu and ⌘K, and
 * loaded on that click: it mounts its own root on `document.body`, so the
 * entry chunk pays for a menu row, a palette entry and a lazy import.
 *
 * Everything it says is core's (`explainStory`, `explainSections`) — the same
 * words `isocan explain` prints — drawn live from the canvas store, so a
 * critique that arrives while it is open appears in it. The depth switch
 * (Plain, Designer, Deep dive) only changes the register; it is remembered
 * per viewer.
 *
 * **It writes nothing** unless the person presses one of its two buttons:
 * **Critique**, an ordinary summons to the canvas's lead agent in the Chat
 * (`critiqueAsk`), whose answer and proposal arrive through the CLI; and
 * **Copy as rationale**, the explanation as a note beside the item. When
 * nothing can answer a critique, the button stays off and the panel says why.
 */
interface ExplainRequest {
  canvasId: string;
  actor: Actor;
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/** Open the panel for one item — the menu's and the palette's door. */
export function openExplain(request: ExplainRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.explainHost = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<ExplainPanel key={request.itemId} {...request} onClose={closeExplain} />);
}

function closeExplain(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

const DEPTH_KEY = "isocan.explain.depth";
const DEPTH_LABEL: Record<ExplainDepth, string> = { plain: "Plain", designer: "Designer", deep: "Deep dive" };

function storedDepth(): ExplainDepth {
  try {
    const d = localStorage.getItem(DEPTH_KEY) as ExplainDepth | null;
    return d && EXPLAIN_DEPTHS.includes(d) ? d : "plain";
  } catch {
    return "plain";
  }
}

function ExplainPanel({ canvasId, actor, itemId, onClose }: ExplainRequest & { onClose: () => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const [depth, setDepth] = useState<ExplainDepth>(storedDepth);
  const [lead, setLead] = useState<{ lead: Actor | null; cannot: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const story = useMemo(() => (canvas ? explainStory(canvas, itemId) : null), [canvas, itemId]);
  const sections = story && !("refused" in story) ? explainSections(story, depth) : [];
  const canEdit = canEditNow();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A menu, the launcher or a dialog over it takes its own Escape first.
      if (e.key !== "Escape" || document.querySelector(".palette, .context-menu, [aria-modal=true]")) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Who would answer a critique, read once: the night watch's own reading of the lead.
  useEffect(() => {
    let live = true;
    void import("../lib/goodnight.ts")
      .then((m) => m.goodnightLead(canvasId, actor.id))
      .then((found) => live && setLead({ lead: found.lead, cannot: found.cannot?.replace(" to work overnight", "") ?? null }))
      .catch(() => live && setLead({ lead: null, cannot: "the canvas's agents could not be read" }));
    return () => { live = false; };
  }, [canvasId, actor.id]);

  const pick = (d: ExplainDepth) => {
    setDepth(d);
    try { localStorage.setItem(DEPTH_KEY, d); } catch { /* a per-viewer convenience */ }
  };

  if (!story || "refused" in story) {
    return <aside className="explain-panel" data-explain-panel aria-label="Explain">
      <button className="explain-close" aria-label="Close" onClick={onClose}>✕</button>
      <p className="explain-empty">{story ? story.refused : "The canvas is not loaded."}</p>
    </aside>;
  }

  const critique = async () => {
    if (!lead?.lead) return;
    setBusy(true);
    const sent = await postToMain(canvasId, actor, critiqueAsk(lead.lead, { id: story.itemId, title: story.title }), [story.itemId]).catch((e: Error) => ({ status: "refused" as const, message: e.message }));
    setBusy(false);
    if (sent.status === "refused") setNotice(sent.message ?? "the Chat refused the message");
    else flashNotice(`Asked ${lead.lead.name} for a critique`);
  };

  const copyRationale = async () => {
    const item = useCanvasStore.getState().canvas?.items[story.itemId];
    if (!item) return;
    setBusy(true);
    try {
      const text = rationaleText(story, depth, Date.now());
      const spot = rationaleSpot(useCanvasStore.getState().canvas!, item, text);
      const { upload, stagedBlob } = await uploadOrStageTextBlob(canvasId, text, TEXT_MIME, TEXT_FILENAME);
      await sendEchoed(
        canvasId,
        actor,
        {
          type: "item.add",
          itemId: newItemId(),
          version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: TEXT_MIME, filename: TEXT_FILENAME, size: upload.size },
          width: spot.width,
          height: spot.height,
          placement: { x: spot.x, y: spot.y, chosen: true },
          title: `Why “${story.title || "Untitled"}” looks like this`,
          properties: textLookProperties({ style: "body", face: "sans", paper: null, colour: null, font: null }),
        },
        undefined,
        undefined,
        stagedBlob,
      );
      flashNotice("The rationale is a note beside it");
    } catch (e) {
      setNotice(`The rationale was not written: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const link = (line: ExplainLine) => <>
    {line.compare && <> <button className="explain-link" data-explain-compare onClick={() => void import("./VersionCompare.tsx").then((m) => m.openCompare({ canvasId, actor, itemId: line.compare!.itemId, from: line.compare!.from, to: line.compare!.to }))}>Compare</button></>}
    {line.threadId && <> <button className="explain-link" onClick={() => void import("../lib/conversation.ts").then((m) => m.openConversation(canvasId, line.threadId!))}>Said where</button></>}
    {line.trash
      ? <> <button className="explain-link" data-explain-trash onClick={() => useUiStore.getState().setTrashOpen(true)}>In the trash</button></>
      : line.itemId && <> <button className="explain-link" onClick={() => revealItem(line.itemId!)}>Show</button></>}
  </>;

  const showCritique = !story.critique && !story.asked;
  return <aside className="explain-panel" data-explain-panel={story.itemId} aria-label={`Explain “${story.title}”`}>
    <button className="explain-close" aria-label="Close" onClick={onClose}>✕</button>
    <h3>Explain “{story.title}”</h3>
    <div className="explain-depth" role="group" aria-label="Depth">
      {EXPLAIN_DEPTHS.map((d) => <button key={d} className={`btn secondary${d === depth ? " active" : ""}`} aria-pressed={d === depth} data-explain-depth={d} onClick={() => pick(d)}>{DEPTH_LABEL[d]}</button>)}
    </div>
    {sections.map((s) => <section key={s.key} data-explain-section={s.key}>
      <h4>{s.heading}</h4>
      <ul className="explain-list">
        {s.lines.map((line, i) => <li key={i}>{line.text}{link(line)}</li>)}
      </ul>
    </section>)}
    {canEdit && <footer className="explain-acts">
      {showCritique && <button className="btn secondary" data-explain-critique disabled={busy || !lead?.lead || Boolean(lead.cannot)} onClick={() => void critique()}>Critique</button>}
      <button className="btn secondary" data-explain-rationale disabled={busy} onClick={() => void copyRationale()}>Copy as rationale</button>
    </footer>}
    {canEdit && showCritique && lead?.cannot && <p className="explain-cannot" data-explain-cannot>No critique: {lead.cannot}. The history above stands without one.</p>}
  </aside>;
}
