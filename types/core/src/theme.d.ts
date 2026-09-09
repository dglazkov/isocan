import type { MetaPatch } from "./ops.js";
/**
 * **A canvas about sheep can look like a farm** (#195).
 *
 * A background under the work, so screens read as objects standing ON
 * something rather than floating on a dot grid — and you can group them into
 * pens, which is the actual request and the thing that decides the design.
 *
 * ## One property, not two
 *
 * A theme names both the ground and the cursor, and it is a single value
 * because "farm" is the fact. Two properties would let a canvas be a farm
 * with rockets, which is not a feature — it is a bug somebody has to explain.
 *
 * Like the post-it's `paper` and the archive's `shelved`, this is a property
 * on `project.update`'s `MetaPatch` rather than a new operation. The
 * vocabulary is a ratcheted bound (`op-types`, `at most: 33`) and a canvas
 * without the property is the dot grid, which is what every canvas is today —
 * so there is no migration and nothing to undo.
 *
 * ## Why these four, and why galaxy first
 *
 * Seeded rather than open so the picker has something in it on day one, and
 * so the art is a known set somebody can actually draw. **Galaxy is the one
 * to build first**: a starfield is GENERATED, so it tiles infinitely by
 * construction, costs no download, looks right at any zoom, and needs no
 * artist. It proves the mechanism the painted ones then follow.
 *
 * ## What a theme must not do
 *
 * Two bounds this project already measures, and a background is the obvious
 * way to break both:
 *
 * - **Legibility.** `contrast-failures` and `a11y-failures` are held on the
 *   front door and mean the same thing here: a markdown item over a grass
 *   field must still be readable, which is why every theme owes a scrim under
 *   content rather than only a picture.
 * - **The frame budget.** A ground that repaints on every pan spends exactly
 *   the frames the canvas needs to feel like a canvas.
 *
 * And one thing it must not take: the seven `IDENTITY_COLORS` are how you
 * tell people apart, and they land on items during remote selection. A themed
 * cursor wears the person's colour still. A sheep tinted with your colour is
 * delightful; a sheep that makes six people identical has deleted the only
 * signal that says who is who.
 */
export declare const THEME_PROP = "theme";
/**
 * The grounds this build can actually draw. `none` is not a member — it is the
 * absence of the property, so removing a theme leaves nothing behind.
 *
 * **The artist arrived on 8 September 2026**, and this list is what that
 * bought. It read `galaxy, ocean, mountains` for a fortnight with a comment
 * saying farm was *deliberately* absent — *"a canvas wearing a name nothing
 * can draw shows the dot grid with no way to explain itself"* — and that
 * comment was right to hold the line and is now spent, exactly as it said it
 * would be: *"adding it is this list plus a component, with nothing else to
 * change"*. It was.
 *
 * Five grounds, and one of them is still generated. **`galaxy` keeps its
 * procedural starfield rather than taking the painted tile it was offered**,
 * for the one reason that outranks a nicer picture: measured 2×2 against
 * itself, the painted space tile has a visible seam — a brightness step down
 * the join, edge gap 8 against an interior control of 0. An infinite canvas
 * finds a seam within one pan. The generated sky has none by construction and
 * costs no download, which was always its argument.
 *
 * The other four are pictures now (`packages/web/public/grounds/`). Ocean and
 * mountains had procedural stand-ins and this is the drop-in the stopgap was
 * written for; farm and desert never could have been generated at all.
 */
export declare const THEMES: readonly ["galaxy", "ocean", "mountains", "farm", "desert"];
/** One of the seeded grounds. Not a string: a canvas wearing a name nothing
 *  can draw is a blank screen with no way to explain itself. */
