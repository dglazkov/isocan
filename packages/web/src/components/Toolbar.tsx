import { useState } from "react";
import { Link } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { CreateActions, PanelSwitch } from "./CreateActions.tsx";

/**
 * The top bar: where you are (canvas name, whether you're live, who's here) and
 * what you bring onto the canvas (File, Site, Main). Interaction tools live on
 * the right rail; navigation (zoom/undo) bottom-right. The canvas's own name is
 * renamed where you read it.
 */
export function Toolbar({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const canvas = useCanvasStore((s) => s.project);
  const connection = useCanvasStore((s) => s.connection);
  const trashOpen = useUiStore((s) => s.trashOpen);
  const identityOpen = useUiStore((s) => s.identityOpen);
  const shareOpen = useUiStore((s) => s.shareOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);
  const [editing, setEditing] = useState(false);
  const nameRef = useDismissOnOutside<HTMLDivElement>(editing, () => setEditing(false));
  const identityRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () =>
    useUiStore.getState().setIdentityOpen(false),
  );
  const shareRef = useDismissOnOutside<HTMLDivElement>(shareOpen, () =>
    useUiStore.getState().setShareOpen(false),
  );

  return (
    <div className="toolbar">
      <Link className="home" to="/" title="All canvases">
        ⌂
      </Link>
      <div className="canvas-name" ref={nameRef}>
        <button
          className="title"
          disabled={!canvas}
          title={
            canvas
              ? `${canvas.description ? `${canvas.description}\n\n` : ""}Rename this canvas`
              : undefined
          }
          onClick={() => setEditing(!editing)}
        >
          {canvas?.title ?? "…"}
        </button>
        {editing && canvas && (
          <div className="canvas-popover">
            <CanvasEditor
              title={canvas.title}
              description={canvas.description}
              onSave={async (patch) => {
                await sendOp(canvas.id, actor, { type: "project.update", patch });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
      </div>
      {/* LEFT: what you are looking at. Both toggles drive the same dock and
          only one can win, so they read as one control with two settings. */}
      {canvas && <PanelSwitch canvasId={canvas.id} actor={actor} />}
      <span className="spacer" />
      <span className={`conn ${connection}`}>{connection}</span>
      {/* RIGHT: things you DO, and things you look up. An action makes
          something and is over; it does not belong beside a toggle that stays
          where you put it. */}
      {canvas && <CreateActions canvasId={canvas.id} actor={actor} />}
      <button
        className={`btn${trashOpen ? " active" : ""}`}
        onClick={() => useUiStore.getState().setTrashOpen(!trashOpen)}
      >
        🗑{trashCount > 0 ? ` ${trashCount}` : ""}
      </button>
      {/* A shortcut nobody can find is a shortcut nobody has. */}
      <button
        className="btn help-btn"
        title="What this canvas answers to (?)"
        aria-label="Help"
        onClick={() => {
          const ui = useUiStore.getState();
          ui.setHelpOpen(!ui.helpOpen);
        }}
      >
        ?
      </button>
      {/* Who may be here, next to who is here — the facepile and Share are the
          same subject, which is why the journey puts them shoulder to
          shoulder. */}
      <div className="identity-anchor" ref={shareRef}>
        <button
          className={`btn${shareOpen ? " active" : ""}`}
          title="Who may enter this canvas"
          disabled={!canvas}
          onClick={() => useUiStore.getState().setShareOpen(!shareOpen)}
        >
          Share
        </button>
        {shareOpen && canvas && (
          <div className="identity-popover share-popover">
            <ShareDialog
              actor={actor}
              onClose={() => useUiStore.getState().setShareOpen(false)}
            />
          </div>
        )}
      </div>
      {/* The pile is where you see everyone else; your own face in it is the
          handle for being someone else. */}
      <div className="identity-anchor" ref={identityRef}>
        <Presence actor={actor} />
        {identityOpen && (
          <div className="identity-popover">
            <IdentityMenu
              actor={actor}
              canvasId={canvas?.id ?? null}
              onIdentity={onIdentity}
              onClose={() => useUiStore.getState().setIdentityOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
