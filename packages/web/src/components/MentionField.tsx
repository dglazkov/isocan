import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";
import type { ItemRefCandidate, MentionCandidate, SlashCommand } from "@isocan/core";
import { matchCommands } from "@isocan/core";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { mentionChipStyle, splitChips } from "../lib/chips.ts";
import type { MentionPeer } from "../lib/mentions.ts";
import type { ItemEntry } from "../lib/itemrefs.ts";
import { useCommands } from "../lib/commands.ts";

/**
 * A comment composer that knows about people and items.
 *
 * Typing "@" opens a menu of everyone on the canvas (live sessions first);
 * "#" opens a menu of the canvas's items (most recently touched first); "/"
 * at the START of the message opens the slash commands — only at the start,
 * because that is the only place a command is recognised, and a menu that
 * offers what will not happen is worse than no menu.
 * ↑/↓ walks it, Enter/Tab completes, Esc dismisses. Resolved references are
 * painted as chips by a backdrop layer that mirrors the field's text exactly
 * and sits behind it — the field stays a plain <input>/<textarea>, so
 * selection, IME, undo and spellcheck all behave natively.
 */
export function MentionField({
  value,
  onChange,
  candidates,
  peers,
  itemCandidates,
  items,
  placeholder,
  autoFocus,
  multiline,
}: {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  peers: MentionPeer[];
  itemCandidates: ItemRefCandidate[];
  items: ItemEntry[];
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
}) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const commands = useCommands();
  const trigger = findTrigger(value, caret);
  const matches =
    trigger && trigger.at !== dismissedAt
      ? trigger.char === "@"
        ? matchPeers(peers, trigger.query)
        : trigger.char === "/"
          ? matchSlashCommands(commands, trigger.query)
          : matchItems(items, trigger.query)
      : [];
  const open = matches.length > 0;

  // A new trigger (or a narrowed query) starts back at the top of the menu.
  useEffect(() => setActive(0), [trigger?.at, trigger?.query]);

  // The compose popover opens from a canvas click, and the browser's own
  // focus handling for that click lands after mount — which would undo the
  // autoFocus attribute. Claim focus on the next frame, once that has settled.
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => fieldRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  // Completions rewrite the value, so the caret has to be restored by hand.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null) return;
    pendingCaret.current = null;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(at, at);
    setCaret(at);
  }, [value]);

  function syncCaret(el: HTMLInputElement | HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function complete(option: MenuOption) {
    if (!trigger) return;
    const head = `${value.slice(0, trigger.at)}${trigger.char}${option.label} `;
    onChange(head + value.slice(caret));
    pendingCaret.current = head.length;
    setDismissedAt(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : matches.length - 1;
      setActive((i) => (i + step) % matches.length);
    } else if ((e.key === "Enter" || e.key === "Tab") && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault(); // …and so the reply form does not submit
      complete(matches[Math.min(active, matches.length - 1)]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedAt(trigger!.at); // this trigger stops offering the menu
    }
  }

  // The backdrop does not scroll on its own — it rides the field's scroll.
  function onScroll(e: UIEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    backdrop.scrollTop = e.currentTarget.scrollTop;
    backdrop.scrollLeft = e.currentTarget.scrollLeft;
  }

  const fieldProps = {
    value,
    placeholder,
    autoFocus,
    className: "mention-input",
    onChange: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => {
      onChange(e.target.value);
      syncCaret(e.target);
      setDismissedAt(null);
    },
    onKeyDown,
    onScroll,
    onSelect: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) =>
      syncCaret(e.currentTarget),
    onBlur: () => setDismissedAt(null),
  };

  return (
    <div className={`mention-field${multiline ? " multiline" : ""}`}>
      <div className="mention-backdrop" ref={backdropRef} aria-hidden="true">
        {paintText(value, candidates, itemCandidates, open ? trigger!.at : null, markerRef)}
        {"​" /* keeps a trailing newline's line box alive */}
      </div>
      {multiline ? (
        <textarea
          {...fieldProps}
          ref={(el) => {
            fieldRef.current = el;
          }}
        />
      ) : (
        <input
          {...fieldProps}
          ref={(el) => {
            fieldRef.current = el;
          }}
        />
      )}
      {open && (
        <MentionMenu
          marker={markerRef}
          char={trigger!.char}
          matches={matches}
          active={Math.min(active, matches.length - 1)}
          onHover={setActive}
          onPick={complete}
        />
      )}
    </div>
  );
}

const MENU_GAP = 3; // hairline between the typed line and the menu
const MENU_EDGE = 8; // keep the menu off the window edges
/** The explanation card beside the command menu. */
const CARD_WIDTH = 248;
const CARD_GAP = 8;
/** Keep the card clear of the bottom edge — it is a few lines tall. */
const CARD_REACH = 180;

