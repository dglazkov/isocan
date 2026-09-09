import type { DesignTokens } from "./designmd.js";
/**
 * **Does this screen actually use the system it was built under?**
 *
 * `/design-audit` has existed since the design system did, is well written,
 * and — measured on 8 Sep 2026 across six live canvases — **has never once
 * been run.** Zero audit documents, everywhere. That is not a failure of the
 * command; it is what happens to a step somebody has to remember to type. The
 * fix this repo reaches for every time is to give the thing a NUMBER, so it
 * can be watched instead of remembered.
 *
 * ## What is checkable, and what deliberately is not
 *
 * `slop.ts` holds forty tells and is the right list, but its `spot` fields are
 * prose written for an agent to read — *"font-family lists Inter, and no
 * second face is declared anywhere"*. Prose is not a checker, and dressing it
 * up as one would be this codebase's own lesson #14: a check whose answer
 * cannot be "no". So none of that is here.
 *
 * What IS here is the one finding the design system exists to prevent, stated
 * as an integer: **values a screen uses that the system never named.** Six
 * type scales and four blues is the failure `designsystem.ts` opens with, and
 * it is arithmetic — a colour is in the palette or it is not.
 *
 * That leaves taste entirely alone, which is correct. A screen with zero
 * off-system values can still be dull; this says it is not INCOHERENT, which
 * is the floor a system can enforce and the most a machine should claim.
 *
 * ## Why literals rather than a rendered page
 *
 * The audit command already argues this and it is worth keeping: *"a ratio you
 * computed beats a colour you looked at, and half of what matters — the scale,
 * the spacing unit, the focus states — is invisible in a screenshot."* This
 * reads the source for the same reason, and gains a second: a source read is
 * deterministic, so it can be a standing number rather than a judgement that
 * moves when the renderer does.
 */
/** One value a screen used that its design system never named, and enough to
 *  point at it: a report that cannot cite the line is a report about vibes. */
interface OffSystemValue {
    /** The literal as written in the screen. */
    value: string;
    /** How the system names this kind of thing, for the message. */
    kind: "colour" | "type size" | "radius";
    /** How many times it appears. */
    count: number;
    /** The first line it appears on, 1-based, so a finding can be pointed at. */
    line: number;
}
/** One screen's reading. Both halves matter: the departures are what to fix,
 *  and the conformance is what to keep — a report with no green is a report
 *  people stop believing. */
export interface ScreenAudit {
    /** Values used that the design system never named. */
    offSystem: OffSystemValue[];
    /** What it did use from the system, so a report can say what is GOOD —
     *  a report with no green is a report people stop believing. */
    onSystem: number;
}
/**
 * Every value this screen uses that the system never named.
 *
 * `source` is the screen's HTML, read whole — inline `<style>`, a `style=`
 * attribute and a linked stylesheet's contents all look the same to a regex,
 * and all three are equally a place to write a fourth blue.
 */
export declare function auditScreen(source: string, tokens: DesignTokens): ScreenAudit;
/** One number for a canvas: how many distinct off-system values its screens
 *  use between them. The thing a persona would watch. */
export declare function offSystemTotal(audits: ScreenAudit[]): number;
export {};
