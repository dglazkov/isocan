/**
 * The tells of a machine-made interface.
 *
 * Taste does not fit in a prompt, but its opposite very nearly does: there is
 * a short list of moves that generated designs reach for over and over, and
 * every one of them is CHECKABLE — a selector, a declared value, a repeated
 * shape — rather than a matter of opinion. That is what makes this worth
 * writing down and worth automating: an audit can cite the line.
 *
 * It is a FLOOR, not taste. Removing these reliably stops the bad thing; it
 * does not produce the good thing. The good thing comes from the design system
 * being specific (designsystem.ts) and from somebody rejecting drafts.
 *
 * Every rule has to say how to SPOT it, or an agent will report a vibe.
 *
 * WORDS COUNT AS DESIGN. Copy is most of what is on a screen and it has its
 * own tells, which are just as checkable as a gradient — a phrase, a
 * construction, a heading style you can point at. The `copy` rules below owe
 * their shape to `blader/humanizer` and, behind it, Wikipedia's *Signs of AI
 * writing*; they are kept here rather than in a separate skill because an
 * audit that grades the type scale and ignores the sentences has graded half a
 * screen. `slopRulesAsText(kind)` narrows the list when only one half is
 * wanted.
 */
/** What the tell is made of. The two halves of a screen. */
type SlopKind = "visual" | "copy";
interface SlopRule {
    name: string;
    kind: SlopKind;
    /** How to find it in the source, concretely. */
    spot: string;
    /** What to do about it. */
    instead: string;
}
export declare const SLOP_RULES: SlopRule[];
/** The list as an agent should read it. */
/** The rules as prompt text — all of them, or one half. */
export declare function slopRulesAsText(kind?: SlopKind): string;
export {};
