import { useEffect, type CSSProperties, type ReactNode } from "react";
import { AREA_TITLE_HEIGHT, groupStackBox, isArea, isGroupItem, isTextItem, textDrawSize, textIsLegible, TEXT_SIZE, type Item } from "@isocan/core";
import { TEXT_OWNER_ONLY } from "@isocan/core/keys";
import {
  memberTypeSize, summarisablePicture, summarisableText, summariesRoute, summaryKey, summaryMembers, summaryPicture, SUMMARY_NO_PICTURES, SUMMARY_OVER_BUDGET, SUMMARY_QUIET, SUMMARY_VISION_OVER_BUDGET,
  type SummaryEntry, type SummaryMake, type SummaryRead, type SummaryWait,
} from "@isocan/core/semantic-zoom";
import { TEXT_RATE_LIMITED, TEXT_UNAVAILABLE } from "@isocan/core/text";
import { ApiError, request } from "../lib/api.ts";
import { TEXT_MARK_CSS } from "../lib/chrome.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useGistStore } from "../stores/gistStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import "./semantic-zoom.css";

/**
 * **Semantic Zoom's reader and asker, for one canvas** (an experiment; text
 * nodes since phase 1, groups and areas since phase 2;
 * `docs/projects/semantic-zoom/design.md` §3 and §6).
 *
 * Mounted only while this person has `semantic.zoom` on, and this whole chunk
 * is fetched only then: with it off, no request is made, nothing is asked of
 * a model, and nothing of this loads. It draws nothing itself. Once the view
 * has settled it works out which text nodes on screen are too small to read,
 * and which groups and areas hold members too small to read (the median
 * member's type size, `memberTypeSize`), reads their summaries from the home
 * in one batch, and hands ItemView a finished mark for each (`gistStore.ts`):
 * a note's in its opening words' place, a group's or an area's as a card
 * inside its frame, under the title strip. For a group or an area ItemView
 * decides when the card shows (`Z_GIST`, with the zoom rule's hysteresis), so
 * this hands over the members' type size beside the card.
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
 * long to wait. When the badge's minute or the canvas's hour is spent
 * (`summary-budget`, phase 3) it pauses, still reading — a stale summary
 * keeps showing, a missing one keeps its fallback — and asks again after.
 *
 * **Looking at pictures** (phase 3b, design §11), only while this person
 * also has `semantic.zoom.vision` on: a group or an area holding a screen or
 * a picture with a picture to send is asked for under its vision key, and a
 * screen or a picture standing alone gets a card of its own once body-size
 * words on it could not be read. The text-only summary is read meanwhile and
 * shown until the vision one exists, and is what this view asks for while
 * the canvas's picture budget is spent. With the setting off, no key it asks
 * about is a vision key and no read says `vision=1`, so it never causes or
 * sees a summary made from pictures; turning it off clears what it showed.
 * A home whose model takes no pictures refuses once
 * (`summary-no-pictures`) and this view goes on text-only.
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
/** How long a view stops asking after the badge's rate or the canvas's budget says no. */
const PAUSE_MS = 60_000;

/** A frame with less room than this on screen (px) has no room for a summary line: it keeps its title only (design §3, the mark band). */
const CARD_MIN = { w: 96, h: 28 };
/** The experiment that adds pictures to what is summarised (design §11); meaningless without `semantic.zoom`. */
const VISION = "semantic.zoom.vision";