export type CanvasTheme = (typeof THEMES)[number];
/**
 * **What a ground is called where a person picks it.**
 *
 * The ids are the interface — `isocan canvas background galaxy` takes one, and
 * an id is what the canvas stores — but an id is not a name, and a menu that
 * says "galaxy" is a menu showing you its variable. So the labels live here
 * beside the ids rather than in the component that happens to need them first,
 * for the reason every other label fold in this package exists: the day a
 * second surface offers this, "galaxy" must not become two different words.
 *
 * `Space Galaxy` is Dion's, 7 Sep. The other two are plain on purpose — a
 * ground is a backdrop, and a menu of poetic names is a menu you have to
 * decode before you can choose.
 */
export declare function themeLabel(theme: CanvasTheme): string;
/** Is this one of the grounds this build can draw — the parse both surfaces
 *  use, so the CLI refuses exactly what the app would not render. */
export declare function isTheme(value: string): value is CanvasTheme;
/** What this canvas is wearing, or null for the dot grid. An unknown value
 *  reads as null rather than as itself: a canvas written by a newer build
 *  than this one shows the ground it has always shown, instead of a blank. */
export declare function themeOf(canvas: {
    properties?: Record<string, string>;
}): CanvasTheme | null;
/**
 * **Two ways for a ground to behave, and they are different pictures.**
 *
 * `world` — the ground is part of the canvas. It pans and zooms with the
 * items, so a field stays under the sheep standing in it and a pen is
 * somewhere you can come back to. This is the default and the reason the
 * layer is in world space at all.
 *
 * `window` — the ground is a backdrop behind the glass. Items travel across
 * a sky that does not move, which is the other thing people mean by a
 * background, and it is the better one for a canvas whose ground is
 * atmosphere rather than a place.
 *
 * **The dot grid does NOT come back for `window`**, and this comment claimed
 * from the day it was written (6 Sep 2026) that it did. What `window`
 * actually skips is one line — `.canvas-viewport.themed { background-image:
 * none }` — and skipping it changes nothing you can see, because every
 * ground is an opaque, full-bleed CHILD of the viewport, and a child paints
 * over its parent's background. So the dots are drawn and then covered, for
 * every ground, pinned or not. Measured 7 Sep 2026 on a pinned galaxy at a
 * real daemon: `.canvas-viewport` keeps its dot `background-image`, `.themed`
 * is correctly absent, and not one dot reaches the screen. `groundIsPlace`
 * below has said so since it was written; this paragraph is the half that was
 * still lying.
 *
 * **The argument it made was good and the answer was wrong.** A pinned ground
 * really does stop saying where you are, so something else has to — but it is
 * not the grid, and putting the grid back is worse than leaving it covered.
 * Both variants were rendered before this was written down. Over a starfield
 * the dots read as more stars, in a regular lattice, and the sky is gone: two
 * grounds arguing, which is the exact failure the stylesheet's own note
 * predicts. On the app's dark theme the same dots are `#2b2f36` on `#05060c`
 * and barely register — still ambiguous with stars, and no longer a reference
 * either. Over a photograph they are worse again: a screen of light dots that
 * punches through the dark parts of somebody's picture and vanishes over the
 * light ones, so the reference appears and disappears with the image under it.
 * A grid that is invisible, or indistinguishable from the ground, is not a
 * spatial reference; it is damage to the ground.
 *
 * **What says where you are under a pinned ground is the items and the
 * minimap.** The items are the strong one, and they are not a consolation:
 * items travelling across a sky that does not move IS the picture `window` is
 * for, the same way the ground travelling under them is the picture `world` is
 * for. The minimap, with its viewport rectangle, is what answers "where in the
 * whole canvas" — and it folds away, so it is the second reference rather than
 * the first.
 *
 * Under `world` the ground itself is the reference, which is why the grid is
 * explicitly turned off there: a grid and a moving ground would be two of them
 * arguing. Under `window` it is turned off by accident of stacking. Both are
 * the behaviour we want; only one of them is written down where it happens,
 * and `ground-covers-grid.test.ts` is what now holds the accident still.
 *
 * Absent means `world`, so every canvas already wearing a ground keeps
 * behaving exactly as it did.
 */
