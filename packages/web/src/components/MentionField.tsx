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
import type { MentionCandidate } from "@isocan/core";
import { actorColor } from "../lib/colors.ts";
import { mentionChipStyle, splitMentions, type MentionPeer } from "../lib/mentions.ts";

/**
 * A comment composer that knows about people.
 *
 * Typing "@" opens a menu of everyone on the canvas (live sessions first);
 * ↑/↓ walks it, Enter/Tab completes, Esc dismisses. Resolved mentions are
 * painted as chips by a backdrop layer that mirrors the field's text exactly
 * and sits behind it — the field stays a plain <input>/<textarea>, so
 * selection, IME, undo and spellcheck all behave natively.
 */
export function MentionField({
  value,
  onChange,
  candidates,
  peers,
  placeholder,
  autoFocus,
  multiline,
}: {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  peers: MentionPeer[];
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

  const trigger = findTrigger(value, caret);
  const matches = trigger && trigger.at !== dismissedAt ? matchPeers(peers, trigger.query) : [];
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

  function complete(peer: MentionPeer) {
    if (!trigger) return;
    const head = `${value.slice(0, trigger.at)}@${peer.name} `;
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
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault(); // …and so the reply form does not submit
      complete(matches[Math.min(active, matches.length - 1)]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedAt(trigger!.at); // this "@" stops offering the menu
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
        {paintText(value, candidates, open ? trigger!.at : null, markerRef)}
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

/**
 * The menu hangs off the "@" itself — the marker span the backdrop paints at
 * that offset gives us the caret's own line box, so the menu drops under the
 * line being typed rather than under the whole field. `position: fixed` keeps
 * it out of the popover's scroll clipping.
 */
function MentionMenu({
  marker,
  matches,
  active,
  onHover,
  onPick,
}: {
  marker: RefObject<HTMLSpanElement>;
  matches: MentionPeer[];
  active: number;
  onHover: (index: number) => void;
  onPick: (peer: MentionPeer) => void;
}) {
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // No dep array: the "@" moves as text wraps, the field scrolls, or the
  // popover shifts — every render re-measures. setBox bails when nothing moved.
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
      setBox((prev) => (prev?.left === left && prev.top === top ? prev : { left, top }));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });

  return (
    <div
      ref={ref}
      className="mention-menu"
      role="listbox"
      style={{ ...box, visibility: box ? "visible" : "hidden" }}
      // Keep focus in the field: mousedown would blur it before the click.
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((peer, i) => (
        <button
          type="button"
          key={peer.id}
          role="option"
          aria-selected={i === active}
          className={i === active ? "active" : undefined}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(peer)}
        >
          <span className="mention-dot" style={{ background: actorColor(peer.id) }} />
          <span className="mention-name">@{peer.name}</span>
          {peer.online && <span className="mention-live">live</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * The backdrop's content: the field's text with mentions wrapped as chips,
 * and — when the menu is open — the single character at `markAt` (the "@")
 * split into its own span, so the menu can measure that line. Splitting adds
 * no styling of its own, so the mirrored glyphs stay under the real ones.
 */
function paintText(
  value: string,
  candidates: MentionCandidate[],
  markAt: number | null,
  markerRef: RefObject<HTMLSpanElement>,
) {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const piece of splitMentions(value, candidates)) {
    const start = offset;
    offset += piece.text.length;
    const props = piece.span
      ? { className: "mention", style: cssVars(mentionChipStyle(piece.span.actorId)) }
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
  /** Index of the "@". */
  at: number;
  /** Text typed since, which the menu filters on. */
  query: string;
}

const MAX_QUERY = 40; // past this, they're writing prose, not a name

/** The "@…" being typed at the caret, if any. Names may contain spaces, so the
 * query runs to the caret; it ends at a newline, another "@", or nothing. */
function findTrigger(value: string, caret: number): Trigger | null {
  for (let i = caret - 1; i >= 0 && caret - i <= MAX_QUERY + 1; i--) {
    const ch = value[i]!;
    if (ch === "\n") return null;
    if (ch !== "@") continue;
    if (i > 0 && /[\p{L}\p{N}_]/u.test(value[i - 1]!)) return null; // an email address
    return { at: i, query: value.slice(i + 1, caret) };
  }
  return null;
}

const MAX_MATCHES = 6;

/** Peers whose name — or any word of it — starts with the query. */
function matchPeers(peers: MentionPeer[], query: string): MentionPeer[] {
  const needle = query.toLowerCase();
  return peers
    .filter((peer) => {
      const name = peer.name.toLowerCase();
      return name.startsWith(needle) || name.split(/\s+/).some((w) => w.startsWith(needle));
    })
    .slice(0, MAX_MATCHES);
}
