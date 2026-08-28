import { useState } from "react";
import { Link } from "react-router-dom";
import { workbenchPath, type Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { PanelSwitch } from "./CreateActions.tsx";
import { CanvasPresence, CanvasTitle } from "./CanvasCrumb.tsx";

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
      <CanvasTitle actor={actor} />
      {/* LEFT: what you are looking at. Both toggles drive the same dock and
          only one can win, so they read as one control with two settings. */}
      {canvas && <PanelSwitch canvasId={canvas.id} actor={actor} />}
      <span className="spacer" />
      {/* The way into the workbench, said out loud. It was `W` and nothing
          else — a door only people who had read the shortcut list could find
          — and the workbench has had a visible `← Canvas` since the day it
          shipped, so the two directions were not even the same kind of thing.
          Deliberately NOT a segmented pill beside `Chat | Files`: those
          toggle a dock and can both be off, this navigates and one view is
          always true. Same shape would promise the same rules. */}
      {canvas && (
        <Link
          className="btn wb-enter"
          to={workbenchPath(canvas.id)}
          title="Workbench — the agents, the files and the thread around one screen (W)"
        >
          ⌗ Workbench
        </Link>
      )}
      {/* RIGHT: things you look up, and the way out. Nothing here MAKES an
          item any more — the two that did (upload, then Site) both went to
          the tool rail, which is where a canvas keeps the things that put
          content on it. */}
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
      <CanvasPresence actor={actor} onIdentity={onIdentity} />
    </div>
  );
}
