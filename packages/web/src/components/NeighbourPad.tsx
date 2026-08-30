import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { itemPath } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { countToward, findNextItem, type Direction } from "../lib/spatialnav.ts";
import { revealItem } from "../lib/zoomactions.ts";
import { ArrowGlyph } from "./Glyphs.tsx";

/**
 * **Which way there is something, in full screen.**
 *
 * ⌘← ⌘→ ⌘↑ ⌘↓ walk the canvas from the slide you are on, and until now nothing
 * said so — or said where the walk would land, or that it would land anywhere
 * at all. A person presenting a row of screens had to press a key to find out
 * whether there was a next one.
 *
 * **The arrows are exactly as true as the keystroke**, because they are the
 * same function: `findNextItem`, asked four times. An arrow appears if and only
 * if that direction would move, so the pad cannot drift from the behaviour it
 * advertises — which any hand-kept list of neighbours would do the first time
 * somebody added an item.
 *
 * **A row, not a cross — the second attempt.** The first laid the arrows out
 * in a 2D cross so that position said direction, which was wrong twice over on
 * a single-line bar: it stood taller than the pill beside it and dropped the
 * arrows below the bar's centreline, and it was solving a problem that does not
 * exist. **The glyph is already an arrow**, so it says which way it points
 * without help from where it sits. Position was carrying information the shape
 * had covered.
 *
 * So: one pill, in the same language as the "Edit text" beside it, holding only
 * the directions that exist. What you can do is still visible at a glance —
 * three arrows instead of four means you are against an edge — and the bar
 * keeps one line.
 *
 * Verticals in the middle (← ↑ ↓ →) so the pair reads as one axis rather than
 * as two arrows that happen to be adjacent.
 *
 * **They are buttons, not a legend.** A control that only describes a shortcut
 * is a footnote; clicking does what the key does. Resting on one names the
 * destination and the key that gets there, which is how the shortcut is taught
 * without a tooltip nobody opens.
 *
 * It inherits the bar's rest: full screen fades its chrome after a few still
 * seconds and deliberately does NOT wake on a keypress, because chrome that
 * blinks back on every slide is worse than chrome that stays. So the pad is
 * there while you are steering with a hand, and gone while you are presenting.
 */
/**
 * `where` is the words, and it is the half the pad was missing. Resting on an
 * arrow named the destination and the key but never said which WAY it was —
 * so a person had to work out the direction from a 10px glyph, which is the
 * one thing they were hovering to find out. Reported exactly that way.
 *
 * Written from the reader's position ("up there", "down here") rather than as
 * axis names, because that is how somebody standing on a slide describes the
 * canvas around them.
 */
const LAYOUT: Array<{ dir: Direction; cell: string; key: string; where: string }> = [
  { dir: "ArrowLeft", cell: "left", key: "⌘←", where: "to the left" },
  { dir: "ArrowUp", cell: "up", key: "⌘↑", where: "up there" },
  { dir: "ArrowDown", cell: "down", key: "⌘↓", where: "down here" },
  { dir: "ArrowRight", cell: "right", key: "⌘→", where: "to the right" },
];

/**
 * What resting on an arrow says: the direction first, then where the key
 * actually lands, then how much else is that way.
 *
 * The count is not decoration — "and 3 more" is the difference between the
 * last slide of a row and the middle of one, which is the question somebody
 * presenting is really asking. It comes from `countToward`, which shares
 * `isToward` with `findNextItem`, so the number can never describe a direction
 * the arrow would not actually travel.
 */
function neighbourLabel(where: string, title: string, beyond: number): string {
  const more = beyond > 0 ? `, and ${beyond} more` : "";
  return `${where}: ${title}${more}`;
}

export function NeighbourPad({ canvasId, itemId }: { canvasId: string; itemId: string }) {
  const navigate = useNavigate();
  const canvas = useCanvasStore((s) => s.canvas);

  /**
   * Four questions, asked of the canvas rather than remembered. Recomputed when
   * the items change or the slide does — which is what makes walking a row feel
   * like a map redrawing around you rather than a static badge.
   */
  const neighbours = useMemo(() => {
    const current = canvas?.items[itemId];
    if (!canvas || !current) return [];
    const all = Object.values(canvas.items);
    return LAYOUT.map((slot) => ({
      ...slot,
      to: findNextItem(current, all, slot.dir),
      // Everything that way, of which `to` is the one the key reaches first.
      toward: countToward(current, all, slot.dir),
    })).filter((slot): slot is typeof slot & { to: { id: string } } => slot.to !== null);
  }, [canvas, itemId]);

  // Nothing either way — a canvas of one — and the pad says so by not being
  // there. An empty cross is chrome that has nothing to offer.
  if (neighbours.length === 0) return null;

  return (
    <div className="neighbour-pad" role="group" aria-label="Go to the next thing on the canvas">
      {neighbours.map(({ dir, cell, key, where, to, toward }) => {
        const title = canvas?.items[to.id]?.title ?? "the next thing";
        const label = neighbourLabel(where, title, toward - 1);
        return (
          <button
            key={dir}
            className={`neighbour-arrow ${cell}`}
            title={`${label} · ${key}`}
            /* The same sentence a sighted person gets on hover — the direction
               is the thing a lone arrow glyph does not carry to a reader. */
            aria-label={`Go ${label}`}
            onClick={() => {
              useUiStore.getState().select(to.id);
              revealItem(to.id);
              // A navigation, like the Enter that got you here: the address
              // holds the slide, and Back retraces the walk.
              navigate(itemPath(canvasId, to.id));
            }}
          >
            <ArrowGlyph />
          </button>
        );
      })}
    </div>
  );
}
