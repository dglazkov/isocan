import { useState } from "react";
import { inboxTally, newSince, threadPath, type Actor } from "@isocan/core";
import { useInboxStore } from "../stores/inboxStore.ts";

/** Home and notification surfaces read one authoritative inbox response. */
export function Inbox({ actor }: { actor: Actor }) {
  const state = useInboxStore();
  const [onlyNew, setOnlyNew] = useState(true);
  const data = state.actorId === actor.id ? state.data : null;
  const loading = state.actorId !== actor.id || state.loading;
  const entries = data ? (onlyNew ? newSince(data.entries, data.marks) : data.entries) : [];
  const tally = inboxTally(entries);
  const incomplete = Boolean(state.error || data?.unavailable.length);
  return <section className="home-inbox" aria-label="Inbox">
    <div className="inbox-heading">
      <h2>Inbox{data ? ` · ${newSince(data.entries, data.marks).length} new` : ""}</h2>
      <label><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> New only</label>
      <button className="btn quiet" onClick={state.refresh}>Refresh inbox</button>
    </div>
    {loading ? <p className="inbox-note" role="status">Reading your inbox…</p> : <>
      <p className="inbox-tally">{tally.mentioned} {tally.mentioned === 1 ? "mention" : "mentions"} · {tally["main-thread"]} in Chat · {tally["in-your-thread"]} in your threads</p>
      {state.error && <p className="inbox-unavailable" role="status">Inbox unavailable: {state.error}</p>}
      {data?.unavailable.length ? <p className="inbox-unavailable" role="status">{data.unavailable.length} canvas{data.unavailable.length === 1 ? " is" : "es are"} unavailable. This inbox is incomplete.</p> : null}
      {entries.length === 0 && !incomplete && <p className="inbox-note">{onlyNew ? "Nothing new addressed to you." : "Nothing addressed to you yet."}</p>}
      <div className="inbox-entries">{entries.map((entry) => {
        const path = threadPath(entry.canvasId, entry.threadId);
        const home = data!.homes[entry.canvasId];
        const href = home ? new URL(path, home).href : path;
        return <a className="inbox-entry" key={`${entry.canvasId}:${entry.threadId}:${entry.comment.id}`} href={href}>
          <span className="inbox-entry-meta"><strong>{entry.comment.author.name}</strong><span>{entry.canvasTitle ?? entry.canvasId}</span><span className="inbox-reason">{entry.reason === "mentioned" ? "Mention" : entry.reason === "main-thread" ? "Chat" : "Your thread"}</span></span>
          <span className="inbox-body">{entry.comment.body}</span>
          {home && <span className="inbox-home">{new URL(home).host}</span>}
        </a>;
      })}</div>
    </>}
  </section>;
}
