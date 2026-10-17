import { useEffect, useState } from "react";
import { getOplog } from "../lib/api.ts";
import { FloatingHandles, useFloatingBox } from "../lib/floatingbox.tsx";
import { visitDigest, type PriorVisit } from "../lib/visitdigest.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { morningDue, type Actor, type ActorJoins, type CanvasContents, type LogEntry } from "@isocan/core";
import { MorningBrief } from "./MorningBrief.tsx";
/** Show the prior-visit interval beside Chat, with live destinations and explicit missing-history states —
 * led by the night's brief when the person is back from their own `/goodnight` (`MorningBrief`, for the
 * note this arrival owes a review: `morning`, decided once by `reviewOwed`). */
export function VisitDigest({ prior, actor, morning, onItem, onThread }: { prior: PriorVisit | null; actor: Actor; morning: string | null; onItem: (id: string) => void; onThread: (id: string) => void }) {
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
    <MorningBrief prior={prior} actor={actor} noteId={morning} onItem={onItem} onThread={onThread} />
    <p>{digest.notice}</p>
    {digest.rows.map((row) => <div key={row.seq} data-change-seq={row.seq}>
      <span>{row.words}</span>
      {row.threadId ? <button onClick={() => onThread(row.threadId!)}>Open conversation</button> : row.itemIds.map((id) => <button key={id} onClick={() => onItem(id)}>{canvas.items[id]?.title}</button>)}
    </div>)}
  </details>;
}

/**
 * **"While you were away", on desktop** (proactive-agent phase 3, design §5)
 * — the phone face's digest, floated over the canvas and mounted only when
 * the arrival owes a morning review (`reviewOwed`): the person came back after
 * their own `/goodnight`. Without one the desktop stays as it was. Lazy, and in this file rather than
 * its own so the entry names one chunk for both faces: it pays for the
 * `lazy()` and the check that a goodnight note stands on the canvas.
 */
export function AwayPanel({ prior, actor, morning }: { prior: PriorVisit; actor: Actor; morning: string }) {
  const [open, setOpen] = useState(true);
  const float = useFloatingBox<HTMLElement>({ minWidth: 280, minHeight: 160 });
  if (!open) return null;
  const onItem = (id: string) => { useUiStore.getState().setSelection([id]); revealItem(id); };
  return <aside ref={float.ref} className="away-panel" style={float.style} data-away-panel aria-label="While you were away">
    <FloatingHandles box={float} />
    <button className="away-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
    <div className="float-scroll">
      <VisitDigest prior={prior} actor={actor} morning={morning} onItem={onItem} onThread={(id) => void import("../lib/conversation.ts").then((m) => m.openConversation(prior.canvasId, id))} />
    </div>
  </aside>;
}

/**
 * **The note whose review this arrival owes**, or null — decided once, by
 * `CanvasPage`, from the canvas and the clock as the visit arrived, and handed
 * to both faces. Never at a component's mount: the desktop panel mounted on a
 * re-render mid-night (`proactive-morning`, 15 Oct 2026) and the phone's
 * digest mounts again on every switch back to Chat, and each time the night
 * could be over while the person had not come back at all.
 */
export function reviewOwed(canvas: CanvasContents, prior: PriorVisit, now: number, joined?: ActorJoins): string | null {
  const due = prior.available ? morningDue(canvas, prior.actorId, prior.mark, now, joined) : null;
  return due && "noteId" in due ? due.noteId : null;
}