export declare const THEME_ANCHOR_PROP = "themeAnchor";
/** Where a ground is pinned: to the canvas, or to the window. */
export type ThemeAnchor = "world" | "window";
/** How this canvas's ground behaves. Anything unrecognised reads as `world`,
 *  which is the behaviour every themed canvas has had. */
export declare function anchorOf(canvas: {
    properties?: Record<string, string>;
}): ThemeAnchor;
/** Pin it to the window, or let it travel with the canvas. `world` REMOVES
 *  the property rather than writing the default, so the common case leaves
 *  nothing behind to read. */
export declare function anchorPatch(anchor: ThemeAnchor): MetaPatch;
/** Wear one — and drop any picture, because a canvas wears ONE ground
 *  (`GROUND_PROP` below). */
export declare function themePatch(theme: CanvasTheme): MetaPatch;
/** Take it off — a removal, so a canvas with no theme is byte-for-byte a
 *  canvas that never had one. Clears a custom ground too: "none" is one
 *  answer to "what is this canvas standing on", not two. */
export declare function noThemePatch(): MetaPatch;
/**
 * **A ground of your own** (#204 phase 2).
 *
 * > "For the background feature… there should be a 'custom' setting where the
 * > user can set a tile and cursor and then it takes on its own?"
 *
 * The tile half. The cursor half is phase 3 and is a LIBRARY rather than an
 * upload, because a cursor filled with the viewer's identity colour cannot be
 * a photograph — see `themeCursor` above and #195.
 *
 * ## The picture is the fact; there is no `theme: custom`
 *
 * A canvas wearing a picture is a canvas with `ground` set to the sha256 of
 * the bytes. Nothing writes `theme: custom`, because a theme name with no
 * picture behind it is a ground this build cannot draw — the exact failure
 * `THEMES` exists to prevent, and the reason `farm` is still not in that list.
 *
 * **`ground`, not `tile`**, which is what the research note proposed. A
 * pinned ground does not repeat (D2, below), so for the whole of this phase
 * the picture is a backdrop rather than a tile — and a key called `tile`
 * would promise repetition that only phase 4 delivers. `ground` is the word
 * the feature already uses in every sentence about it, including this file's
 * own heading, and it stays true when phase 4 makes it actually tile.
 *
 * **A canvas wears ONE ground**, which is the invariant `THEME_PROP`'s own
 * comment defends, so the two patches below each clear the other. That rule
 * lives here rather than at the two call sites: a canvas that is a galaxy AND
 * a photograph is not a feature, it is a bug somebody has to explain.
 *
 * ## The gc had to be taught first
 *
 * A blob named only by a property was unreachable, so a custom ground would
 * have been swept within the hour with nothing said. `blobsInProperties`
 * (`core/blobrefs.ts`) matches a 64-character hex string in any property
 * value, which is why this key needs no registration anywhere — and why the
 * parse below insists on that shape rather than accepting any string.
 */
export declare const GROUND_PROP = "ground";
/** The picture this canvas stands on, or null. */
export declare function groundOf(canvas: {
    properties?: Record<string, string>;
}): string | null;
/**
 * **The biggest a tile may be**, and it is stated rather than discovered.
 *
 * The generated grounds cost zero bytes. A picture is downloaded by everybody
 * on the canvas, on every cold load, forever — so this is a real cost with a
 * number, and both surfaces say the number before taking the file rather than
 * refusing after it (#204, D6).
 *
 * Two megabytes: comfortably a photograph at a sensible size, comfortably not
 * a raw camera file. Held here so `isocan canvas background --tile` and the
 * app's picker refuse the same file.
 */
