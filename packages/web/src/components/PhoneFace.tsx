import { VisitDigest } from "./VisitDigest.tsx";
import type { PriorVisit } from "../lib/visitdigest.ts";
import { Suspense, lazy, useEffect, useState, type MutableRefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sourceOf, isDesignSystem, isTextItem, itemPath, THREAD_QUERY, roster, visualFaceOf, type Actor } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { findNextItem, type Direction } from "../lib/spatialnav.ts";
import { useTouchNavigation } from "../lib/touchnavigation.ts";
import { useAnswerable } from "../lib/answerable.ts";
import { useCanEdit } from "../lib/capability.ts";
import { MainThreadBody } from "./MainThreadPanel.tsx";
import { AgentRowView } from "./AgentRow.tsx";
import { ContextPanel } from "./LazyContextPanel.tsx";
import { VersionContent } from "./ItemView.tsx";
import { CanvasViewport } from "./CanvasViewport.tsx";
import { ComposePopover, ThreadPopover, itemThread } from "./CommentLayer.tsx";
import { ZoomControls } from "./ZoomControls.tsx";
import { Minimap } from "./Minimap.tsx";
import "./phone.css";
import "./mobile-navigation.css";
const CanvasTools = lazy(() => import("./CanvasTools.tsx").then((m) => ({ default: m.CanvasTools })));
/** Retain this visit’s chosen tab and node across width changes, without saving a desktop preference. */
export type PhoneVisit = { tab: "Chat" | "Canvas" | "Agents"; itemId: string | null; plan: boolean };
const directions: [Direction, string, string][] = [["ArrowLeft", "left", "←"], ["ArrowUp", "up", "↑"], ["ArrowDown", "down", "↓"], ["ArrowRight", "right", "→"]];

