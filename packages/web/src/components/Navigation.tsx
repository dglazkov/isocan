import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { CANVAS_ROUTE, mergeSeen, newSince, type Actor, type SeenMarks } from "@isocan/core";
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
    s.canvasId === addressed && s.project && s.capability !== "view" && !s.refusedHere && !s.takenDown && !s.ended ? addressed : null,
  );
  // Desktop actions address the canvas and its panels. A phone face or a
  // covering route cannot show those results, so it keeps global navigation.
  const actionCanvasId = canvasRoute && !phone ? canvasId : null;
  const mode = useUiStore((s) => s.paletteOpen);
  const setMode = useUiStore((s) => s.setPaletteOpen);
  const state = useInboxStore();
  const [open, setOpen] = useState(false);
  useEffect(() => {
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
  }, [actor.id, setMode]);
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
  const mine = state.actorId === actor.id ? state.data : null;
  const count = mine ? newSince(mine.entries, mine.marks).length : 0;
  return <>
    {pathname !== "/" && <button className={`btn navigation-inbox${canvasId ? " on-canvas" : ""}`} onClick={() => setOpen((was) => !was)} aria-expanded={open} aria-label={`Inbox, ${count} new`}>
      Inbox{count > 0 ? ` · ${count} new` : ""}{state.error || mine?.unavailable.length ? " · unavailable" : ""}
    </button>}
    {open && <div className={`navigation-inbox-panel${canvasId ? " on-canvas" : ""}`} role="dialog" aria-label="Your inbox"><button className="btn quiet inbox-close" onClick={() => setOpen(false)}>Close inbox</button><Inbox actor={actor} /></div>}
    {mode && <Suspense fallback={null}><CommandPalette canvasId={actionCanvasId} actor={actor} mode={mode} onMode={setMode} onClose={() => setMode(null)} /></Suspense>}
  </>;
}