export declare const GROUND_MAX_BYTES = 2000000;
/**
 * **How dark the scrim over a custom ground is** (#204, D3).
 *
 * Every seeded ground is dark on purpose — `#05060c`, `#0b2733`, `#2b2825` —
 * so white item cards read as objects standing on them. Somebody's holiday
 * photograph will not be, and the result is a canvas where nothing is legible.
 *
 * The fix is not a warning telling somebody to be a designer. It is one rule
 * the app applies: a black overlay between the picture and the items.
 *
 * **The floor is 0.42, and it is not where this sits.** The worst case is a
 * pure white image, whose sRGB value under an overlay of opacity `a` is
 * `1 - a`; a white card needs 3:1 against it — the threshold for a graphical
 * object having a discernible boundary, which is what "reads as an object
 * standing on it" means. Relative luminance is not the value itself, so the
 * inequality runs through the sRGB transfer function:
 *
 *     1.05 / (L + 0.05) >= 3   ->   L <= 0.3
 *     L = ((1 - a + 0.055) / 1.055) ^ 2.4 <= 0.3   ->   a >= 0.42
 *
 * **0.7 because a floor is not a design.** At 0.42 a busy photograph is still
 * bright enough to compete with the work standing on it, and every seeded
 * ground is far past that — `#05060c` puts a white card at about 19:1. 0.7
 * lands in between and keeps the picture plainly a picture at thirty per cent
 * of its own brightness.
 *
 * **Measured, not asserted** (7 Sep, on a deliberately near-white photograph):
 * the ground went from a mean of 246 to 74 — a ratio of 0.301 against the 0.3
 * the overlay promises — and a white card reads 8.9:1 against it. The first
 * version of this comment derived 0.7 as the 3:1 minimum by treating the sRGB
 * value as the luminance, and the measurement is what caught it: the number
 * was right and its reason was not, which is the more dangerous half.
 *
 * Fixed rather than adjustable on purpose: fixed is the honest start, and if
 * it turns out wrong for a whole class of image that is evidence, not a
 * reason to ship a slider first.
 */
export declare const GROUND_SCRIM = 0.7;
/**
 * Wear a picture. One property, and deliberately **not** the anchor.
 *
 * A picture is pinned (#204, D2): a world-anchored ground tiles forever, so a
 * photograph that is not seamless shows a grid of its own edges — the one
 * failure a person cannot debug and did not cause. World-anchored custom
 * grounds are phase 4, for somebody who has actually made a tile, with the
 * seam risk stated where they choose it.
 *
 * **But it is pinned by how it is DRAWN, not by a property**, and the first
 * version got that wrong: it wrote `themeAnchor: window` alongside the hash,
 * which is a fact about the canvas rather than about the picture. Set a
 * picture, then switch to Space Galaxy, and the galaxy was pinned — by a
 * choice nobody made, that nothing said, and that could only be undone by
 * finding a tickbox and unticking something you never ticked. Caught by
 * running the two commands in a row and reading the properties back.
 *
 * So the implicit choice is not written down at all. `groundIsPlace` below is
 * what the picture's pinning actually comes from, and phase 4 changes that one
 * function rather than hunting for anchors this wrote.
 */
export declare function groundPatch(hash: string): MetaPatch;
/** Take it off, so a canvas with no picture is byte-for-byte a canvas that
 *  never had one. */
export declare function noGroundPatch(): MetaPatch;
/**
 * **Is this canvas standing on anything?** — the one question the viewport
 * asks before it downloads a chunk to draw a ground, and the one the layer
 * asks before it draws.
 *
 * Here rather than `themeOf(p) !== null || groundOf(p) !== null` at each site,
 * because that disjunction is the thing that grows a third arm the day a
 * fourth kind of ground exists, and it grows it in whichever files somebody
 * remembers. It is also the mistake this phase nearly shipped: the viewport
 * gated the whole theme layer on `themeOf`, so a canvas wearing a picture and
 * no theme would have mounted nothing at all.
 */