/** One visit's navigation. Nothing here changes another person's camera or a saved layout. */
export function PhoneFace({ canvasId, actor, visit, prior }: { prior: PriorVisit | null; canvasId: string; actor: Actor; visit: MutableRefObject<PhoneVisit> }) {
  const canvas = useCanvasStore((s) => s.canvas);
  const title = useCanvasStore((s) => s.project?.title);
  const sessions = useCanvasStore((s) => s.sessions);
  const answerable = useAnswerable(canvasId);
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const [state, setState] = useState(visit.current);
  const [digestThread, setDigestThread] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); setContextOpen(false); }, [canvasId, actor.id]);
  useEffect(() => {
    if (!moreOpen && !contextOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMoreOpen(false); setContextOpen(false); } };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [moreOpen, contextOpen]);
  const { search } = useLocation();
  const requestedThread = new URLSearchParams(search).get(THREAD_QUERY);
  const [mainFocus, setMainFocus] = useState(0);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const update = (next: Partial<PhoneVisit>) => { const value = { ...state, ...next }; visit.current = value; setState(value); };
  const items = Object.values(canvas?.items ?? {});
  const item = canvas?.items[state.itemId ?? ""] ?? items[0];
  const open = (id: string) => { setThreadOpen(false); setDigestThread(null); update({ itemId: id, tab: "Canvas", plan: false }); };
  const step = (direction: Direction) => { const next = item && findNextItem(item, items, direction); if (next) open(next.id); };
  const gestures = useTouchNavigation(step, () => update({ plan: true }));
  const current = item?.versions.find((v) => v.id === item.currentVersionId) ?? item?.versions[0];
  const visual = current && visualFaceOf(current);
  const thread = (digestThread && canvas?.threads[digestThread]) || (canvas && item ? itemThread(canvas, item.id) : null);
  const openThread = (id: string) => {
    const target = canvas?.threads[id];
    if (!target) return;
    if (target.main) { update({ tab: "Chat" }); setThreadOpen(false); setMainFocus((n) => n+1); return; }
    setDigestThread(id); setThreadOpen(true);
  };
  const requestedReady = Boolean(requestedThread && canvas?.threads[requestedThread]);
  useEffect(() => {
    if (requestedThread && requestedReady) openThread(requestedThread);
    // A link arrival, once; later canvas traffic must not reopen a closed sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedThread, requestedReady, canvasId]);
  useEffect(() => {
    if (!mainFocus || state.tab !== "Chat") return;
    const conversation = document.querySelector<HTMLElement>(".phone-face .main-scroll");
    if (conversation) { conversation.scrollTop = conversation.scrollHeight; conversation.tabIndex = -1; conversation.focus({ preventScroll: true }); }
  }, [mainFocus, state.tab]);
  const rows = roster(sessions, canvas, Date.now(), answerable).filter((r) => !(r.state === "away" && r.actorId === actor.id));
  return <section className={`phone-face${state.plan && state.tab === "Canvas" ? " phone-plan" : ""}`} aria-label="Phone canvas">
    <header className="phone-header"><Link to="/" aria-label="All canvases">‹</Link><strong>{title}</strong><span>{canEdit ? actor.name : "Read only"}</span><button aria-label="More canvas options" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>More</button></header>
    {moreOpen && <div className="phone-more-menu" role="menu"><button role="menuitem" onClick={() => { setMoreOpen(false); setThreadOpen(false); setContextOpen(true); }}>Context</button></div>}
    <div className="phone-body">
      {state.tab === "Chat" && <div className="phone-chat">
        <VisitDigest prior={prior} onItem={open} onThread={openThread} />
        <MainThreadBody canvasId={canvasId} actor={actor} docked={false} onOpenItem={open} />
      </div>}
      {state.tab === "Agents" && <div className="phone-agents" aria-label="Agents on this canvas">
        {rows.length ? rows.map((row) => <AgentRowView key={row.actorId} canvasId={canvasId} row={row} open={openAgent === row.actorId} focused={null} onToggle={() => setOpenAgent(openAgent === row.actorId ? null : row.actorId)} onOpenItem={open} viewer={actor.id} />) : <p>Nobody is parked here right now. Messages in Chat reach whoever parks next.</p>}
      </div>}
      {state.tab === "Canvas" && (state.plan ? <div className="phone-plan-surface">
        <CanvasViewport canvasId={canvasId} actor={actor} onPlanItem={open} currentNode={item?.id} />
        <button className="phone-return" onClick={() => update({ plan: false })}>Return to {item?.title ?? "node"}</button>
        <Suspense>{canEdit && <CanvasTools canvasId={canvasId} actor={actor} />}</Suspense>
        <ZoomControls canvasId={canvasId} actor={actor} /><Minimap />
      </div> : <div className="phone-node" data-node-id={item?.id} {...gestures}>
        {item ? <>
          <div className="phone-node-bar"><strong>{item.title}</strong><button onClick={() => update({ plan: true })}>Plan</button><button onClick={() => navigate(itemPath(canvasId, item.id))}>Present</button></div>
          <div className="phone-artifact">{current && visual ? <VersionContent canvasOf={item.properties.canvas ?? null} canvasSource={sourceOf(item)} canvasId={canvasId} blobHash={visual.blobHash} mimeType={visual.mimeType} filename={visual.filename ?? current.filename} entered designSystem={isDesignSystem(item)} textNode={isTextItem(item)} reloadToken={0} /> : <p>This node has no preview.</p>}</div>
          {directions.map(([direction, name, glyph]) => { const next = findNextItem(item, items, direction); return <button key={direction} className={`phone-edge edge-${name}`} aria-label={next ? `${name}: ${canvas?.items[next.id]?.title}` : `No item ${name}`} disabled={!next} onClick={() => step(direction)}>{glyph}</button>; })}
          <button className="phone-thread-toggle" onClick={() => { setDigestThread(null); setThreadOpen(true); }}>Conversation{thread ? ` · ${thread.comments.length}` : ""}</button>
        </> : <p className="phone-empty">Nothing on the canvas yet. Ask for something in Chat.</p>}
      </div>)}
    </div>
    <nav className="phone-tabs" aria-label="Canvas views">{(["Chat", "Canvas", "Agents"] as const).map((tab) => <button key={tab} aria-current={state.tab === tab ? "page" : undefined} onClick={() => { setThreadOpen(false); setContextOpen(false); setMoreOpen(false); update({ tab }); }}>{tab}</button>)}</nav>
    {contextOpen && <div className="phone-sheet phone-context-sheet" role="dialog" aria-label="Context"><ContextPanel canvasId={canvasId} actor={actor} onClose={() => setContextOpen(false)} /></div>}
    {threadOpen && (item || thread) && <div className="phone-sheet" role="dialog" aria-label={`Conversation about ${digestThread ? "this change" : item?.title}`}>
      <header><strong>{digestThread ? "Conversation" : item?.title}</strong><button onClick={() => setThreadOpen(false)} aria-label="Close conversation">Close</button></header>
      {thread ? <ThreadPopover key={thread.id} thread={thread} canvasId={canvasId} actor={actor} embedded screen={{ x: 0, y: 0 }} onOpenItem={open} /> : canEdit && item ? <ComposePopover key={item.id} canvasId={canvasId} actor={actor} embedded pending={{ anchorItemId: item.id, x: 0, y: 0 }} onSent={() => setThreadOpen(false)} /> : <p>No conversation on this node yet.</p>}
    </div>}
  </section>;
}