/** One row of the completion menu — a person or an item. */
interface MenuOption {
  id: string;
  /** Inserted verbatim after the trigger character. */
  label: string;
  item?: boolean;
  online?: boolean;
  /** Shown in the card beside the menu: what the command does. */
  hint?: string;
  usage?: string;
  /** The card's last line: where this goes when you send it. */
  foot?: string;
}

/**
 * The menu hangs off the trigger itself — the marker span the backdrop paints
 * at that offset gives us the caret's own line box, so the menu drops under
 * the line being typed rather than under the whole field. `position: fixed`
 * keeps it out of the popover's scroll clipping.
 */
function MentionMenu({
  marker,
  char,
  matches,
  active,
  onHover,
  onPick,
}: {
  marker: RefObject<HTMLSpanElement>;
  char: string;
  matches: MenuOption[];
  active: number;
  onHover: (index: number) => void;
  onPick: (option: MenuOption) => void;
}) {
  const colors = useActorColors();
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Only a command carries an explanation worth a card; a name is its own.
  const describing = char === "/" ? matches[Math.min(active, matches.length - 1)] : undefined;

  /**
   * Placement is written to the DOM, not held in state.
   *
   * This has to re-measure on every render — the trigger moves as text wraps,
   * the field scrolls, the popover shifts — and a measure that ends in
   * setState is a render that ends in another measure. It settles on the right
   * numbers immediately and still dispatches on every pass, which React counts
   * as nested updates until it gives up ("Maximum update depth exceeded",
   * which is what adding the card did). Assigning the style has the same
   * effect on screen and cannot loop: nothing here schedules a render.
   */
  useLayoutEffect(() => {
    const place = () => {
      const menu = ref.current;
      // First rect only: a wrapped marker would otherwise report both lines.
      const at = marker.current?.getClientRects()[0];
      if (!menu || !at) return;
      const left = Math.max(
        MENU_EDGE,
        Math.min(at.left, window.innerWidth - MENU_EDGE - menu.offsetWidth),
      );
      const below = at.bottom + MENU_GAP;
      const top =
        below + menu.offsetHeight <= window.innerHeight - MENU_EDGE
          ? below
          : Math.max(MENU_EDGE, at.top - MENU_GAP - menu.offsetHeight);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = "visible";

      // The card hangs off the ACTIVE row, not off the menu, so it follows the
      // selection whether you walked here with the keyboard or the pointer.
      const card = cardRef.current;
      if (!card) return;
      const row = menu.children[active] as HTMLElement | undefined;
      const rowTop = row ? row.getBoundingClientRect().top : top;
      const fitsRight =
        left + menu.offsetWidth + CARD_GAP + CARD_WIDTH <= window.innerWidth - MENU_EDGE;
      card.style.left = `${
        fitsRight
          ? left + menu.offsetWidth + CARD_GAP
          : Math.max(MENU_EDGE, left - CARD_GAP - CARD_WIDTH)
      }px`;
      card.style.top = `${Math.max(MENU_EDGE, Math.min(rowTop - 6, window.innerHeight - CARD_REACH))}px`;
      card.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });

  // Portalled to the body: this menu hangs outside the panel or popover that
  // opens it, and inside their stacking context no z-index can lift it over
  // chrome that outranks the panel — the minimap painted straight over it. It
  // is position: fixed, so leaving changes nothing about where it lands.
  return createPortal(
    <>
    <div
      ref={ref}
      className="mention-menu"
      role="listbox"
      // Hidden until the effect has measured, or it flashes at the corner.
      style={{ visibility: "hidden" }}
      // Keep focus in the field: mousedown would blur it before the click.
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((option, i) => (
        <button
          type="button"
          key={option.id}
          role="option"
          aria-selected={i === active}
          className={i === active ? "active" : undefined}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(option)}
        >
          {char === "/" ? (
            <span className="mention-dot command-dot">/</span>
          ) : (
            <span
              className={option.item ? "mention-dot item-dot" : "mention-dot"}
              style={option.item ? undefined : { background: actorColorIn(colors, option.id) }}
            />
          )}
          <span className="mention-name">
            {/* For a command the dot IS the slash, so the name must not carry
                one too — the row read "//format" before this. */}
            {char === "/" ? "" : char}
            {option.label}
            {option.usage ? <em className="mention-usage"> {option.usage}</em> : null}
          </span>
          {option.online && <span className="mention-live">live</span>}
        </button>
      ))}
    </div>
    {/* A SIBLING of the menu, never a child: inside it, `children[active]`
        would sometimes measure the card. Beside the menu, because a sentence
        in a menu row is a sentence with a "…" in it. Inert: an explanation,
        not a place to go. */}
    {describing && (
      <div ref={cardRef} className="hover-card command-card" style={{ visibility: "hidden" }}>
        <b>
          /{describing.label}
          {describing.usage ? <em> {describing.usage}</em> : null}
        </b>
        <span>{describing.hint}</span>
        {describing.foot && <i>{describing.foot}</i>}
      </div>
    )}
    </>,
    document.body,
  );
}

