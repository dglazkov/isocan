import { useEffect, useState } from "react";
import { blobUrl } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import {
  edgeBeacons,
  formatDistance,
  type Beacon,
  type Insets,
  type RadarItem,
} from "../lib/edgeradar.ts";
import { glideToBox, glideToPoint } from "../lib/zoomactions.ts";
import { PANEL_WIDTH } from "./MainThreadPanel.tsx";

/**
 * Beacons around the rim for items that have panned out of sight: which way
 * they are, how far, and a click to go. An infinite canvas is the one surface
 * where "I know it is over there somewhere" is a real cost, and the minimap
 * answers a different question (where is everything) than this one (what did I
 * just walk away from).
 *
 * The rim clears the furniture rather than sitting under it — the top bar, the
 * tool rail, the zoom controls, the minimap, and the main-thread panel when it
 * is open (see INSETS).
 */

const INSETS: Insets = {
  top: 64, // the top bar
  right: 76, // the tool rail
  bottom: 72, // zoom controls / minimap
  left: 24,
};

export function EdgeRadar({ projectId }: { projectId: string }) {
  const items = useCanvasStore((s) => s.canvas?.items);
  const viewport = useUiStore((s) => s.viewport);
  // Either panel holds the same dock, and the rim has to clear whichever
  // one is showing.
  const panelOpen = useUiStore((s) => s.mainPanelOpen || s.filesPanelOpen);
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!items) return null;
  const all = Object.values(items);
  if (all.length === 0) return null;

  const insets: Insets = panelOpen ? { ...INSETS, left: INSETS.left + PANEL_WIDTH } : INSETS;
  const beacons = edgeBeacons(all, viewport, size.width, size.height, insets);
  if (beacons.length === 0) return null;

  return (
    <div className="edge-radar">
      {beacons.map((beacon) => (
        <EdgeBeacon
          key={beacon.primary.id}
          beacon={beacon}
          insets={insets}
          projectId={projectId}
          hovered={hovered === beacon.primary.id}
          onHover={setHovered}
        />
      ))}
    </div>
  );
}

/** At most this many rows before the card says "and N more". */
const MAX_ROWS = 6;

/** How thick a bar is, and how far the card floats off the wall. */
const BAR = 7;

function EdgeBeacon({
  beacon,
  insets,
  projectId,
  hovered,
  onHover,
}: {
  beacon: Beacon;
  insets: Insets;
  projectId: string;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const count = beacon.members.length;
  const item = beacon.primary;
  const vertical = beacon.side === "left" || beacon.side === "right";

  /** One item: select it and glide it to the middle of the window. */
  function goTo(target: RadarItem) {
    useUiStore.getState().select(target.id);
    glideToPoint(target.x + target.width / 2, target.y + target.height / 2);
  }

  /** The bar: one item goes to it, a cluster fits everything it stands for —
   * a cluster is a place, not a thing. */
  function goToCluster() {
    if (count === 1) return goTo(item);
    const items = beacon.members.map((member) => member.item);
    useUiStore.getState().setSelection(items.map((one) => one.id));
    glideToBox({
      minX: Math.min(...items.map((one) => one.x)),
      minY: Math.min(...items.map((one) => one.y)),
      maxX: Math.max(...items.map((one) => one.x + one.width)),
      maxY: Math.max(...items.map((one) => one.y + one.height)),
    });
  }

  // The bar lies along its wall and covers the stretch the items out there
  // would occupy — so the rim reads as a shadow of what is off screen, and
  // nothing juts into the canvas.
  //
  // "Its wall" is the INSET wall, not the window's edge: the window's top edge
  // is under the toolbar, its left edge is under whichever panel is docked, and
  // a beacon painted there is a beacon nobody sees. The insets are the same
  // ones the ray was clipped to, so the bar lands exactly where the docking
  // math already put it.
  const length = beacon.span.to - beacon.span.from;
  const wall = insets[beacon.side];
  const place = vertical
    ? { top: beacon.span.from, height: length, [beacon.side]: wall }
    : { left: beacon.span.from, width: length, [beacon.side]: wall };

  // The card opens inward from the wall, centered on the bar.
  const middle = beacon.span.from + length / 2;
  const cardPlace = vertical
    ? { top: middle, [beacon.side === "left" ? "left" : "right"]: wall + BAR + 8 }
    : { left: middle, [beacon.side === "top" ? "top" : "bottom"]: wall + BAR + 8 };

  const shown = beacon.members.slice(0, MAX_ROWS);
  const hidden = count - shown.length;
  const summary = count === 1 ? item.title : `${count} items this way`;

  return (
    <>
      <button
        className={`edge-bar edge-bar-${beacon.side}${hovered ? " hot" : ""}`}
        style={place as React.CSSProperties}
        onClick={goToCluster}
        onPointerEnter={() => onHover(item.id)}
        onPointerLeave={() => onHover(null)}
        aria-label={`${summary}, ${formatDistance(beacon.distance)}`}
        title={summary}
      />
      {hovered && (
        <div
          className={`beacon-card beacon-card-${vertical ? "v" : "h"} beacon-card-${beacon.side}`}
          style={cardPlace as React.CSSProperties}
          onPointerEnter={() => onHover(item.id)}
          onPointerLeave={() => onHover(null)}
        >
          {count > 1 && <div className="beacon-head">{summary}</div>}
          {shown.map((member) => (
            <button
              key={member.item.id}
              className="beacon-row"
              onClick={() => goTo(member.item)}
              title={`Go to ${member.item.title}`}
            >
              <Thumbnail projectId={projectId} itemId={member.item.id} />
              <span className="beacon-card-text">
                <b>{member.item.title}</b>
                <i>{formatDistance(member.distance)}</i>
              </span>
            </button>
          ))}
          {hidden > 0 && <div className="beacon-more">and {hidden} more this way</div>}
        </div>
      )}
    </>
  );
}

/** A picture if the item is one, otherwise the letter it starts with. */
function Thumbnail({ projectId, itemId }: { projectId: string; itemId: string }) {
  const item = useCanvasStore((s) => s.canvas?.items[itemId]);
  if (!item) return null;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (current?.mimeType.startsWith("image/")) {
    return <img className="beacon-thumb" src={blobUrl(projectId, current.blobHash)} alt="" />;
  }
  return <span className="beacon-thumb beacon-thumb-glyph">{item.title.charAt(0).toUpperCase()}</span>;
}
