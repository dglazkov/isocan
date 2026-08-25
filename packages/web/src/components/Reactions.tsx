import { useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { QUICK_REACTIONS, hasReacted, reactionsOf } from "@isocan/core";
import { applyLocalEcho, useCanvasStore } from "../stores/canvasStore.ts";
import { counterScale } from "../lib/chrome.ts";
import { sendOp } from "../lib/api.ts";
import { useActorNames } from "../lib/names.ts";

/**
 * The marks an item is wearing, and the way to add one.
 *
 * **Slack's shape, because it is the one people already know**: a row of chips
 * under the thing, each showing an emoji and how many wear it, each a toggle
 * for your own. The count is the number of distinct actors — never a number
 * anybody increments, which is the whole reason `item.react` is an operation
 * and not a property (see `Item.reactions`).
 *
 * The row is PERSISTENT, unlike the size chip and the interact hint that share
 * the strip below it: a reaction is something the item is wearing, not
 * something about your current gesture, so it must be visible without
 * selecting or hovering. The `+` is the part that waits to be asked for.
 */
export function Reactions({
  canvasId,
  item,
  actor,
  scale,
  visible,
}: {
  canvasId: string;
  item: Item;
  actor: Actor;
  /** The viewport's zoom, so the row can hold its size against it. Chrome
   * lives inside the scaled world; without this the chips are drawn in WORLD
   * pixels and a canvas at 15% shows an 11px chip as under two. */
  scale: number;
  /** Whether the item is hovered or selected — decides only whether the `+`
   * shows, never whether existing reactions do. */
  visible: boolean;
}) {
  const names = useActorNames();
  const [picking, setPicking] = useState(false);
  const reactions = reactionsOf(item, actor.id);
  if (reactions.length === 0 && !visible) return null;

  function toggle(emoji: string) {
    // The op says what should be TRUE rather than "flip it", so a double
    // click and a race both land on the same answer.
    const op = {
      type: "item.react",
      itemId: item.id,
      emoji,
      on: !hasReacted(item, emoji, actor.id),
    } as const;
    applyLocalEcho(op, actor);
    void sendOp(canvasId, actor, op);
    setPicking(false);
  }

  return (
    <div
      className="item-reactions"
      // A mark is a label on the item, not part of it: it stays the size of a
      // chip however far out you zoom, exactly as the name above it does.
      style={counterScale(scale)}
      // The strip under an item is `pointer-events: none` so a hint never eats
      // a click meant for the canvas. These ARE controls (lessons.md #20).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          className={`react-chip${reaction.mine ? " mine" : ""}`}
          // Who, by the name they answer to NOW — a reaction stores ids only.
          title={`${reaction.actorIds
            .map((id) => names[id] ?? id)
            .join(", ")} — click to ${reaction.mine ? "take yours back" : "add yours"}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle(reaction.emoji);
          }}
        >
          <span className="react-emoji">{reaction.emoji}</span>
          <span className="react-count">{reaction.count}</span>
        </button>
      ))}
      {visible && (
        <span className="react-add-wrap">
          <button
            className="react-add"
            title="React"
            aria-label="React to this item"
            aria-expanded={picking}
            onClick={(e) => {
              e.stopPropagation();
              setPicking((open) => !open);
            }}
          >
            ＋
          </button>
          {picking && (
            <span className="react-picker" role="menu">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="react-option"
                  role="menuitem"
                  title={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Whether anything is wearing a mark — the canvas asks before it makes room. */
export function useHasReactions(itemId: string): boolean {
  return useCanvasStore(
    (s) => Object.keys(s.canvas?.items[itemId]?.reactions ?? {}).length > 0,
  );
}
