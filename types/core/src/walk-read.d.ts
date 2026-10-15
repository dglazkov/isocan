/** A box in the screen's own CSS pixels, from its top-left corner. */
export interface WalkRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** A run of text, the colours it is drawn in, and how big it is. */
export interface TextRun {
    /** Where it is in the document: `html > body > main:nth-child(2) > p:nth-child(1)`. */
    path: string;
    text: string;
    /** `#rrggbb` after compositing, or null when the CSS names a colour the read cannot resolve. */
    fg: string | null;
    bg: string | null;
    fontPx: number;
    bold: boolean;
    /** Its box, when the CSS states one. */
    at: WalkRect | null;
    /** Inside a target: the text a control is named by. */
    inTarget: boolean;
}
/** Something a finger or a screen reader reaches. */
export interface WalkTarget {
    path: string;
    tag: string;
    /** `button`, `link`, `textbox`, …; `null` for an element that acts (a click handler, a tabindex) with no role. */
    role: string | null;
    /** The accessible name, or "" when it has none. */
    name: string;
    /** A field named only by its placeholder (which disappears as they type). */
    placeholderOnly: boolean;
    /** Its box when the CSS places it; its size alone when the CSS sizes it; else null. */
    at: WalkRect | null;
    size: {
        width: number;
        height: number;
    } | null;
}
/** One thing a screen reader would say, in order. */
export interface Spoken {
    path: string;
    role: string;
    name: string;
}
/** What the read found on one screen. */
export interface ScreenRead {
    viewport: {
        width: number;
        height: number;
    };
    texts: TextRun[];
    targets: WalkTarget[];
    order: Spoken[];
    /** Images with no `alt` at all (a screen reader says the file name). */
    noAlt: {
        path: string;
        src: string;
    }[];
    /** Rules the read could not match, and colours it could not resolve. */
    unread: {
        rules: number;
        colours: number;
    };
}
/**
 * **Read a screen.** `viewport` is the size it is shown at — an HTML item's
 * own width and height on the canvas, unless the file's viewport meta names a
 * width. Pure: the same bytes give the same read on every surface.
 */
export declare function readScreen(html: string, viewport: {
    width: number;
    height: number;
}): ScreenRead;
