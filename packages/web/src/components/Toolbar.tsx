import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { workbenchPath, type Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useUnreadNews } from "./WhatsNew.tsx";
import { chromeMenu } from "../lib/menuentries.tsx";
import { showMenu } from "../lib/chromemenu.tsx";
import { HomeGlyph } from "./Glyphs.tsx";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import { CanvasPresence, CanvasTitle, ShareButton} from "./CanvasCrumb.tsx";
import { useCanEdit } from "../lib/capability.ts";

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
  const filesOpen = useUiStore((s) => s.filesPanelOpen);
  const agentsOpen = useUiStore((s) => s.agentsPanelOpen);
  const mainOpen = useUiStore((s) => s.mainPanelOpen);
  const contextOpen = useUiStore((s) => s.contextPanelOpen);
  const personasOpen = useUiStore((s) => s.personasPanelOpen);
  const minimapOpen = useUiStore((s) => s.minimapOpen);
  const historyOpen = useUiStore((s) => s.historyOpen);
  const unreadNews = useUnreadNews();
  const identityOpen = useUiStore((s) => s.identityOpen);
  const shareOpen = useUiStore((s) => s.shareOpen);
  const trashCount = useCanvasStore((s) => s.canvas?.trash.length ?? 0);
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const nameRef = useDismissOnOutside<HTMLDivElement>(editing, () => setEditing(false));
  const identityRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () =>
    useUiStore.getState().setIdentityOpen(false),
  );
  const shareRef = useDismissOnOutside<HTMLDivElement>(shareOpen, () =>
    useUiStore.getState().setShareOpen(false),
  );

  return (
    /**
     * **Three floating clusters, not a bar.**
     *
     * This was a full-width slab with its own ground and a hairline under it,
     * which cut the canvas off at 48px and made the top of the surface
     * somebody else's. The canvas runs edge to edge now and the controls sit
     * ON it, in groups, wearing the same frosted slab the rail wears — one
     * language for everything that floats.
     *
     * The clusters carry the grouping the bar used to state with a `spacer`:
     * what you are LOOKING AT on the left, what you can DO on the right. That
     * was already true and invisible; separating them says it.
     *
     * **Nothing moved out of reach.** Every control the bar had is still here
     * and still one click away. Folding Files, trash and the rest behind a
     * `···` is the other half of phase 6 and the place "do not lose features"
     * is most at risk, so it is deliberately not bundled into a restyle.
     */
    <div className="toolbar" onContextMenu={(e) => showMenu(e, "the top edge")}>
      <div className="bar-cluster floats">
        <Link className="home" to="/" title="All canvases" aria-label="All canvases">
          <HomeGlyph />
        </Link>
        <CanvasTitle actor={actor} />
        {canvas && (
          <button
            className="btn drawer-handle"
            title="Files, trash, the map and the shortcut list"
            aria-label="More"
            aria-haspopup="menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              useUiStore.getState().setContextMenu({
                // Under the handle, aligned to its left edge — a menu that
                // opens where the pointer happened to be is right for a
                // right-click and wrong for a button, which has a place.
                at: { x: r.left, y: r.bottom + 6 },
                entries: chromeMenu({
                  canvasId: canvas.id,
                  filesOpen,
                  agentsOpen,
                  mainOpen,
                  contextOpen,
                  personasOpen,
                  trashOpen,
                  trashCount,
                  historyOpen,
                  unreadNews,
                  minimapOpen,
                  canEdit,
                  toWorkbench: () => navigate(workbenchPath(canvas.id)),
                }),
              });
            }}
          >
            ···
          </button>
        )}
      </div>
      <span className="spacer" />
      {/* **Two clusters, not one.**
          `⌗ Workbench  ● live  Share` put a STATUS between two buttons, which
          reads as a broken row — you scan buttons, hit a green dot, and have
          to start again. Workbench navigates and stands alone; `live`, the
          faces and your own badge are one subject — who is in the room — and
          Share belongs with them because it is that subject from the other
          side: who may come in. */}
      {/* The way into the workbench, said out loud. It was `W` and nothing
          else — a door only people who had read the shortcut list could find
          — and the workbench has had a visible `← Canvas` since the day it
          shipped, so the two directions were not even the same kind of thing.
          Deliberately NOT a segmented pill beside `Chat | Files`: those
          toggle a dock and can both be off, this navigates and one view is
          always true. Same shape would promise the same rules. */}
      {/* Share is the one thing left in the bar that DOES something — the
          workbench moved into the drawer, where the rest of the going-places
          lives. `live`, the faces and your own badge share the other pill,
          because those are things you read. */}
      <div className="bar-cluster floats">
        <ShareButton actor={actor} />
      </div>
      <div className="bar-cluster floats presence-cluster">
      {/* RIGHT: things you look up, and the way out. Nothing here MAKES an
          item any more — the two that did (upload, then Site) both went to
          the tool rail, which is where a canvas keeps the things that put
          content on it. */}
      <CanvasPresence actor={actor} onIdentity={onIdentity} />
      </div>
    </div>
  );
}
