import { ICON_NOUN, type IconKind } from "../lib/kinds.ts";

/**
 * What an item IS, as a picture.
 *
 * **Drawn here, not imported.** These are inline SVG in the Material Symbols
 * idiom — a 24 grid, 2-unit strokes, round caps — and not the font, for three
 * reasons that all matter at this size: they inherit `currentColor`, so they
 * follow the title row into the accent and follow the page into dark mode with
 * no second palette; they add no network request to a canvas that has to draw
 * a hundred cards; and they are geometry we can tune for 11px rather than
 * glyphs designed for 24.
 *
 * **And not emoji.** The vocabulary this set follows was handed over as emoji
 * (🎨 🔤 📹 🖼️ ▶️ 📄 📱), which is the right vocabulary and the wrong
 * rendering: emoji are full-colour, they differ on every platform, and they
 * cannot take the accent when the row is selected. `/design-audit` lists emoji
 * as section markers among the tells of a machine-made interface, and a mark
 * that ships one way on a Mac and another on Windows is not a design system.
 * The MEANINGS below are that list; the pixels are ours.
 *
 * Strokes rather than fills because the mark sits beside 11px text and has to
 * carry the same visual weight as a letter, not the weight of a bullet.
 */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The drawings. One per `IconKind`, so TypeScript names a missing one. */
const PATHS: Record<IconKind, React.ReactNode> = {
  // palette — the design system. A rounded blob with the wells of colour in it.
  "design-system": (
    <>
      <path
        {...S}
        d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-8.6Z"
      />
      <circle cx="7.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="9.8" cy="7.8" r="1.1" fill="currentColor" />
      <circle cx="14.6" cy="7.6" r="1.1" fill="currentColor" />
    </>
  ),
  // brush — ink. A nib laying a stroke down.
  drawing: (
    <>
      <path {...S} d="M20 4 9.5 14.5" />
      <path {...S} d="M9.5 14.5 6 13l-2 5 5-2Z" />
    </>
  ),
  // A capital T on a baseline — the mark every tool that lets you type on a
  // surface uses, so it needs no legend. Not a page with lines on it: that is
  // `document`, and the whole distinction here is that a text node is words
  // WITHOUT a page under them.
  text: (
    <>
      <path {...S} d="M5 5h14" />
      <path {...S} d="M12 5v14" />
    </>
  ),
  // devices — a design. One monitor on a stand rather than the monitor-plus-
  // phone pair the name suggests: at 13px two devices are two smudges, and
  // the pair says "responsive" where this only has to say "a screen".
  screen: (
    <>
      <path {...S} d="M3 5h18v11H3z" />
      <path {...S} d="M12 16v3" />
      <path {...S} d="M8 19h8" />
    </>
  ),
  // image — the frame with a peak and a sun in it. One peak, not two: the
  // second ridge is invisible at this size and only thickens the middle.
  image: (
    <>
      <path {...S} d="M4 4h16v16H4z" />
      <circle cx="9.5" cy="9.5" r="1.8" {...S} />
      <path {...S} d="m4.5 18 5-5.5L20 20" />
    </>
  ),
  // videocam — the body and its spout.
  video: (
    <>
      <path {...S} d="M3 6h11v12H3z" />
      <path {...S} d="m14 11 7-4v10l-7-4Z" />
    </>
  ),
  /**
   * A browser window — a title bar over a page.
   *
   * It was `play_circle`, chosen to say "the prototype that is actually
   * running". But a play triangle means PRESS ME TO START, and these are
   * already running: nothing here is waiting to be played. Reported as
   * exactly that about the tool that makes them.
   *
   * Not a globe either, which would say "the web": what these usually point
   * at is `localhost:5173`, and a globe on a dev server is wrong in the one
   * case the feature exists for. A browser window is literally what lands on
   * the canvas — a frame with somebody's page live inside it — and the title
   * bar is what tells it apart from `screen`, which is a monitor.
   */
  site: (
    <>
      <path {...S} d="M3 5h18v14H3z" />
      <path {...S} d="M3 9h18" />
      <path {...S} d="M6 7h.01M8.5 7h.01" />
    </>
  ),
  // A canvas on a canvas: a frame with a smaller frame set inside it.
  canvas: (
    <>
      <path {...S} d="M3 4h18v16H3z" />
      <path {...S} d="M8 9h8v6H8z" />
    </>
  ),
  // article — prose. A sheet with lines of text on it.
  document: (
    <>
      <path {...S} d="M5 3h14v18H5z" />
      <path {...S} d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  // draft — anything else. A page with the corner turned.
  other: (
    <>
      <path {...S} d="M13 3H6v18h12V8Z" />
      <path {...S} d="M13 3v5h5" />
    </>
  ),
};

export function KindIcon({ kind, className }: { kind: IconKind; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-label={ICON_NOUN[kind]}
      focusable="false"
    >
      {PATHS[kind]}
    </svg>
  );
}
