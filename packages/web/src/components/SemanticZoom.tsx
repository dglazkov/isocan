import { useEffect, type ReactNode } from "react";
import { isTextItem, textDrawSize, textIsLegible, type Item } from "@isocan/core";
import { TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { summarisableText, summariesRoute, SUMMARY_QUIET, textSummaryKey, type SummaryEntry, type SummaryRead, type SummaryWait } from "@isocan/core/semantic-zoom";
import { TEXT_RATE_LIMITED, TEXT_UNAVAILABLE } from "@isocan/core/text";
import { ApiError, request } from "../lib/api.ts";
import { TEXT_MARK_CSS } from "../lib/chrome.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useGistStore } from "../stores/gistStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import "./semantic-zoom.css";

/**
 * **Semantic Zoom's reader and asker, for one canvas** (an experiment; phase 1:
 * text nodes; `docs/projects/semantic-zoom/design.md` §3 and §6).
 *
 * Mounted only while this person has `semantic.zoom` on, and this whole chunk
 * is fetched only then: with it off, no request is made, nothing is asked of
 * a model, and nothing of this loads. It draws nothing itself. Once the view
 * has settled it works out which text nodes on screen are too small to read,
 * reads their summaries from the home in one batch, and hands ItemView a
 * finished mark for each (`gistStore.ts`) to draw in the opening words' place.
 *
 * A summary is looked up by its content key every time, never remembered by
 * item: an edit is a new key. Until the new content has a summary, the old one
 * keeps showing with an "updating" mark — the home answers a key it has no
 * entry for with the newest entry for the same note, marked stale, and a note
 * this view already showed keeps what it showed — so a reader never sees the
 * mark empty between the old summary and the new.
 *
 * **The first person who can pay causes it** (design §10): a viewer who may
 * edit asks the home to make a missing summary, nearest the centre first, at
 * most four at a time. The home decides whether this person's key may be
 * spent; when it says no (owner-only, no key, view-only) this view stops
 * asking and only reads, and when the note changed moments ago it says how
 * long to wait.
 */
export default function SemanticZoom({ canvasId }: { canvasId: string }) {
  useEffect(() => watch(canvasId), [canvasId]);
  return null;
}

/** Most makes in flight from one view (design §6). */
const AT_ONCE = 4;
/** How long the view must be still before it counts as settled. */
const SETTLE_MS = 300;
/** Keys per read: what one screen shows, not a whole canvas. */
const PER_READ = 100;

interface Seen {
  item: Item;
  key: string;
  distance: number;
}

/** The mark ItemView draws: "≈", the summary, and while it is being brought up to date, a quiet mark saying so. */
function gist(title: string, summary: string, stale: boolean): ReactNode {
  return (
    <span className="text-mark sz-gist" style={{ fontSize: TEXT_MARK_CSS }} role="note" aria-label={`Summary of ${title}${stale ? ", being brought up to date" : ""}`} data-stale={stale ? "" : undefined}>
      <span className="sz-sign" aria-hidden="true">≈ </span>
      {summary}
      {stale && <span className="sz-updating" aria-hidden="true" title="Being brought up to date"> ↻</span>}
    </span>
  );
}

function watch(canvasId: string): () => void {
  let live = true;
  /** What the home said, by the key that was asked about. */
  const byKey = new Map<string, SummaryEntry>();
  /** The summary each note last showed, so a new key starts from it, not from nothing. */
  const shown = new Map<string, { title: string; summary: string }>();
  const read = new Set<string>();
  const failed = new Set<string>();
  const making = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const keys = new Map<string, Promise<string>>();
  let mayAsk = true;
  let pausedUntil = 0;
  let seen: Seen[] = [];
  let settle: ReturnType<typeof setTimeout> | undefined;

  const keyOf = (item: Item) => {
    const at = `${item.id}\n${item.currentVersionId}\n${item.title}`;
    let key = keys.get(at);
    if (!key) keys.set(at, (key = textSummaryKey(item)));
    return key;
  };

  /** The text nodes on screen whose words cannot be read, nearest the centre first. */
  const onScreen = async (): Promise<Seen[]> => {
    const { canvas } = useCanvasStore.getState();
    const { tx, ty, scale } = useUiStore.getState().viewport;
    if (!canvas) return [];
    const w = window.innerWidth, h = window.innerHeight;
    const found: Array<Omit<Seen, "key">> = [];
    for (const item of Object.values(canvas.items)) {
      if (!isTextItem(item) || textIsLegible(textDrawSize(item), scale)) continue;
      const left = item.x * scale + tx, top = item.y * scale + ty, right = left + item.width * scale, bottom = top + item.height * scale;
      if (right < 0 || bottom < 0 || left > w || top > h) continue;
      if (summarisableText(canvas, item.id) !== item) continue;
      found.push({ item, distance: Math.hypot((left + right) / 2 - w / 2, (top + bottom) / 2 - h / 2) });
    }
    found.sort((a, b) => a.distance - b.distance);
    return Promise.all(found.map(async (one) => ({ ...one, key: await keyOf(one.item) })));
  };

  /** One set of gists for what is on screen, in one store write — never an empty frame between two summaries. */
  const paint = () => {
    const next: Record<string, ReactNode> = {};
    for (const { item, key } of seen) {
      const entry = byKey.get(key);
      if (entry?.short) {
        shown.delete(item.id);
        continue;
      }
      if (entry?.summary && !entry.stale) {
        shown.set(item.id, { title: item.title, summary: entry.summary });
        next[item.id] = gist(item.title, entry.summary, false);
        continue;
      }
      const before = entry?.summary ?? shown.get(item.id)?.summary;
      if (before) next[item.id] = gist(item.title, before, true);
    }
    useGistStore.setState(next, true);
  };

  const pump = () => {
    if (!mayAsk || Date.now() < pausedUntil || useCanvasStore.getState().capability !== "edit") return;
    for (const { item, key } of seen) {
      if (making.size >= AT_ONCE) return;
      const entry = byKey.get(key);
      if ((entry && !entry.stale) || failed.has(key) || making.has(key) || timers.has(key)) continue;
      making.add(key);
      void request<SummaryEntry | SummaryWait>("POST", summariesRoute(canvasId), { kind: "text", sourceId: item.id }).then(
        (answer) => {
          if (!live) return;
          if ("retryAfterMs" in answer && answer.code === SUMMARY_QUIET) {
            timers.set(key, setTimeout(() => (timers.delete(key), schedule(0)), answer.retryAfterMs + 250));
          } else {
            const entry = answer as SummaryEntry;
            byKey.set(entry.key, entry);
            if (entry.key !== key) failed.add(key);
          }
        },
        (error: unknown) => {
          const code = error instanceof ApiError ? error.code : undefined;
          // Not this person's to pay for, or nothing to pay with: read only, from now on.
          if (code === TEXT_OWNER_ONLY || code === TEXT_UNAVAILABLE || code === "view-only" || code === "not-admitted") mayAsk = false;
          else if (code === TEXT_RATE_LIMITED) pausedUntil = Date.now() + 60_000;
          else failed.add(key);
        },
      ).finally(() => {
        making.delete(key);
        if (!live) return;
        paint();
        pump();
      });
    }
  };

  const run = async () => {
    const now = await onScreen();
    if (!live) return;
    seen = now;
    const unread = seen.filter((one) => !read.has(one.key));
    for (let i = 0; i < unread.length; i += PER_READ) {
      const batch = unread.slice(i, i + PER_READ);
      const query = `keys=${batch.map((one) => one.key).join(",")}&for=${batch.map((one) => encodeURIComponent(one.item.id)).join(",")}`;
      const answer = await request<SummaryRead>("GET", `${summariesRoute(canvasId)}?${query}`).catch(() => null);
      if (!live) return;
      if (!answer) continue;
      for (const one of batch) {
        const entry = answer.summaries[one.key];
        if (entry) byKey.set(one.key, entry);
        // Missing or stale is read again next time: somebody who can pay may have made it since.
        if (entry && !entry.stale) read.add(one.key);
      }
    }
    paint();
    pump();
  };

  function schedule(ms = SETTLE_MS) {
    clearTimeout(settle);
    settle = setTimeout(() => void run(), ms);
  }

  const offView = useUiStore.subscribe((s, before) => {
    if (s.viewport !== before.viewport) schedule();
  });
  const offCanvas = useCanvasStore.subscribe((s, before) => {
    if (s.canvas !== before.canvas) schedule();
  });
  schedule(0);
  return () => {
    live = false;
    clearTimeout(settle);
    for (const timer of timers.values()) clearTimeout(timer);
    offView();
    offCanvas();
    useGistStore.setState({}, true);
  };
}