export declare function hasGround(canvas: {
    properties?: Record<string, string>;
}): boolean;
/**
 * **Is the ground a PLACE, or a backdrop?** — the one question the dot grid
 * depends on (#195), and the one that decides whether a ground pans with the
 * work.
 *
 * A seeded ground answers with its anchor: `world` and it is a place, so the
 * grid steps aside; `window` and it is a backdrop, so the grid is left in
 * place.
 *
 * **The grid being left in place is not the same as being SEEN**, and that is
 * worth writing down here because #195's own note claims it is. The dots are
 * the viewport's `background-image`, and every ground — seeded or supplied —
 * is an opaque child element covering it, so under a pinned ground the dots
 * are painted and then hidden. Measured 7 Sep on a pinned galaxy. Nothing here
 * depends on it: a picture is not a place because it is drawn once and
 * `cover` and does not pan, which is true whatever the grid does.
 *
 * **A picture of somebody's own is never a place, whatever the anchor says**
 * (#204 phase 2), because it is drawn once and `cover` rather than tiled — a
 * photograph that is not seamless would repeat as a grid of its own edges.
 * Answered here rather than by writing `themeAnchor` when a picture is set:
 * an implicit choice written down as an explicit one outlives the thing that
 * implied it, which it did — a canvas that wore a picture and was then given
 * a galaxy kept the pinning nobody chose.
 *
 * Phase 4, which lets somebody with a real tile anchor one to the world, is a
 * change to this function and nothing else.
 */
export declare function groundIsPlace(canvas: {
    properties?: Record<string, string>;
}): boolean;
/**
 * **The cursor a ground gives everybody** — the other half of #195, and the
 * half its own title names: *"a background you can stand screens on, and a
 * cursor that belongs to it"*. Built 7 Sep, after Dion noticed it missing:
 * *"the cursors also haven't changed? Eg for space galaxy they didn't change
 * to a rocket."*
 *
 * One property still, not two. The theme IS the fact — a canvas cannot be a
 * galaxy with a sheep, because "two properties would let a canvas be a farm
 * with rockets, which is not a feature, it is a bug somebody has to explain".
 *
 * ## The shape is drawn, the colour is not
 *
 * Every path here is filled with the ACTOR'S colour by the caller, and that is
 * the constraint the issue is emphatic about: seven `IDENTITY_COLORS` also
 * land on items during remote selection, so a themed cursor that carried its
 * own colour would delete the one signal saying who is who. A fish tinted with
 * your colour is delightful; a fish that makes six people identical is a
 * regression dressed as a feature.
 *
 * ## Why not a rocket
 *
 * The issue suggests one, and it does not survive. Drawn and looked at: at 18
 * pixels a rocket silhouette IS an arrow — the fins never register, and both
 * candidates read as a slightly ragged pointer at every size up to 32. A
 * sparkle does read, instantly and at every size, and its long upper-left ray
 * is a proper pointer tip rather than a compromise. Space, and a cursor, in
 * one shape.
 *
 * The three that ship are the three that survived being looked at; `farm`
 * would want a sheep and wants the same artist its grass does.
 */
/**
 * **A cursor you choose, when the ground is a picture** (#204 phase 3).
 *
 * > "there should be a 'custom' setting where the user can set a tile and
 * > cursor and then it takes on its own?"
 *
 * ## Why this does not break "one property, not two"
 *
 * `THEME_PROP`'s comment is emphatic and right: a theme names the ground AND
 * the cursor, because "farm" is the fact, and two properties would let a
 * canvas be a farm with rockets. That rule is untouched here — **a seeded
 * ground still names its own cursor and this property cannot override one.**
 *
 * The gap is that a canvas standing on a PICTURE has no name to derive a
 * cursor from, so it got the plain arrow. There is nothing to contradict, so
 * there is nothing to protect: this is the name that is missing, not a second
 * name competing with one.
 *
 * ## Chosen, never uploaded (#204, D4)
 *
 * Every shape here is filled at runtime with the viewer's own identity colour,
 * and that is the constraint #195 is emphatic about — the seven
 * `IDENTITY_COLORS` also land on items during remote selection, so a cursor
 * carrying its own colour would delete the one signal saying who is who. An
 * uploaded PNG cannot be tinted, so on that canvas six people would share one
 * pointer. The refusal is worth stating out loud rather than leaving as an
 * absence.
 *
 * And it is genuinely hard to draw for: at 18 pixels a rocket silhouette IS an
 * arrow — that was tried, across four sizes, and never worked. Asking somebody
 * to author one is asking them to fail; offering a library is the same feature
 * with the failure removed.
 */
