import { useRef, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { agentActorIds, hasReacted, hidesVotes, reactionsOf } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { EmojiPicker } from "./EmojiPicker.tsx";
import { rememberEmoji } from "../lib/recentEmoji.ts";
import { useActorNames } from "../lib/names.ts";
import { useSprint } from "../lib/sprint.ts";
import { useCanEdit } from "../lib/capability.ts";

/**
 * Smiley with a plus in the corner — the standard add-a-reaction mark.
 *
 * The app draws one other face: `marksGlyph` on the tool rail
 * (CanvasTools.tsx), which is a STATE indicator — hollow when the canvas
 * wears no marks, solid when it does — where this one is a button with a
 * verb on it. They stay two drawings on purpose: merging them would hand one
 * path two jobs, and the first fill-state tweak would bend the button too.
 */
const SMILE_PLUS = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11v1a10 10 0 1 1-9-10" />
    <path d="M8 14a4 4 0 0 0 8 0" />
    <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    <path d="M16 5h6" />
    <path d="M19 2v6" />
  </svg>
);

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
  visible: selected,
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
  const canEdit = useCanEdit();
  // The `+` is offered to a SELECTED item held by somebody who may write: a
  // reader sees the marks an item wears and adds none (roles phase 1).
  const visible = selected && canEdit;
  const [picking, setPicking] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const reactions = reactionsOf(item, actor.id);
  /**
   * **The curtain, and the split tally** (core/sprint.ts). While a sprint's
   * vote phase is open the count and the names are not drawn — the mark is,
   * so the room can see dots are landing, and your own stays highlighted so
   * you know where yours went. Hidden by LENS: the record is untouched, and
   * `isocan sprint tally` reads it, because the facilitator is the referee.
   * While any sprint runs, a chip also says how many of its wearers are
   * agents — the second opinion, drawn apart from the vote.
   */
  const { state: sprint, nowMs } = useSprint();
  const veiled = hidesVotes(sprint, nowMs);
  const sessions = useCanvasStore((s) => s.sessions);
  const canvas = useCanvasStore((s) => s.canvas);
  const agents = sprint && canvas ? agentActorIds(sessions, canvas) : null;
  if (reactions.length === 0 && !visible) return null;

  function toggle(emoji: string) {
    if (!canEdit) return; // a mark is an op, and the daemon would refuse it
    // The op says what should be TRUE rather than "flip it", so a double
    // click and a race both land on the same answer.
    const op = {
      type: "item.react",
      itemId: item.id,
      emoji,
      on: !hasReacted(item, emoji, actor.id),
    } as const;
    void sendEchoed(canvasId, actor, op);
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
      {reactions.map((reaction) => {
        const agentCount = agents ? reaction.actorIds.filter((id) => agents.has(id)).length : 0;
        return (
          <button
            key={reaction.emoji}
            className={`react-chip${reaction.mine ? " mine" : ""}${veiled ? " veiled" : ""}`}
            // Who, by the name they answer to NOW — a reaction stores ids only.
            title={
              veiled
                ? `hidden until the bell — click to ${reaction.mine ? "take yours back" : "add yours"}`
                : `${reaction.actorIds
                    .map((id) => names[id] ?? id)
                    .join(", ")} — click to ${reaction.mine ? "take yours back" : "add yours"}`
            }
            onClick={(e) => {
              e.stopPropagation();
              toggle(reaction.emoji);
            }}
          >
            <span className="react-emoji">{reaction.emoji}</span>
            <span className="react-count">
              {agentCount > 0 ? reaction.count - agentCount : reaction.count}
              {agentCount > 0 && <span className="react-agents"> +{agentCount}🤖</span>}
            </span>
          </button>
        );
      })}
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
            {SMILE_PLUS}
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
