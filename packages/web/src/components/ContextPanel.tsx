import { useEffect, useState, type ReactNode } from "react";
import type { Actor, CanvasContents, ContextLayer } from "@isocan/core";
import { contextLayers, contextLayerKey, memoryLinks, personalMemoryLinks, formatRecapHead } from "@isocan/core";
import { readLayeredContext } from "@isocan/api/context";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { readBlobText } from "../lib/api.ts";
import { personalApi, authoritativeHome, sourceSnapshot } from "../lib/personal.ts";
import { useCanEdit } from "../lib/capability.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { PanelResizer } from "./PanelResizer.tsx";
import { ContextGlyph } from "./Glyphs.tsx";
import { PanelHead } from "./PanelHead.tsx";
import { LiveContextInspection } from "./LazyGroupContext.tsx";
import { PersonalContext, PersonalRead } from "./PersonalContext.tsx";
import "./personal-context.css";
import { sourceRecap } from "../lib/context-recap.ts";
import "./context-recap.css";

const contextIO = { ...personalApi, sourceRecap, sourceSnapshot, designText: readBlobText };

/** Context responses belong to this actor, destination, access state and concrete set of links. */
export function ContextPanel({ canvasId, actor, onClose }: { canvasId: string; actor: Actor; onClose?: () => void }) {
  const open = useUiStore((s) => s.contextPanelOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const connection = useCanvasStore((s) => s.connection);
  const capability = useCanvasStore((s) => s.capability);
  const past = useCanvasStore((s) => s.past);
  if ((!open && !onClose) || !canvas) return null;
  const links = [...memoryLinks(canvas), ...personalMemoryLinks(canvas)];
  const scope = JSON.stringify([canvasId, actor.id, window.location.origin, connection, capability, !!past, links.map((item) => [item.id, item.title, item.properties])]);
  return <ContextAtHome key={scope} canvasId={canvasId} actor={actor} canvas={canvas} scope={scope} close={onClose ?? (() => openPanel(canvasId, null))} />;
}

function ContextAtHome(props: { canvasId: string; actor: Actor; canvas: CanvasContents; scope: string; close: () => void }) {
  const [home, setHome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void authoritativeHome(props.canvasId, controller.signal).then((answer) => { if (!controller.signal.aborted) setHome(answer); }).catch((err) => { if (!controller.signal.aborted) setError(err.message ?? String(err)); });
    return () => controller.abort();
  }, [props.canvasId]);
  return home ? <ContextInspection key={`${props.scope}:${home}`} {...props} home={home} /> : <aside className="context-panel dock-panel floats" aria-label="What an agent reads here"><button className="btn" onClick={props.close}>Close Context</button><p>{error ?? "Finding this canvas's home…"}</p></aside>;
}

function ContextInspection({ canvasId, actor, canvas, scope, home, close }: { canvasId: string; actor: Actor; canvas: CanvasContents; scope: string; home: string; close: () => void }) {
  const canEdit = useCanEdit();
  const groupMode = useCanvasStore((s) => s.project?.groupMode);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const past = useCanvasStore((s) => s.past);
  const [answer, setAnswer] = useState<{ scope: string; layers: ContextLayer[] } | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((n) => n + 1);
  useEffect(() => {
    let controller = new AbortController();
    const pull = () => {
      controller.abort(); controller = new AbortController();
      const signal = controller.signal;
      void readLayeredContext(contextIO, { canvasId, home, canvas, personal: { actorId: actor.id }, signal })
        .then((layers) => { if (!signal.aborted) setAnswer({ scope, layers }); })
        .catch(() => { if (!signal.aborted) setAnswer(null); });
    };
    const stop = everyWhileVisible(pull, 30_000);
    return () => { controller.abort(); stop(); };
  }, [scope, canvasId, actor.id, canvas, revision, home]);
  const layers = answer?.scope === scope ? answer.layers : contextLayers(canvas, []);
  return <aside className="context-panel dock-panel floats" style={{ width: panelWidth }} aria-label="What an agent reads here">
    <PanelHead glyph={<ContextGlyph size={13} />} name="Context" hint="what an agent reads before it starts" closeTitle="Collapse" closeLabel="Close the context view" onClose={close} />
    <div className="context-body">
      {groupMode === "groups" && <LiveContextInspection key={canvasId} canvasId={canvasId} />}
      {layers.map((layer) => <Layer key={contextLayerKey(layer)} layer={layer}>
        {layer.kind === "personal" && !layer.refused && <PersonalRead key={`${scope}:${revision}:${layer.itemId}`} canvasId={canvasId} actor={actor} itemId={layer.itemId} sourceCanvasId={layer.canvasId} home={home} canUnlink={canEdit && !past && !!ownerId && ownerId === layer.owner?.id} refresh={refresh} />}
      </Layer>)}
      {!past && <PersonalContext canvasId={canvasId} actor={actor} refresh={refresh} onOwner={setOwnerId} />}
    </div>
    <PanelResizer />
  </aside>;
}

function Layer({ layer, children }: { layer: ContextLayer; children?: ReactNode }) {
  return (
    <section className="ctx-layer" aria-label={layer.heading}>
      <h3 className="ctx-heading">
        <span>{layer.heading}</span>
        {layer.kind !== "local" && <span className="ctx-heading-note">{layer.kind}</span>}
      </h3>
      {layer.refused && <div className="ctx-why">{layer.refused}</div>}
      {!layer.refused && layer.canvasId && layer.pieces.length === 0 && (
        <div className="ctx-why">Nothing to inherit yet — no design system, no pins.</div>
      )}
      {children}
      {layer.pieces.map((piece) => (
        <div
          key={piece.name}
          className={`ctx-row${layer.kind === "inherited" && piece.name === "Recent work" ? " ctx-recent-work" : ""}${piece.present ? "" : " absent"}${piece.stale ? " stale" : ""}${piece.overridden ? " overridden" : ""}`}
        >
          <div className="ctx-line">
            <span className="ctx-name">{piece.name}</span>
            {piece.from && <span className="ctx-from">from {piece.from.title}</span>}
            <span className="ctx-size">{piece.present ? (piece.size ?? "yes") : "not here"}</span>
          </div>
          {/* Struck rather than hidden: what the link WOULD have contributed
              is still a fact worth reading, and "this canvas's wins" is why. */}
          {piece.overridden && <div className="ctx-why">{piece.overridden}</div>}
          {/* A reason, never a bare flag: "3 items have changed since it was
              last written" is actionable, and a warning triangle is an
              accusation. */}
          {piece.stale && <div className="ctx-why">{piece.stale}</div>}
          {piece.recap && <p className="ctx-recap" data-source-canvas={piece.recap.canvasId}>{formatRecapHead(piece.recap.head)}</p>}
          {piece.fix && (piece.stale || !piece.present) && (
            <div className="ctx-fix">{piece.fix}</div>
          )}
        </div>
      ))}
    </section>
  );
}
