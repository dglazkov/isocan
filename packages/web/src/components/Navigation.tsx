import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { CANVAS_ROUTE, MODULE_PAGE_ROUTE, mergeSeen, newSince, type Actor, type SeenMarks } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { fetchInbox } from "../lib/api.ts";
import { loadSeen, onSeenVisit, rememberSeen } from "../lib/seen.ts";
import { startInboxPoll } from "../lib/inboxpoll.ts";
import { useInboxStore } from "../stores/inboxStore.ts";
import { Inbox } from "./Inbox.tsx";
import { usePhone } from "../lib/phone.ts";

const CommandPalette = lazy(() => import("./CommandPalette.tsx").then((m) => ({ default: m.CommandPalette })));

/** A single owner across the home, lens, and canvas. The palette stays lazy;
 * the only background work is a slow, visible-tab inbox read. */
export function Navigation({ actor }: { actor: Actor }) {
  const { pathname } = useLocation();
  const addressed = useMatch(`${CANVAS_ROUTE}/*`)?.params.canvasId ?? null;
  const canvasRoute = useMatch(CANVAS_ROUTE);
  const phone = usePhone();
  // A route alone is not a working canvas: the home gate may still be
  // asking, refused, or showing the viewer. Those surfaces get navigation.
  const canvasId = useCanvasStore((s) =>
    s.canvasId === addressed && s.record && s.capability !== "view" && !s.refusedHere && !s.takenDown && !s.ended ? addressed : null,
  );
  // Desktop actions address the canvas and its panels. A phone face or a
  // covering route cannot show those results, so it keeps global navigation.
  const actionCanvasId = canvasRoute && !phone ? canvasId : null;
  const mode = useUiStore((s) => s.paletteOpen);
  const setMode = useUiStore((s) => s.setPaletteOpen);
  const state = useInboxStore();
  const [open, setOpen] = useState(false);
  /**
   * **Off means off, including the polling** (13 Sep's inbox, behind an
   * experiment on 14 Sep). An experiment that is merely hidden would still
   * read every canvas at this home every thirty seconds for somebody who never
   * asked for it — the one cost this mechanism exists to avoid. Subscribed
   * rather than read once, so turning it on in Settings starts the poll
   * without a reload.
   */
  const inboxOn = useUiStore((s) => s.experiments.includes("inbox"));
  useEffect(() => {
    if (!inboxOn) return;
    let live = true;
    let visited: SeenMarks = {};
    const unwatch = onSeenVisit((actorId, canvasId, mark) => {
      if (!live || actorId !== actor.id) return;
      visited = mergeSeen(visited, { [canvasId]: mark });
      useInboxStore.setState((current) => current.actorId === actorId && current.data
        ? { data: { ...current.data, marks: mergeSeen(current.data.marks, visited) } }
        : {});
    });
    useInboxStore.setState({ actorId: actor.id, data: null, error: null, loading: true, refresh: () => {} });
    // Preparation heals a claim before inbox assertions, inside the same
    // visible-tab lifecycle. A stalled read is cancellable and retryable.
    const polling = startInboxPoll({
      prepare: async (signal) => {
        if (!await loadSeen(actor.id, { signal })) throw new Error("Could not read your seen marks. Refresh the inbox to try again.");
      },
      read: (signal) => fetchInbox(actor.id, signal), visibility: document,
      changed: (next) => {
        if (!live) return;
        // An older poll cannot undo a mark this tab's visit just received.
        const data = next.data ? { ...next.data, marks: mergeSeen(next.data.marks, visited) } : null;
        if (data) rememberSeen(actor.id, data.marks);
        useInboxStore.setState({ ...next, data });
      },
    });
    useInboxStore.setState({ refresh: polling.refresh });
    return () => { live = false; unwatch(); polling.stop(); setMode(null); };
  }, [actor.id, setMode, inboxOn]);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const ui = useUiStore.getState();
      if (ui.contextMenu || ui.groupDialog) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault(); ui.setPaletteOpen(ui.paletteOpen ? null : "commands");
      } else if (e.key.toLowerCase() === "o") {
        e.preventDefault(); ui.setPaletteOpen(ui.paletteOpen === "canvases" ? null : "canvases");
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  useEffect(() => { setOpen(false); setMode(null); }, [pathname, setMode]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open]);
  /**
   * **A module's workspace owns the screen, so the app's own floating things
   * stay off it.** The Inbox button pins itself to the bottom-right corner of
   * whatever is there, which on a canvas is the canvas and inside a workspace
   * is somebody else's layout — it sat over the Anatomy inspector reading
   * "Inbox · 696 new · unavailable", a sentence about a different room.
   *
   * The workspace's own chrome is the way to everything while you are in it.
   * Chat and Agents have buttons in its header for exactly this reason; the
   * Inbox has none, which is the argument for hiding it rather than moving it.
   */
  const onModulePage = Boolean(useMatch(MODULE_PAGE_ROUTE));
  const mine = state.actorId === actor.id ? state.data : null;
  const unread = mine ? newSince(mine.entries, mine.marks) : [];
  const count = unread.length;
  const unavailable = Boolean(state.error || mine?.unavailable.length);
  /**
   * **The label is one word and a number.** On a phone this button is a fixed
   * 96px box that ellipsises its own text, and "Inbox · 12 new · unavailable"
   * arrived there as "Inbox · 12 n…". The breakdown somebody wants before
   * opening it belongs in the tooltip — which is also where the per-reason
   * count the 29 Aug research asked for finally lands, instead of one number
   * that cannot say whether twelve means twelve people or one busy Chat.
   */
  const hint = unavailable
    ? "Some of this inbox could not be read"
    : count > 0
      ? `${count} new · ${unread.filter((entry) => entry.reason === "mentioned").length} naming you`
      : "Nothing new";
  return <>
    {inboxOn && pathname !== "/" && !onModulePage && <button
      className={`btn navigation-inbox${canvasId ? " on-canvas" : ""}${count > 0 ? " has-new" : ""}`}
      onClick={() => setOpen((was) => !was)}
      aria-expanded={open}
      aria-label={count > 0 ? `Inbox, ${count} new` : "Inbox"}
      title={hint}
    >
      Inbox{count > 0 ? <span className="inbox-count">{count}</span> : null}{unavailable ? <span className="inbox-warn" aria-hidden="true">!</span> : null}
    </button>}
    {inboxOn && open && <div className={`navigation-inbox-panel${canvasId ? " on-canvas" : ""}`} role="dialog" aria-label="Your inbox"><button className="btn quiet inbox-close" onClick={() => setOpen(false)}>Close inbox</button><Inbox actor={actor} /></div>}
    {mode && <Suspense fallback={null}><CommandPalette canvasId={actionCanvasId} actor={actor} mode={mode} onMode={setMode} onClose={() => setMode(null)} /></Suspense>}
  </>;
}
