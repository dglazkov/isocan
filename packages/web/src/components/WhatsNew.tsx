import { useEffect, useState } from "react";
import { news as parseNews, newestDay, unseen, type NewsDay } from "@isocan/core";

import { fetchNews } from "../lib/api.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Modal } from "./Modal.tsx";

/**
 * **What changed, for the person using this.**
 *
 * `docs/changelog/` is the other document and is deliberately not this one:
 * it names functions, records the arguments that were had, and keeps the
 * roads not taken. Right for whoever maintains this, wrong to put in front of
 * somebody who wants to know whether the canvas does anything new today.
 *
 * The entries come from the home this canvas is on, so what you are told is
 * new is what you are actually running — a home a week behind has nothing
 * newer to show, and says so by being quiet.
 */
const SEEN_KEY = "isocan.news.seen";

/** The last day this browser was shown, or null for somebody who has never
 *  opened it. Per browser rather than per actor: it is about what these eyes
 *  have read, and an actor is a name you can change. */
function lastSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    // A browser refusing storage gets a panel that never claims unread — the
    // list still reads, which is the part that matters.
    return null;
  }
}

function markSeen(day: string | null): void {
  if (!day) return;
  try {
    localStorage.setItem(SEEN_KEY, day);
  } catch {
    /* nothing to remember it with; the panel still works */
  }
}

/**
 * How many days this reader has not seen. Zero for a first visit on purpose —
 * meeting somebody with fifty unread notices is a chore, not a welcome, and a
 * dot is a claim about their attention rather than about the list.
 */
export function useUnreadNews(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    fetchNews()
      .then((r) => live && setCount(unseen(r.days, lastSeen()).length))
      .catch(() => {
        /* a home that will not answer has no news; the dot stays off */
      });
    return () => {
      live = false;
    };
  }, []);
  return count;
}

export function WhatsNew() {
  const open = useUiStore((s) => s.newsOpen);
  const setOpen = useUiStore((s) => s.setNewsOpen);
  const [days, setDays] = useState<NewsDay[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchNews()
      .then((r) => {
        if (!live) return;
        setDays(r.days);
        // Read on OPEN, not on close: a panel you opened and skimmed has been
        // seen, and making somebody scroll to the bottom to clear a dot is a
        // toll rather than a record.
        markSeen(newestDay(r.days));
      })
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;
  return (
    /**
     * **A modal across the top of the canvas, not a column down its side.**
     *
     * It was a right-hand panel first and that was wrong twice: it sat on top
     * of the Chat rail, and release notes are SENTENCES — in a 380px column
     * every line wrapped three times and the panel was mostly empty below the
     * fold. Wide, the day is a label in the margin and the notes read as
     * prose, which is what they are.
     */
    <Modal label="What's new" title="What's new" onClose={() => setOpen(false)} wide>
      {days === null && <p className="canvas-none">Reading…</p>}
      {days?.length === 0 && (
        /* Not an error: a home with no notes is a home with nothing to say. */
        <p className="canvas-none">Nothing noted yet.</p>
      )}
      {days?.map((d) => (
        <section className="news-day" key={d.day}>
          <h3>{d.title}</h3>
          <ul>
            {d.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}

/** Kept beside the panel so the parser and the renderer cannot disagree about
 *  what an entry is. */
export const __parseForTests = parseNews;
