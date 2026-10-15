import { useEffect, useRef } from "react";
import { HANDOFF_REVIEWED_PROP, nightReview, type Actor, type MorningProposal } from "@isocan/core";
import type { PriorVisit } from "../lib/visitdigest.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import "./morning.css";

const STATE: Record<MorningProposal["state"], string> = { sure: "Sure", hunch: "Hunch", promised: "Still promised", failed: "Did not work" };

/**
 * **The morning review** (proactive-agent phase 3, design §5) — the top of the
 * "While you were away" digest, on the phone and on desktop.
 *
 * Due only after the person's own `/goodnight`, when the visit's prior seen
 * mark is older than the note's ready-by (`morningDue`). The note is decided
 * once per arrival, by `CanvasPage` (`reviewOwed`), and arrives here as
 * `noteId` — never decided at this component's mount, which the phone repeats
 * on every switch back to Chat. It is drawn live from the canvas
 * (`nightReview`), so a Keep or a Delete shows here at once. Seeing it
 * closes the note: one `handoffReviewed` write, by the person, so it stops
 * holding other people's goodnights off the items it named.
 */
export function MorningBrief({ prior, actor, noteId, onItem, onThread }: { prior: PriorVisit; actor: Actor; noteId: string | null; onItem: (id: string) => void; onThread: (id: string) => void }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const joined = useCanvasStore((s) => s.actorJoins) ?? undefined;
  const review = canvas && noteId ? nightReview(canvas, noteId, Date.now(), joined) : null;
  const closing = review && !review.reviewed ? review.noteId : null;
  // Once per note: the store re-renders before the write echoes back.
  const closed = useRef<string | null>(null);
  useEffect(() => {
    if (!closing || closed.current === closing) return;
    closed.current = closing;
    void sendEchoed(prior.canvasId, actor, { type: "item.update", itemId: closing, patch: { properties: { [HANDOFF_REVIEWED_PROP]: new Date().toISOString() } } });
  }, [closing, prior.canvasId, actor]);
  if (!review) return null;
  const lead = review.lead?.name ?? "The lead";
  return <section className="morning" data-morning={review.noteId} aria-label="The night's brief">
    <h3>{lead}&rsquo;s brief</h3>
    {review.headline && <p className="morning-headline" data-morning-headline>{review.headline}</p>}
    {review.brief && <p className="morning-said" data-morning-brief>
      {review.brief.body} <button className="morning-link" onClick={() => onThread(review.brief!.threadId)}>In the Chat</button>
    </p>}
    {review.proposals.length > 0 && <ol className="morning-list">
      {review.proposals.map((p) => <li key={p.itemId} data-morning-proposal={p.state}>
        <button className="morning-link" onClick={() => onItem(p.itemId)}>{p.title}</button>
        {" "}<span className="morning-state">{STATE[p.state]}</span>
        {p.why && <p>{p.why}</p>}
      </li>)}
    </ol>}
    {review.left.length > 0 && <>
      <h4>Left alone</h4>
      <ul className="morning-list" data-morning-left>{review.left.map((l, i) => <li key={i}>{l.what} <span className="morning-why">— {l.why}</span></li>)}</ul>
    </>}
    {review.edited.length > 0 && <>
      <h4>Changed because you named it</h4>
      <ul className="morning-list">{review.edited.map((e) => <li key={e.itemId} data-morning-edited={e.itemId}>
        <button className="morning-link" onClick={() => onItem(e.itemId)}>{e.title}</button>
        {e.failed
          ? <span className="morning-why"> — did not work: {e.failed}</span>
          : e.before && <> <button className="morning-link" data-morning-before onClick={() => void import("./VersionCompare.tsx").then((m) => m.openCompare({ canvasId: prior.canvasId, actor, itemId: e.itemId, from: e.before!, ...(e.after ? { to: e.after } : {}) }))}>See the version before</button></>}
      </li>)}</ul>
    </>}
  </section>;
}
