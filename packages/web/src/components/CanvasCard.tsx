import { useEffect, useState } from "react";
import type { CanvasContents, Item } from "@isocan/core";
import { isArea, isCanvasItem, itemKind } from "@isocan/core";
import { blobUrl, fetchPresenceWhere, getSnapshot } from "../lib/api.ts";

/**
 * **A canvas, drawn small and live** (`docs/projects/inception/design.md`).
 *
 * The other canvas's snapshot, pulled on mount and every half minute while
 * this card is on screen, laid out as a picture of a place: every item as a
 * block at its position, images as themselves, text as its words, sheets as
 * their washes — scaled to fit, the way the minimap fits a canvas into its
 * corner. You can tell a busy canvas from an empty one and a board from a
 * pile at a glance, and a rename on the other canvas reaches the strip
 * within one pull.
 *
 * **One level deep.** A canvas item found inside the other canvas is drawn
 * as a plain block with its title, never as a further picture: a canvas that
 * contains itself, or two that contain each other, is a card and not a
 * recursion.
 *
 * **Never a blank rectangle.** A pull that the door refuses — somebody not
 * admitted to the other canvas — or that fails offline says so in words on
 * the card, with the ↗ still there; the site item's first lesson was that a
 * blank frame with no explanation reads as a bug.
 */
const PULL_MS = 30_000;
/** How many items the picture draws before it stops: enough for any real
 *  canvas to read as itself, few enough that a pile of a thousand does not
 *  cost a thousand nodes in a card. */
const MOST_ITEMS = 120;

export function CanvasCard({
  canvasId,
  width,
  height,
  picture = null,
  source = null,
}: {
  canvasId: string;
  width: number;
  height: number;
  /** A screenshot version of this item, when one was taken — the picture
   *  that survives a pull the door refuses. Never preferred over live. */
  picture?: string | null;
  /** The address the item points at: a canvas at another home cannot be
   *  pulled from this one (phase 4), and the card says so rather than
   *  asking a door that will not answer. */
  source?: string | null;
}) {
  const elsewhere = (() => {
    if (!source) return null;
    try {
      const origin = new URL(source).origin;
      return origin === window.location.origin ? null : origin;
    } catch {
      return null;
    }
  })();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; title: string; canvas: CanvasContents; here: number }
    | { kind: "refused"; why: string }
  >(elsewhere ? { kind: "refused", why: `Lives at ${elsewhere.replace(/^https?:\/\//, "")} — open it there.` } : { kind: "loading" });

  useEffect(() => {
    if (elsewhere) return;
    let live = true;
    const pull = async () => {
      try {
        const [snapshot, presence] = await Promise.all([
          getSnapshot(canvasId),
          fetchPresenceWhere().catch(() => ({ where: [] })),
        ]);
        if (!live) return;
        const here = new Set(presence.where.filter((row) => row.canvasId === canvasId).map((row) => row.actor.id)).size;
        setState({ kind: "ready", title: snapshot.project.title, canvas: snapshot.canvas, here });
      } catch (err) {
        if (!live) return;
        // A refusal at the door is the common case and has a plain meaning;
        // anything else is said as what it is.
        const status = (err as { status?: number }).status;
        setState({
          kind: "refused",
          why:
            status === 401 || status === 403
              ? "You are not admitted to this canvas — open it to ask at its door."
              : "This canvas could not be read right now.",
        });
      }
    };
    void pull();
    const timer = setInterval(() => void pull(), PULL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [canvasId, elsewhere]);

  if (state.kind === "loading") return <div className="canvas-embed canvas-embed-note">Looking…</div>;
  if (state.kind === "refused") {
    // The screenshot, when there is one, with the reason under it; the words
    // alone otherwise. Never a blank rectangle.
    return (
      <div className="canvas-embed">
        {picture && <img className="canvas-embed-picture" src={picture} alt="" />}
        <div className="canvas-embed-note">{state.why}</div>
      </div>
    );
  }

  const items = Object.values(state.canvas.items);
  const count = items.filter((one) => !isArea(one)).length;
  return (
    <div className="canvas-embed">
      <div className="canvas-embed-head">
        <span className="canvas-embed-title">{state.title}</span>
        <span className="canvas-embed-meta">
          {count} item{count === 1 ? "" : "s"}
          {state.here > 0 ? ` · ${state.here} here` : ""}
        </span>
      </div>
      <Miniature canvasId={canvasId} items={items} width={width} height={Math.max(0, height - 40)} />
    </div>
  );
}

/**
 * The picture: every item as a block at its place, fitted into the box. Areas
 * first so their washes sit under what is on them, images as themselves,
 * text and everything else as a block in the kind's colour with its title
 * when there is room to read it.
 */
function Miniature({ canvasId, items, width, height }: { canvasId: string; items: Item[]; width: number; height: number }) {
  if (items.length === 0) return <div className="canvas-embed-note">Nothing on it yet.</div>;
  const minX = Math.min(...items.map((one) => one.x));
  const minY = Math.min(...items.map((one) => one.y));
  const maxX = Math.max(...items.map((one) => one.x + one.width));
  const maxY = Math.max(...items.map((one) => one.y + one.height));
  const pad = 16;
  const scale = Math.min((width - pad * 2) / Math.max(1, maxX - minX), (height - pad * 2) / Math.max(1, maxY - minY));
  const offsetX = pad + ((width - pad * 2) - (maxX - minX) * scale) / 2;
  const offsetY = pad + ((height - pad * 2) - (maxY - minY) * scale) / 2;
  const ordered = [...items].sort((a, b) => Number(isArea(b)) - Number(isArea(a))).slice(0, MOST_ITEMS);
  return (
    <div className="canvas-mini" style={{ width, height }} aria-hidden>
      {ordered.map((one) => {
        const kind = isArea(one) ? "area" : itemKind(one);
        const box = {
          left: offsetX + (one.x - minX) * scale,
          top: offsetY + (one.y - minY) * scale,
          width: Math.max(2, one.width * scale),
          height: Math.max(2, one.height * scale),
        };
        const current = one.versions.find((v) => v.id === one.currentVersionId) ?? one.versions[0];
        const picture = kind === "image" && current ? blobUrl(canvasId, current.blobHash) : null;
        // One level deep: a canvas inside the picture is a block, not a picture.
        const label = box.width > 60 && box.height > 14 ? one.title : "";
        return (
          <span
            key={one.id}
            className={`canvas-mini-item kind-${kind}${isCanvasItem(one) ? " nested" : ""}`}
            style={{ ...box, ...(picture ? { backgroundImage: `url(${picture})` } : {}) }}
            title={one.title}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
