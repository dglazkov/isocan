import { useEffect, useState } from "react";
import { getOplog } from "../lib/api.ts";
import { visitDigest, type PriorVisit } from "../lib/visitdigest.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { morningDue, type Actor, type LogEntry } from "@isocan/core";
import { MorningBrief } from "./MorningBrief.tsx";
/** Show the prior-visit interval beside Chat, with live destinations and explicit missing-history states —
 * led by the night's brief when the person is back from their own `/goodnight` (`MorningBrief`). */
export function VisitDigest({ prior, actor, onItem, onThread }: { prior: PriorVisit | null; actor: Actor; onItem: (id: string) => void; onThread: (id: string) => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const [history, setHistory] = useState<LogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setHistory(null); setFailed(false);
    if (!prior?.available || !prior.mark || prior.mark.seq >= prior.head) return;
    let live = true;
    const controller = new AbortController();
    void getOplog(prior.canvasId, prior.mark.seq, AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])).then((rows) => { if (live) setHistory(rows); }, () => { if (live) setFailed(true); });
    return () => { live = false; controller.abort(); };
  }, [prior]);
  if (!prior || !canvas) return <div className="phone-digest">Checking your previous visit…</div>;
  if (failed) return <div className="phone-digest">History from your absence is unavailable.</div>;
  if (prior.available && prior.mark && prior.mark.seq < prior.head && !history) return <div className="phone-digest">Reading changes since your last visit…</div>;
  const digest = visitDigest(prior, canvas, history ?? []);
  return <details className="phone-digest" open>
    <summary>While you were away</summary>
    <MorningBrief prior={prior} actor={actor} onItem={onItem} onThread={onThread} />
    <p>{digest.notice}</p>
    {digest.rows.map((row) => <div key={row.seq} data-change-seq={row.seq}>
      <span>{row.words}</span>
      {row.threadId ? <button onClick={() => onThread(row.threadId!)}>Open conversation</button> : row.itemIds.map((id) => <button key={id} onClick={() => onItem(id)}>{canvas.items[id]?.title}</button>)}
    </div>)}
  </details>;
}

/**
 * **"While you were away", on desktop** (proactive-agent phase 3, design §5)
 * — the phone face's digest, floated over the canvas and shown only when a
 * morning review is due: the person comes back after their own `/goodnight`.
 * Without one the desktop stays as it was. Lazy, and in this file rather than
 * its own so the entry names one chunk for both faces: it pays for the
 * `lazy()` and the check that a goodnight note stands on the canvas.
 */
export function AwayPanel({ prior, actor }: { prior: PriorVisit; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const joined = useCanvasStore((s) => s.actorJoins) ?? undefined;
  const [due] = useState(() => Boolean(canvas && prior.available && "noteId" in morningDue(canvas, prior.actorId, prior.mark, Date.now(), joined)));
  const [open, setOpen] = useState(true);
  if (!due || !open) return null;
  const onItem = (id: string) => { useUiStore.getState().setSelection([id]); revealItem(id); };
  return <aside className="away-panel" data-away-panel aria-label="While you were away">
    <button className="away-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
    <VisitDigest prior={prior} actor={actor} onItem={onItem} onThread={(id) => void import("../lib/conversation.ts").then((m) => m.openConversation(prior.canvasId, id))} />
  </aside>;
}
