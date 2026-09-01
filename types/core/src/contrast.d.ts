/**
 * Contrast, computed rather than judged.
 *
 * "That grey looks a bit light" is an opinion nobody can act on; "3.1:1, and
 * body text needs 4.5" is a number and a fix. It is a dozen lines of sRGB
 * maths, and having it in core is what lets an audit and a linter agree —
 * and what keeps a palette honest at the moment it is written, rather than
 * after somebody ships it.
 */
/** WCAG 2.2 minimums. Large is 18.66px bold or 24px regular. */
export declare const CONTRAST_BODY = 4.5;
export declare const CONTRAST_LARGE = 3;
/** Non-text: the boundary of a control, an icon that carries meaning. */
export declare const CONTRAST_UI = 3;
/** #rgb / #rrggbb → channels, or null for anything else. Named colours and
 * oklch() are legal in DESIGN.md and are not resolvable without a browser, so
 * they get an honest null rather than a guess. */
export declare function parseHex(color: string): {
    r: number;
    g: number;
    b: number;
} | null;
/** Relative luminance, per WCAG. */
export declare function luminance(color: string): number | null;
/** The ratio between two colours, 1–21, or null when either is not a hex. */
export declare function contrastRatio(a: string, b: string): number | null;
/** Does this pair carry text at that size? */
export declare function passesContrast(a: string, b: string, need?: number): boolean | null;
