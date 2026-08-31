import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EMOJI_GROUPS, type EmojiEntry, emojiName, searchEmoji } from "@isocan/core";
import { recentEmoji } from "../lib/recentEmoji.ts";

/**
 * The picker: recents, groups, and a search that goes straight to the mark.
 *
 * It replaced a row of eight. Eight was defensible as a starter set and stopped
 * being defensible the moment reactions became the way a team invents its own
 * system — a team whose 🚧 means "blocked" needs a 🐛 and a 📉 and a 🌙 too,
 * and a picker that cannot reach them decides the vocabulary on their behalf.
 *
 * **Search is the primary path**, which is why the field is focused on open
 * and why Enter takes the first result. Browsing by group is the fallback for
 * when you do not know the word, not the other way round. Nothing here is
 * modal beyond the picker itself: Escape closes, and the search field is a
 * plain input so the browser's own emoji keyboard still works if that is what
 * somebody prefers.
 */
export function EmojiPicker({
  anchor,
  onPick,
  onClose,
  worn,
}: {
  /**
   * The `+` this hangs off. Read for its SCREEN rectangle, because the panel
   * does not live next to it in the tree — see the portal below.
   */
  anchor: React.RefObject<HTMLElement | null>;
  onPick: (emoji: string) => void;
  onClose: () => void;
  /** Marks this item already wears — shown pressed, because picking one again
   * takes yours back and the picker should say so before you click. */
  worn: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(0);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Read once per open: a recents list that reshuffled under the pointer as
  // you picked would move the thing you were aiming at.
  const recent = useMemo(() => recentEmoji(), []);

  useEffect(() => {
    field.current?.focus();
  }, []);

  /**
   * **Placed against the WINDOW, after measuring both it and the panel.**
   *
   * Two problems, one cause. The `+` lives inside `.world`, which carries the
   * zoom transform, and a transformed ancestor is a stacking context — so a
   * popover in there cannot outrank the minimap dock however high its own
   * z-index goes (`layers.test.ts` states the rule; this is it biting). It
   * also cannot escape the item's corner, and the `+` sits near the bottom of
   * an item, so the panel opened straight off the bottom of the screen.
   *
   * A portal to `document.body` fixes both at once: the panel becomes a
   * sibling of the docks, where `--z-popover` actually competes, and it is
   * outside the zoom transform so it needs no counter-scaling at all.
   *
   * Flipping above the anchor when there is no room below is the same
   * decision every menu makes, and the clamp keeps a panel opened near an edge
   * fully on screen rather than half of it.
   */
  useLayoutEffect(() => {
    const button = anchor.current?.getBoundingClientRect();
    const panel = box.current?.getBoundingClientRect();
    if (!button || !panel) return;
    const GAP = 6;
    const below = button.bottom + GAP;
    const room = window.innerHeight - below;
    const top = room >= panel.height ? below : Math.max(GAP, button.top - panel.height - GAP);
    const left = Math.min(
      Math.max(GAP, button.left),
      Math.max(GAP, window.innerWidth - panel.width - GAP),
    );
    setAt({ left, top });
  }, [anchor, query, group]);

  // Escape closes, and a click anywhere outside does too. Both are captured on
  // the document rather than bound to the panel: a picker that only closes
  // when you find its close affordance is a picker that feels stuck.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", away, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", away, true);
    };
  }, [onClose]);

  const results = query.trim() ? searchEmoji(query) : null;
  const showing: readonly EmojiEntry[] = results ?? EMOJI_GROUPS[group]!.entries;

  const option = (emoji: string, name: string) => (
    <button
      key={emoji}
      className={`react-option${worn.includes(emoji) ? " worn" : ""}`}
      role="menuitem"
      title={name}
      aria-label={name}
      onClick={(event) => {
        event.stopPropagation();
        onPick(emoji);
      }}
    >
      {emoji}
    </button>
  );

  return createPortal(
    <div
      className="react-picker"
      role="menu"
      /**
       * Portalled to the body to escape overflow and transforms — this says it
       * still BELONGS to whatever opened it.
       *
       * The `stopPropagation` below is not enough on its own and it is worth
       * knowing why: `useDismissOnOutside` listens on the CAPTURE phase, so it
       * has already run by the time a bubble-phase handler here could stop
       * anything. A menu that opened this picker was closing itself before the
       * click could choose an emoji.
       */
      data-owned-popover=""
      ref={box}
      // Hidden for the one frame between mounting (to be measured) and being
      // placed — otherwise it flashes at the top-left corner first.
      style={at ? { left: at.left, top: at.top } : { opacity: 0, pointerEvents: "none" }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        ref={field}
        className="react-search"
        type="text"
        value={query}
        placeholder="Search marks…"
        aria-label="Search emoji"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Enter takes the top result — the whole point of typing.
          if (event.key === "Enter" && showing[0]) {
            event.preventDefault();
            onPick(showing[0].emoji);
          }
        }}
      />

      {!results && recent.length > 0 && (
        <div className="react-recent">
          <h4>Recent</h4>
          <div className="react-grid">
            {recent.map((emoji) => option(emoji, emojiName(emoji)))}
          </div>
        </div>
      )}

      {!results && (
        <div className="react-tabs" role="tablist">
          {EMOJI_GROUPS.map((one, index) => (
            <button
              key={one.name}
              role="tab"
              aria-selected={index === group}
              className={`react-tab${index === group ? " on" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setGroup(index);
              }}
            >
              {one.name}
            </button>
          ))}
        </div>
      )}

      <div className="react-grid react-results">
        {showing.map((entry) => option(entry.emoji, entry.name))}
        {results?.length === 0 && (
          <p className="react-none">
            Nothing matches “{query.trim()}”. Any emoji works from the CLI —
            <code>isocan react</code> takes whatever you type.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