/**
 * The backdrop's content: the field's text with resolved references wrapped
 * as chips, and — when the menu is open — the single character at `markAt`
 * (the trigger) split into its own span, so the menu can measure that line.
 * Splitting adds no styling of its own, so the mirrored glyphs stay under the
 * real ones.
 */
function paintText(
  value: string,
  candidates: MentionCandidate[],
  itemCandidates: ItemRefCandidate[],
  markAt: number | null,
  markerRef: RefObject<HTMLSpanElement>,
) {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const piece of splitChips(value, candidates, itemCandidates)) {
    const start = offset;
    offset += piece.text.length;
    const props = piece.mention
      ? { className: "mention", style: cssVars(mentionChipStyle(piece.mention.actorId)) }
      : piece.item
        ? { className: "item-ref" }
        : {};
    if (markAt === null || markAt < start || markAt >= offset) {
      nodes.push(
        <span key={start} {...props}>
          {piece.text}
        </span>,
      );
      continue;
    }
    const cut = markAt - start;
    if (cut > 0) {
      nodes.push(
        <span key={`${start}-head`} {...props}>
          {piece.text.slice(0, cut)}
        </span>,
      );
    }
    nodes.push(
      <span key={`${start}-at`} {...props} ref={markerRef}>
        {piece.text.slice(cut, cut + 1)}
      </span>,
    );
    if (cut + 1 < piece.text.length) {
      nodes.push(
        <span key={`${start}-tail`} {...props}>
          {piece.text.slice(cut + 1)}
        </span>,
      );
    }
  }
  return nodes;
}

/** React types style objects as CSS properties; custom properties need a cast. */
function cssVars(style: string): CSSProperties {
  const [name, value] = style.split(":");
  return { [name!]: value } as CSSProperties;
}

interface Trigger {
  /** Index of the character that opened the menu. */
  at: number;
  char: "@" | "#" | "/";
  /** Text typed since, which the menu filters on. */
  query: string;
}

const MAX_QUERY = 40; // past this, they're writing prose, not a name

/** The "@…" or "#…" being typed at the caret, if any. Names and titles may
 * contain spaces, so the query runs to the caret; it ends at a newline,
 * another trigger, or nothing. */
function findTrigger(value: string, caret: number): Trigger | null {
  // "/" is a command only as the first thing in the message — that is where
  // parseSlashCommand looks, so it is the only place the menu may promise
  // anything. A path or a date typed mid-sentence opens nothing.
  const lead = value.length - value.trimStart().length;
  if (value[lead] === "/" && caret > lead && !value.slice(lead, caret).includes(" ")) {
    return { at: lead, char: "/", query: value.slice(lead + 1, caret) };
  }
  for (let i = caret - 1; i >= 0 && caret - i <= MAX_QUERY + 1; i--) {
    const ch = value[i]!;
    if (ch === "\n") return null;
    if (ch !== "@" && ch !== "#") continue;
    // An email address or a URL fragment triggers nothing.
    if (i > 0 && /[\p{L}\p{N}_]/u.test(value[i - 1]!)) return null;
    return { at: i, char: ch, query: value.slice(i + 1, caret) };
  }
  return null;
}

const MAX_MATCHES = 6;

/** Peers whose name — or any word of it — starts with the query. */
function matchPeers(peers: MentionPeer[], query: string): MenuOption[] {
  const needle = query.toLowerCase();
  return peers
    .filter((peer) => {
      const name = peer.name.toLowerCase();
      return name.startsWith(needle) || name.split(/\s+/).some((w) => w.startsWith(needle));
    })
    .slice(0, MAX_MATCHES)
    .map((peer) => ({ id: peer.id, label: peer.name, online: peer.online }));
}

/** The commands worth offering — core decides, so the menu and
 * `isocan command list` can never disagree about what exists. */
function matchSlashCommands(commands: SlashCommand[], query: string): MenuOption[] {
  return matchCommands(commands, query, MAX_MATCHES).map((command) => ({
    id: command.name,
    label: command.name,
    hint: command.description,
    usage: command.usage,
    // Whether sending this will DO something or ASK for something — the one
    // thing about a command you cannot guess from its name.
    foot:
      command.local === true
        ? "answered here · nothing is posted"
        : command.source === "home"
          ? `yours · ~/.isocan/commands/${command.name}.md`
          : "posted as a comment · an agent does it",
  }));
}

/** Items whose title — or any word of it — or id starts with the query. */
function matchItems(items: ItemEntry[], query: string): MenuOption[] {
  const needle = query.toLowerCase();
  return items
    .filter((entry) => {
      const title = entry.title.toLowerCase();
      return (
        title.startsWith(needle) ||
        title.split(/\s+/).some((w) => w.startsWith(needle)) ||
        entry.id.toLowerCase().startsWith(needle)
      );
    })
    .slice(0, MAX_MATCHES)
    .map((entry) => ({ id: entry.id, label: entry.title, item: true }));
}
