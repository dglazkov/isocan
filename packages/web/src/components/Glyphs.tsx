/**
 * **The marks the chrome names things with.**
 *
 * One file, because they are a set and have to look like one: same 16 grid,
 * same 1.3 stroke, same round joins, all `currentColor`. Drawn apart, four
 * glyphs become four people's idea of a line weight.
 */

/**
 * **The Chat: a speech bubble with voices in it.**
 *
 * It was `✳`, a six-pointed asterisk, which says nothing about conversation to
 * anybody who has not been told. Three places wore it and none of them was
 * self-explanatory.
 *
 * A plain bubble was not available: the Comment tool already owns one, and
 * these two ARE both conversations — so the family resemblance is honest and
 * what has to differ is which conversation. The dots are what say it. A
 * comment is an empty pin, a note left on one thing; the Chat has voices in
 * it, and it is the room's.
 *
 * Drawn once and imported, because "switch it everywhere" is only true for as
 * long as there is one of it. Three copies of a glyph is three chances to
 * change two of them.
 */
export function ChatGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      /* Heavier at small sizes: a 1.3px stroke that reads at 17 goes spidery
         at 13, and the header wears it at 13. */
      strokeWidth={size < 15 ? 1.5 : 1.3}
      strokeLinejoin="round"
    >
      <path d="M2.2 4.4a2 2 0 0 1 2-2h7.6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6.6l-2.9 2.8V10.4a2 2 0 0 1-1.5-2z" />
      {/* Filled, not stroked: three hollow rings at this size are three grey
          smudges. */}
      <circle cx="5.6" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}


/**
 * **Files: a stack of sheets, not a folder.**
 *
 * Nothing here is in a folder. The panel lists everything on the canvas
 * grouped by kind, and a folder would promise a hierarchy the product does
 * not have — a small lie that costs somebody one click to discover.
 */
export function FilesGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={size < 15 ? 1.5 : 1.3}
      strokeLinejoin="round" strokeLinecap="round">
      <path d="M4.4 1.9h4.8a1.6 1.6 0 0 1 1.6 1.6v6.6a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6V3.5a1.6 1.6 0 0 1 1.6-1.6z" />
      {/* The sheet behind, as two edges rather than a whole rectangle: a
          second full outline at this size is a smudge. */}
      <path d="M12.6 4.5a1.6 1.6 0 0 1 .6 1.3v6.3a1.9 1.9 0 0 1-1.9 1.9H6" />
    </svg>
  );
}

/**
 * **Agents: a spark.**
 *
 * This is the mark the Chat was wearing — `✳` — and it was simply in the
 * wrong place. On the Chat it said nothing; on the agents it says the one
 * thing everybody now reads a spark as. The glyph did not need replacing, it
 * needed moving.
 *
 * Two sparks, unequal: one is a shape, two is a quality of the thing beside
 * them. The small one is also what keeps this from reading as a rating star.
 */
export function AgentsGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={size < 15 ? 1.4 : 1.25}
      strokeLinejoin="round" strokeLinecap="round">
      <path d="M6.1 1.8 7.2 4.7a1.3 1.3 0 0 0 .75.75l2.9 1.1-2.9 1.1a1.3 1.3 0 0 0-.75.75l-1.1 2.9-1.1-2.9a1.3 1.3 0 0 0-.75-.75L1.35 6.55l2.9-1.1A1.3 1.3 0 0 0 5 4.7z" />
      <path d="M12 9.5l.55 1.45 1.45.55-1.45.55L12 13.5l-.55-1.45L10 11.5l1.45-.55z" />
    </svg>
  );
}

/**
 * **Home: every canvas, not a house.**
 *
 * `⌂` is a building, and the place it goes to is a LIST — all your canvases.
 * A grid says "all of them"; a house says you are going somewhere domestic.
 * The tooltip has always read "All canvases"; this is the icon catching up.
 */
export function HomeGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
      <rect x="2.2" y="2.2" width="5" height="5" rx="1.3" />
      <rect x="8.8" y="2.2" width="5" height="5" rx="1.3" />
      <rect x="2.2" y="8.8" width="5" height="5" rx="1.3" />
      <rect x="8.8" y="8.8" width="5" height="5" rx="1.3" />
    </svg>
  );
}


/**
 * **The workbench: a toolbox.**
 *
 * It was `⌗`, a sharp sign, which is a musical accidental and a hash — two
 * things, neither of them a room you go to in order to work. A toolbox is
 * what the workbench IS: the agents, the files and the thread around one
 * screen, in a container you carry to the job.
 */
export function WorkbenchGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round" strokeLinecap="round">
      <path d="M1.8 6.6a1.4 1.4 0 0 1 1.4-1.4h9.6a1.4 1.4 0 0 1 1.4 1.4v5.2a1.4 1.4 0 0 1-1.4 1.4H3.2a1.4 1.4 0 0 1-1.4-1.4z" />
      {/* The handle, which is the half that makes it a toolbox and not a
          drawer. */}
      <path d="M5.6 5.2V4a1.2 1.2 0 0 1 1.2-1.2h2.4A1.2 1.2 0 0 1 10.4 4v1.2" />
      <path d="M1.8 8.9h12.4" />
    </svg>
  );
}

/**
 * **Share: out, to somebody else.**
 *
 * An arrow leaving a box. Not the three-dots-and-two-lines network mark,
 * which means "share" only to people who already know it means share, and
 * reads as a graph to everybody else.
 */
export function ShareGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round" strokeLinecap="round">
      <path d="M8 2.2v7.2" />
      <path d="M5.3 4.7 8 2 10.7 4.7" />
      <path d="M3.4 8.2v4.2a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4V8.2" />
    </svg>
  );
}


/** The trash: a bin with a lid, drawn open-topped so it reads at 14px where a
 *  closed one turns into a filled rectangle. */
export function TrashGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round" strokeLinecap="round">
      <path d="M2.6 4.3h10.8" />
      <path d="M6.2 4.3V3.1a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v1.2" />
      <path d="M3.9 4.3l.5 8.1a1.3 1.3 0 0 0 1.3 1.2h4.6a1.3 1.3 0 0 0 1.3-1.2l.5-8.1" />
    </svg>
  );
}

/**
 * **The minimap — the mark the map already wore.**
 *
 * A folded map, three panels. There was briefly a second drawing of this for
 * the `···` menu, invented rather than found, which is how two pictures of
 * one thing get into a product. The map's own handle has carried this since
 * it shipped; the menu shows the same mark, so the row and the thing it opens
 * are recognisably one item.
 */
export function MinimapGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
      <path d="M1.5 4.2 5.8 2.4v9.4L1.5 13.6zM5.8 2.4l4.4 1.8v9.4L5.8 11.8zM10.2 4.2l4.3-1.8v9.4l-4.3 1.8z" />
    </svg>
  );
}