interface Seen {
  item: Item;
  kind: SummaryMake["kind"];
  /** The key whose summary this view shows: the vision key when it looks at pictures, else the text-only one. */
  key: string;
  /** Looking at pictures, a group's or an area's text-only key: read, and shown, until the vision summary exists. */
  fallback?: string;
  /** The key is a vision key: asked for with `vision: true`. */
  looks: boolean;
  distance: number;
  /** A group's or an area's members' median type size, in world units; a screen's, body size. */
  px?: number;
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

/**
 * A group's or an area's card: counter-scaled so it reads, inside the frame
 * under its title strip, as wide as the frame and never taller than what is
 * left of it (`semantic-zoom.css`). "≈" and "Summary of …", like a note's.
 */
function card(item: Item, summary: string, stale: boolean): ReactNode {
  // A screen or a picture alone has no title strip inside it: its card starts at its top.
  const top = isGroupItem(item) ? (item.groupLayout?.titleHeight ?? AREA_TITLE_HEIGHT) : isArea(item) ? AREA_TITLE_HEIGHT : 0;
  return (
    <div className="sz-gist sz-card" style={{ "--sz-top": top } as CSSProperties} role="note" aria-label={`Summary of ${item.title}${stale ? ", being brought up to date" : ""}`} data-stale={stale ? "" : undefined}>
      <span className="sz-sign" aria-hidden="true">≈ </span>
      {summary}
      {stale && <span className="sz-updating" aria-hidden="true" title="Being brought up to date"> ↻</span>}
    </div>
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
  /** The home said its model takes no pictures: text-only from now on. */
  let visionRefused = false;
  /** The canvas's picture budget is spent: text-only makes until then. */
  let visionPausedUntil = 0;
  let visionResume: ReturnType<typeof setTimeout> | undefined;
  const looking = () => !visionRefused && useUiStore.getState().experiments.includes(VISION);
  let seen: Seen[] = [];
  let settle: ReturnType<typeof setTimeout> | undefined;
  let resume: ReturnType<typeof setTimeout> | undefined;

  const keyOf = (kind: Seen["kind"], sources: Item[], vision: boolean) => {
    const at = [kind, String(vision), ...sources.map((one) => `${one.id}\n${one.currentVersionId}\n${one.title}`)].join("\n");
    let key = keys.get(at);
    if (!key) keys.set(at, (key = summaryKey(kind, sources, vision)));
    return key;
  };

  /**
   * What on screen cannot be read, nearest the centre first: text nodes whose
   * words are too small, and groups and areas whose members are — counted
   * from the zoom rule's far edge (`textIsLegible(…, false)`), so ItemView's
   * hysteresis always has a card in hand on either side of the line.
   */
  const onScreen = async (): Promise<Seen[]> => {
    const { canvas } = useCanvasStore.getState();
    const { tx, ty, scale } = useUiStore.getState().viewport;
    if (!canvas) return [];
    const w = window.innerWidth, h = window.innerHeight;
    const vision = looking();
    const found: Array<Omit<Seen, "key" | "fallback"> & { sources: Item[] }> = [];
    for (const item of Object.values(canvas.items)) {
      // A screen or a picture is summarised alone only when looking at pictures, and only standing alone: in a group, its group's card says it.
      const kind = isTextItem(item) ? "text" : isGroupItem(item) ? "group" : isArea(item) ? "area" : vision && !item.containerId && summaryPicture(item) ? "screen" : null;
      if (!kind) continue;
      const left = item.x * scale + tx, top = item.y * scale + ty, right = left + item.width * scale, bottom = top + item.height * scale;
      if (right < 0 || bottom < 0 || left > w || top > h) continue;
      const distance = Math.hypot((left + right) / 2 - w / 2, (top + bottom) / 2 - h / 2);
      if (kind === "text") {
        if (textIsLegible(textDrawSize(item), scale) || summarisableText(canvas, item.id) !== item) continue;
        found.push({ item, kind, distance, sources: [item], looks: false });
        continue;
      }
      if (kind === "screen") {
        if (right - left < CARD_MIN.w || bottom - top < CARD_MIN.h || textIsLegible(TEXT_SIZE, scale, false) || summarisablePicture(canvas, item.id) !== item) continue;
        found.push({ item, kind, distance, px: TEXT_SIZE, sources: [item], looks: true });
        continue;
      }
      if (groupStackBox(item) || right - left < CARD_MIN.w || bottom - top - AREA_TITLE_HEIGHT * scale < CARD_MIN.h) continue;
      const held = summaryMembers(canvas, kind, item.id);
      const px = typeof held === "object" && held ? memberTypeSize(held.members) : undefined;
      if (!px || textIsLegible(px, scale, false)) continue;
      const members = (held as { members: Item[] }).members;
      found.push({ item, kind, distance, px, sources: [item, ...members], looks: vision && members.some((m) => summaryPicture(m) !== null) });
    }
    found.sort((a, b) => a.distance - b.distance);
    return Promise.all(
      found.map(async ({ sources, ...one }) => ({
        ...one,
        key: await keyOf(one.kind, sources, one.looks),
        ...(one.looks && one.kind !== "screen" ? { fallback: await keyOf(one.kind, sources, false) } : {}),
      })),
    );
  };

  /** One set of gists for what is on screen, in one store write — never an empty frame between two summaries. */
  const paint = () => {
    const next: Record<string, { node: ReactNode; px?: number }> = {};
    const put = (item: Item, px: number | undefined, summary: string, stale: boolean) =>
      (next[item.id] = px ? { node: card(item, summary, stale), px } : { node: gist(item.title, summary, stale) });
    for (const { item, key, fallback, px } of seen) {
      const entry = byKey.get(key);
      if (entry?.short) {
        shown.delete(item.id);
        continue;
      }
      // Looking at pictures: the vision summary when there is one, the text-only one of the same content meanwhile.
      const plain = fallback ? byKey.get(fallback) : undefined;
      const now = entry?.summary && !entry.stale ? entry.summary : plain?.summary && !plain.stale ? plain.summary : null;
      if (now) {
        shown.set(item.id, { title: item.title, summary: now });
        put(item, px, now, false);
        continue;
      }
      const before = entry?.summary ?? shown.get(item.id)?.summary;
      if (before) put(item, px, before, true);
    }
    useGistStore.setState(next, true);
  };

  const pump = () => {
    if (!mayAsk || useCanvasStore.getState().capability !== "edit") return;
    if (Date.now() < pausedUntil) {
      // One wake-up at the end of the pause, whatever the view does meanwhile.
      resume ??= setTimeout(() => ((resume = undefined), schedule(0)), pausedUntil - Date.now() + 250);
      return;
    }
    const visionWaits = Date.now() < visionPausedUntil;
    if (visionWaits) visionResume ??= setTimeout(() => ((visionResume = undefined), schedule(0)), visionPausedUntil - Date.now() + 250);
    for (const { item, kind, key, fallback, looks } of seen) {
      if (making.size >= AT_ONCE) return;
      const entry = byKey.get(key);
      if (entry && !entry.stale) continue;
      // While the canvas's pictures are spent for the hour, the text-only summary is the one to make.
      const plainOnly = looks && visionWaits;
      if (plainOnly && (!fallback || (byKey.get(fallback) && !byKey.get(fallback)!.stale))) continue;
      const ask = plainOnly ? fallback! : key;
      if (failed.has(ask) || making.has(ask) || timers.has(ask)) continue;
      making.add(ask);
      const body: SummaryMake = { kind, sourceId: item.id, ...(looks && !plainOnly ? { vision: true } : {}) };
      void request<SummaryEntry | SummaryWait>("POST", summariesRoute(canvasId), body).then(
        (answer) => {
          if (!live) return;
          if ("retryAfterMs" in answer && answer.code === SUMMARY_QUIET) {
            timers.set(ask, setTimeout(() => (timers.delete(ask), schedule(0)), answer.retryAfterMs + 250));
          } else {
            const entry = answer as SummaryEntry;
            byKey.set(entry.key, entry);
            if (entry.key !== ask) failed.add(ask);
          }
        },
        (error: unknown) => {
          const code = error instanceof ApiError ? error.code : undefined;
          // Not this person's to pay for, or nothing to pay with: read only, from now on.
          if (code === TEXT_OWNER_ONLY || code === TEXT_UNAVAILABLE || code === "view-only" || code === "not-admitted") mayAsk = false;
          // The badge's minute or the canvas's hour is spent: read only for a while, then ask again.
          else if (code === TEXT_RATE_LIMITED || code === SUMMARY_OVER_BUDGET) pausedUntil = Date.now() + PAUSE_MS;
          // The canvas's pictures are spent for the hour: text-only makes meanwhile, then pictures again.
          else if (code === SUMMARY_VISION_OVER_BUDGET) visionPausedUntil = Date.now() + PAUSE_MS;
          // This home's model takes no pictures: from now on this view asks and reads as if the setting were off.
          else if (code === SUMMARY_NO_PICTURES) visionRefused = true;
          else failed.add(ask);
          if (code === SUMMARY_VISION_OVER_BUDGET || code === SUMMARY_NO_PICTURES) schedule(0);
        },
      ).finally(() => {
        making.delete(ask);
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
    // Each key with the source a stale stand-in is looked up by; a fallback key wants none (the vision key's stand-in covers the item).
    const unread = seen.flatMap((one) => [{ key: one.key, source: one.item.id }, ...(one.fallback ? [{ key: one.fallback, source: "" }] : [])]).filter((one) => !read.has(one.key));
    const vision = looking() ? "&vision=1" : "";
    for (let i = 0; i < unread.length; i += PER_READ) {
      const batch = unread.slice(i, i + PER_READ);
      const query = `keys=${batch.map((one) => one.key).join(",")}&for=${batch.map((one) => encodeURIComponent(one.source)).join(",")}${vision}`;
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
    if (s.experiments.includes(VISION) !== before.experiments.includes(VISION)) {
      // Looking at pictures turned on or off: nothing read or shown under the other setting carries over, and with it off nothing made from pictures stays on screen.
      byKey.clear();
      read.clear();
      shown.clear();
      failed.clear();
      useGistStore.setState({}, true);
      schedule(0);
    }
  });
  const offCanvas = useCanvasStore.subscribe((s, before) => {
    if (s.canvas !== before.canvas) schedule();
  });
  schedule(0);
  return () => {
    live = false;
    clearTimeout(settle);
    clearTimeout(resume);
    clearTimeout(visionResume);
    for (const timer of timers.values()) clearTimeout(timer);
    offView();
    offCanvas();
    useGistStore.setState({}, true);
  };
}
