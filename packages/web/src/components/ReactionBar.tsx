import { useState } from "react";
import type { Item } from "@isocan/core";
import { reactionGroups } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { ItemThumb } from "./ItemThumb.tsx";

/** How many marks the bar shows before it folds. Enough for a team's whole
 * vocabulary at a glance; past it, the tail is a click away rather than a
 * scroll nobody reaches the end of. */
const SHOWN_GROUPS = 5;

/** How wide the bar stands, for `lib/stage.ts` — the one place that computes
 * what canvas is left visible. */
export const MARKS_WIDTH = 232;

const KEY = (canvasId: string) => `isocan.reactions.${canvasId}`;

export function openReactionBar(canvasId: string, open: boolean): void {
  try {
    if (open) localStorage.setItem(KEY(canvasId), "1");
    else localStorage.removeItem(KEY(canvasId));
  } catch {
    // Storage denied: the choice holds for this session and no longer.
  }
  useUiStore.getState().setMarksOpen(open);
}

export function restoreReactionBar(canvasId: string): void {
  try {
    useUiStore.getState().setMarksOpen(localStorage.getItem(KEY(canvasId)) === "1");
  } catch {
    useUiStore.getState().setMarksOpen(false);
  }
}

/**
 * The canvas grouped by the marks on it.
 *
 * **This was the starred shortlist, and the swap is a simplification rather
 * than a feature.** A star was one shared bit — on or off, canvas-wide, with
 * nobody's name on it — so a team that wanted "needs review" AND "signed off"
 * AND "in progress" had one flag and an argument about what it meant. The
 * marks people were already putting on items answer all three and cost nothing
 * to invent: 👀 is review, 🚧 is in flight, ✅ is done, ⭐ is still ⭐, and
 * none of that had to be designed.
 *
 * Everyone's reactions, because the bar is a board. A board showing only your
 * own marks would answer a question nobody has.
 */
export function ReactionBar({ canvasId }: { canvasId: string }) {
  const open = useUiStore((s) => s.marksOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const selected = useUiStore((s) => s.selectedItemIds);
  const [expanded, setExpanded] = useState(false);
  if (!open || !canvas) return null;
  const groups = reactionGroups(canvas);
  const shown = expanded ? groups : groups.slice(0, SHOWN_GROUPS);
  const folded = groups.length - shown.length;

  function goTo(item: Item) {
    useUiStore.getState().select(item.id);
    // Fit into the canvas this bar leaves visible, so the thing you asked for
    // does not land underneath the list you asked from.
    glideToBox({ minX: item.x, minY: item.y, maxX: item.x + item.width, maxY: item.y + item.height });
  }

  return (
    <aside className="marks" aria-label="Reactions">
      <header>
        <span className="marks-glyph">☺</span>
        <b>Reactions</b>
        <span className="spacer" />
        <button
          className="main-close"
          title="Close"
          aria-label="Close the reactions bar"
          onClick={() => openReactionBar(canvasId, false)}
        >
          ✕
        </button>
      </header>
      {groups.length === 0 ? (
        <p className="marks-empty">
          No marks yet. Point at a screen and press the ＋ under it — whatever your
          team decides 👀 or ✅ means, this is where it adds up.
        </p>
      ) : (
        <div className="marks-list">
          {shown.map((group) => (
            <section key={group.emoji} className="react-group">
              <h3 className="react-group-head">
                <span className="react-group-emoji">{group.emoji}</span>
                <i>{group.count}</i>
              </h3>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`mark-row${selected.includes(item.id) ? " active" : ""}`}
                  onClick={() => goTo(item)}
                  onPointerEnter={() => useUiStore.getState().setPeeked(item.id)}
                  onPointerLeave={() => useUiStore.getState().setPeeked(null)}
                  title={`Go to ${item.title}`}
                >
                  <span className="mark-shot">
                    <ItemThumb canvasId={canvasId} itemId={item.id} width={200} height={92} />
                  </span>
                  <span className="mark-name">
                    {/* How many PEOPLE wear it here, which is the other count
                        and the one that says whether it is AGREED.

                        Shown only past one. Every row in a group has at least
                        one by definition — that is what put it in the group —
                        so a column of "1"s is a number that cannot vary,
                        printed next to every name. Past one it starts saying
                        something: three people called this blocked. */}
                    {(item.reactions?.[group.emoji]?.length ?? 0) > 1 && (
                      <b>{item.reactions![group.emoji]!.length}</b>
                    )}
                    {item.title}
                  </span>
                </button>
              ))}
            </section>
          ))}
          {folded > 0 && (
            <button className="react-more" onClick={() => setExpanded(true)}>
              {folded} more {folded === 1 ? "mark" : "marks"}
            </button>
          )}
          {expanded && groups.length > SHOWN_GROUPS && (
            <button className="react-more" onClick={() => setExpanded(false)}>
              Show fewer
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
