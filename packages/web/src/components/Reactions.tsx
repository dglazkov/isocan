import { useRef, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { hasReacted, reactionsOf } from "@isocan/core";
import { applyLocalEcho, useCanvasStore } from "../stores/canvasStore.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";
import { rememberEmoji } from "../lib/recentEmoji.ts";
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
  visible,
}: {
  canvasId: string;
  item: Item;
  actor: Actor;
  /**
   * Whether this item is SELECTED — decides only whether the `+` shows, never
   * whether existing reactions do.
   *
   * Hover used to count too, and it could not work. The `+` sits under the
   * item and its picker opens under THAT, so the trip from the button to the
   * emoji you want leaves the item — hover ends, `visible` goes false, and the
   * picker unmounts somewhere in the middle of the journey. You could open it
   * and never click it, which is the worst of the three possible states
   * because it looks like it works.
   *
   * The usual patch is a close-delay or an invisible bridge over the gap
   * between the two. Selection is already the sticky version of exactly this
   * signal — you clicked the thing, it stays clicked — so gating on it makes
   * the bug unreachable instead of narrow.
   */
  visible: boolean;
}) {
  const names = useActorNames();
  const [picking, setPicking] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
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
    // Only ADDING a mark is a reach worth remembering. Taking yours back is
    // the opposite gesture, and promoting it would put the thing you just
    // rejected at the front of the list next time.
    if (op.on) rememberEmoji(emoji);
    setPicking(false);
  }

  return (
    <div
      className="item-reactions"
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
            ref={addButton}
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
            <EmojiPicker
              anchor={addButton}
              worn={reactions.map((one) => one.emoji)}
              onPick={toggle}
              onClose={() => setPicking(false)}
            />
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
