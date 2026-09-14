import { useState } from "react";
import { ago, inboxTally, newSince, threadPath, type Actor, type InboxEntry } from "@isocan/core";
import { useInboxStore } from "../stores/inboxStore.ts";
import { useActorColors } from "../lib/colors.ts";
import { useActorKinds } from "../lib/actorkinds.ts";
import { useActorNames, actorNameIn } from "../lib/names.ts";
import { faceMarkClass, faceMarkStyle } from "../lib/face.ts";

/**
 * **Everything addressed to you, across every canvas at this home** — one
 * authoritative response, read by the home screen and the floating panel.
 *
 * ## What a row has to answer, in the order the eye asks
 *
 * Who, where, how long ago, and what they said. The first cut answered two of
 * those: the author in bold ink and the canvas beside it, with the body on one
 * ellipsised line and **no time at all**, so a mention from four minutes ago
 * and one from last Tuesday were the same row. A list whose whole job is "what
 * needs you" cannot leave out how long it has been waiting.
 *
 * **Faces, because the rest of the app has them.** A person on this canvas is
 * a colour — the cursor, the pin, the facepile — and the inbox was the one
 * place they were black text. The disc carries the colour and the name stays
 * ink, which is the facepile's own bargain: coloured 12px text would have to
 * pass contrast on every one of the palette's colours, and the disc does not.
 *
 * **An agent is marked.** The inbox fills with your own agents faster than
 * with people (the 29 Aug research counted 7 mentions against 153 Chat lines),
 * and a row you can tell at a glance is a row you can skip.
 *
 * ## One row per conversation
 *
 * The response is per comment, so a thread where somebody mentioned you and
 * then added "(no rush)" arrived as two rows saying nearly the same thing.
 * Rows fold by thread here — newest comment, with a count of what came before
 * it — because the thing you are deciding about is the conversation, and
 * opening either row lands in the same place.
 *
 * ## Hover shows the words, not a preview
 *
 * The body clamps to two lines and the whole row carries the full message as
 * its tooltip. A hover card would be a second surface to lay out, dismiss and
 * make reachable from a keyboard; the message is already text, and text is
 * what a title attribute is for.
 */
export function Inbox({ actor }: { actor: Actor }) {
  const state = useInboxStore();
  const [onlyNew, setOnlyNew] = useState(true);
  const colors = useActorColors();
  const kinds = useActorKinds();
  const names = useActorNames();
  const data = state.actorId === actor.id ? state.data : null;
  const loading = state.actorId !== actor.id || state.loading;
  const fresh = data ? newSince(data.entries, data.marks) : [];
  const freshIds = new Set(fresh.map((entry) => entry.comment.id));
  const entries = data ? (onlyNew ? fresh : data.entries) : [];
  const tally = inboxTally(entries);
  const incomplete = Boolean(state.error || data?.unavailable.length);
  const now = Date.now();
  return <section className="home-inbox" aria-label="Inbox">
    <div className="inbox-heading">
      <h2>Inbox</h2>
      <div className="segmented" role="group" aria-label="Which messages">
        <button type="button" className={onlyNew ? "on" : ""} aria-pressed={onlyNew} onClick={() => setOnlyNew(true)}>
          New{data && fresh.length > 0 ? ` · ${fresh.length}` : ""}
        </button>
        <button type="button" className={onlyNew ? "" : "on"} aria-pressed={!onlyNew} onClick={() => setOnlyNew(false)}>
          Everything
        </button>
      </div>
      <button className="btn quiet inbox-refresh" onClick={state.refresh} title="Read the inbox again now — it refreshes itself every 30 seconds">Refresh</button>
    </div>
    {loading ? <p className="inbox-note" role="status">Reading your inbox…</p> : <>
      {state.error && <p className="inbox-unavailable" role="status">Inbox unavailable: {state.error}</p>}
      {data?.unavailable.length ? <p className="inbox-unavailable" role="status">{data.unavailable.length} canvas{data.unavailable.length === 1 ? " is" : "es are"} unavailable. This inbox is incomplete.</p> : null}
      {entries.length === 0 && !incomplete && <p className="inbox-note">{onlyNew ? "Nothing new addressed to you." : "Nothing addressed to you yet."}</p>}
      {entries.length > 0 && <p className="inbox-tally">{tally.mentioned} {tally.mentioned === 1 ? "mention" : "mentions"} · {tally["main-thread"]} in Chat · {tally["in-your-thread"]} in your threads</p>}
      <div className="inbox-entries">{conversations(entries).map(({ entry, earlier }) => {
        const author = entry.comment.author;
        const path = threadPath(entry.canvasId, entry.threadId);
        const home = data!.homes[entry.canvasId];
        const href = home ? new URL(path, home).href : path;
        const when = entry.comment.createdAt;
        const isNew = freshIds.has(entry.comment.id);
        return <a
          className={`inbox-entry${isNew ? " fresh" : ""}`}
          key={`${entry.canvasId}:${entry.threadId}`}
          href={href}
          title={entry.comment.body}
        >
          <span className={faceMarkClass(undefined, author, "inbox-face")} style={faceMarkStyle(colors, author)} aria-hidden="true">
            {actorNameIn(names, author).slice(0, 1).toUpperCase()}
          </span>
          <span className="inbox-said">
            <span className="inbox-entry-meta">
              <strong>{actorNameIn(names, author)}</strong>
              {kinds[author.id] === "agent" && <span className="inbox-agent" title="An agent, not a person">agent</span>}
              <span className="inbox-where">{entry.canvasTitle ?? entry.canvasId}</span>
              {home && <span className="inbox-home">{new URL(home).host}</span>}
              <span className={`inbox-reason ${entry.reason}`}>{REASON[entry.reason]}</span>
              <time className="inbox-when" dateTime={when} title={new Date(when).toLocaleString()}>{ago(when, now)}</time>
            </span>
            <span className="inbox-body">{entry.comment.body}</span>
            {earlier > 0 && <span className="inbox-earlier">+{earlier} earlier in this conversation</span>}
          </span>
        </a>;
      })}</div>
    </>}
  </section>;
}

/** What put this row in front of you, in the words the tally uses. */
const REASON: Record<InboxEntry["reason"], string> = {
  mentioned: "Mention",
  "main-thread": "Chat",
  "in-your-thread": "Your thread",
};

/**
 * One row per thread, newest comment standing for it, with a count of what it
 * stands for. The response arrives newest-first (`inboxNewestFirst`), so the
 * first comment seen for a thread is the one to show and the rest are
 * "earlier" — no sorting here, and none of the ordering rules restated.
 */
export function conversations(entries: readonly InboxEntry[]): { entry: InboxEntry; earlier: number }[] {
  const rows: { entry: InboxEntry; earlier: number }[] = [];
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.canvasId}:${entry.threadId}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, rows.length);
      rows.push({ entry, earlier: 0 });
    } else {
      rows[at]!.earlier += 1;
    }
  }
  return rows;
}
