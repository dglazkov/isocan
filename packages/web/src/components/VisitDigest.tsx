import { useEffect, useState } from "react";
import { getOplog } from "../lib/api.ts";
import { visitDigest, type PriorVisit } from "../lib/visitdigest.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import type { LogEntry } from "@isocan/core";
/** Show the prior-visit interval beside Chat, with live destinations and explicit missing-history states. */
export function VisitDigest({ prior, onItem, onThread }: { prior: PriorVisit | null; onItem: (id: string) => void; onThread: (id: string) => void }) {
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
    <summary>While you were away</summary><p>{digest.notice}</p>
    {digest.rows.map((row) => <div key={row.seq} data-change-seq={row.seq}>
      <span>{row.words}</span>
      {row.threadId ? <button onClick={() => onThread(row.threadId!)}>Open conversation</button> : row.itemIds.map((id) => <button key={id} onClick={() => onItem(id)}>{canvas.items[id]?.title}</button>)}
    </div>)}
  </details>;
}