export declare const CURSOR_PROP = "cursor";
/** The shapes this build can draw. Not a string, for `THEMES`' reason: a
 *  canvas wearing a name nothing can draw is a pointer that vanishes. */
export declare const CURSORS: readonly ["arrow", "sparkle", "fish", "flag", "drop", "heart", "crescent", "sheep"];
/** One of the shapes this build can draw. Not a string, for `CanvasTheme`'s
 *  reason: a name nothing can draw is a pointer that vanishes. */
export type CanvasCursor = (typeof CURSORS)[number];
/** Is this a shape this build can draw — the parse both surfaces use, so the
 *  CLI refuses exactly what the app would not render. */
export declare function isCursor(value: string): value is CanvasCursor;
/** What a shape is called where somebody picks it. Beside the ids for
 *  `themeLabel`'s reason: a menu that says "sparkle" is showing its variable. */
export declare function cursorLabel(cursor: CanvasCursor): string;
/** The chosen shape, or null when nothing has been chosen. */
export declare function cursorOf(canvas: {
    properties?: Record<string, string>;
}): CanvasCursor | null;
/** Wear one; `arrow` is a choice rather than an absence, so it is stored. */
export declare function cursorPatch(cursor: CanvasCursor): MetaPatch;
/** Back to whatever the ground implies. */
export declare function noCursorPatch(): MetaPatch;
/**
 * **Which pointer this canvas wears — the NAME, not the drawing** (9 Sep 2026).
 *
 * > "A cursor should only be loaded if a theme is loaded"
 *
 * This returned an SVG path until Dion read the size gate's answer and asked
 * that. He is right, and the fix is a boundary rather than a lazy import: the
 * path data was 7 shapes in core, which every first visit downloaded, and a
 * canvas on the dot grid draws exactly one of them. Core is imported eagerly
 * by everything; there is no honest way to make part of it arrive later.
 *
 * So the paths went to the surface that draws them
 * (`web/src/lib/cursorart.ts`, fetched only when the answer here is not
 * `arrow`) and core kept the DECISION, which is the half both surfaces need
 * and the half that carries the rule.
 *
 * It is the same seam the design system already uses — core holds the tokens,
 * the surface renders them — and it reads better than what it replaced: the
 * CLI never drew a cursor, so it was carrying seven path strings to print
 * sentences about grounds.
 *
 * ## The order is the rule, not a preference
 *
 * A seeded ground names its cursor and wins, so a galaxy cannot be given a
 * fish — that is `THEME_PROP`'s invariant, and this is where it is enforced
 * rather than hoped for. Only a canvas standing on a picture, which names
 * nothing, reads the chosen one.
 */
export declare function canvasCursorName(canvas: {
    properties?: Record<string, string>;
}): CanvasCursor;
/**
 * **The cursor a SEEDED ground gives everybody**, keyed by theme.
 *
 * Its own function rather than folded into `canvasCursorName`, because this is
 * the half that must not be overridable: a theme names its cursor, and the
 * library's names are the same names, so a picked "sparkle" and a galaxy's
 * cursor can never become two drawings of one idea.
 *
 * **Farm got its sheep on 9 Sep; desert still borrows the crescent.** Dion
 * asked for both, and only one of them is possible.
 *
 * A sun cannot be a cursor here, and the reason is structural rather than a
 * failure of drawing: a sun is radially symmetric and a cursor has to point.
 * Two attempts were drawn and rendered at 18, 24 and 32px — pulling one ray
 * out to the hotspot makes a spike by construction, and what you get is a
 * COMET, which also happens to be the sparkle's cousin. A cactus was tried for
 * the same slot and has no natural top-left tip at all.
 *
 * So the crescent stays, and it is not a placeholder: a desert moon is a good
 * story, and the shape is the sharpest tip in the library. What desert would
 * actually want is a shape somebody thinks of that nobody has yet.
 */
export declare function themeCursorName(theme: CanvasTheme | null): CanvasCursor;
