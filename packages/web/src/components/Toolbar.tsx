import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GROUND_MAX_BYTES,
  anchorOf,
  anchorPatch,
  cursorOf,
  cursorPatch,
  groundOf,
  groundPatch,
  noCursorPatch,
  noThemePatch,
  themeOf,
  themePatch,
  workbenchPath,
  modulePagePath,
  type Actor,
} from "@isocan/core";
import { sendOp, uploadBlob } from "../lib/api.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useUnreadNews } from "./WhatsNew.tsx";
import { showMenu } from "../lib/chromemenu.tsx";
import { HomeGlyph } from "./Glyphs.tsx";
import { Presence } from "./Presence.tsx";
import { CanvasEditor } from "./CanvasEditor.tsx";
import { IdentityMenu } from "./IdentityMenu.tsx";
import { CanvasPresence, CanvasTitle, ShareButton} from "./CanvasCrumb.tsx";
import { useCanEdit } from "../lib/capability.ts";
import { moduleProjectViews } from "../modules.ts";

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
  const cursorGlow = useUiStore((s) => s.cursorGlow);
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
  /**
   * **The picker for a ground of your own** (#204 phase 2).
   *
   * A hidden input the menu row clicks, which is how the rail's File button
   * already asks for a file — a browser only opens a file dialog from a real
   * user gesture on a real input, so this cannot be `showOpenFilePicker` in a
   * menu callback on every browser that matters.
   *
   * The size is refused HERE and the refusal names the number, because the
   * cost is real and specific: the seeded grounds are generated and cost
   * nothing, and a picture is downloaded by everybody on this canvas on every
   * cold load, forever. `GROUND_MAX_BYTES` is core's, so `isocan canvas
   * background --picture` refuses exactly the same file with the same number.
   */
  const groundInput = useRef<HTMLInputElement>(null);

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
            onClick={async (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              // Read the button's box before the await: the element is still
              // here, but `currentTarget` is not once the handler yields.
              const { chromeMenu } = await import("../lib/menuentries.tsx");
              const contents = useCanvasStore.getState().canvas;
              const views = contents ? moduleProjectViews(canvas, contents) : [];
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
                  cursorGlow,
                  theme: themeOf(canvas),
                  anchor: anchorOf(canvas),
                  toggleAnchor: async () => {
                    await sendEchoed(canvas.id, actor, {
                      type: "project.update",
                      patch: anchorPatch(anchorOf(canvas) === "window" ? "world" : "window"),
                    });
                  },
                  /**
                   * One `project.update`, the same op `isocan canvas
                   * background` sends — so the two surfaces cannot disagree
                   * about what a background IS. Cycling wraps back through
                   * none, so the row that puts one on is also the row that
                   * takes it off.
                   */
                  openSwitcher: () => useUiStore.getState().setPaletteOpen("canvases"),
                  setTheme: async (theme) => {
                    await sendEchoed(canvas.id, actor, {
                      type: "project.update",
                      patch: theme === null ? noThemePatch() : themePatch(theme),
                    });
                  },
                  ownGround: groundOf(canvas) !== null,
                  pickGround: () => groundInput.current?.click(),
                  cursor: cursorOf(canvas),
                  setCursor: async (cursor) => {
                    await sendEchoed(canvas.id, actor, {
                      type: "project.update",
                      patch: cursor === null ? noCursorPatch() : cursorPatch(cursor),
                    });
                  },
                  canEdit,
                  toWorkbench: () => navigate(workbenchPath(canvas.id)),
                  projectViews: views.map((view) => ({ label: view.label, run: () => navigate(modulePagePath(canvas.id, view.segment)) })),
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
      {canvas && (
        <input
          ref={groundInput}
          type="file"
          hidden
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            // Reset first: picking the SAME file twice must fire `change` the
            // second time, and an input that still holds it will not.
            e.target.value = "";
            if (!file) return;
            if (file.size > GROUND_MAX_BYTES) {
              setNotice(
                `“${file.name}” is ${Math.round(file.size / 1000)}kB — a background may be ` +
                  `${GROUND_MAX_BYTES / 1_000_000}MB, because everybody on this canvas downloads it ` +
                  "on every cold load.",
              );
              return;
            }
            try {
              const up = await uploadBlob(canvas.id, file, file.name);
              await sendEchoed(canvas.id, actor, {
                type: "project.update",
                patch: groundPatch(up.blobHash),
              });
            } catch {
              // The same sentence shape every other upload failure here uses:
              // name the file, say what did not happen, and leave the canvas
              // exactly as it was.
              setNotice(`“${file.name}” could not be made the background just now.`);
            }
          }}
        />
      )}
    </div>
  );
}
