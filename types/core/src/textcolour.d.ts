import type { Item } from "./model.js";
import { TEXT_COLOURS, type Paper, type TextFace, type TextFont, type TextStyle } from "./textnode.js";
/**
 * **A text node's colour, and how a named one stays readable on every
 * ground** (30 Sep 2026).
 *
 * Asked for as "text colour — no colour setting, only paper backgrounds".
 * The words come from the vocabulary `colour.ts` already keeps — the colours
 * a person says out loud, closed — so "make the red one bigger" names the
 * same red on the canvas, in `isocan context`, and in somebody's mouth.
 *
 * ## Adapt, rather than warn, for a name
 *
 * A NAME is a promise about what somebody will see, and there is no single
 * red that reads on both `--ground`s: a red that holds 4.5:1 on the light
 * ground is a dark red, which on graphite is a smudge. So a name resolves to
 * a SHADE per surface — the light ground, the dark ground, and paper — each
 * chosen against the surface it lands on, the way every hue in the
 * stylesheet's dark block is "lifted for the dark ground" rather than dimmed.
 * Paper is one shade in both themes because paper is pale in both themes;
 * that is `--paper-ink`'s argument, reused.
 *
 * Warning instead would put the choice in front of a person with no good
 * answer — "your red is unreadable in dark mode" is true of EVERY red — and a
 * collaborator in the other theme would read the canvas the author could not
 * see. `test/textcolour.test.ts` measures every shade against its surface
 * with `contrast.ts` and holds each at `CONTRAST_BODY`; the light and dark
 * canvas shades must also still say their own name (`spokenColour`), so red
 * does not quietly become pink in the dark. Paper shades are exempt from the
 * name check: a readable orange on dim paper is dark enough that English
 * calls it brown, and it is still the orange somebody picked.
 *
 * ## Warn, rather than adapt, for a hex
 *
 * `#rrggbb` is a colour somebody chose EXACTLY, so it is drawn exactly; the
 * CLI says where it will not read (`textColourWarnings`) and sets it anyway.
 *
 * ## Why not black and white
 *
 * No shade of black reads on graphite, and none of white on the light
 * ground, so neither can keep the promise a name makes. The theme's own ink —
 * "auto", or no property at all — is already near-black in light and
 * near-white in dark, which is what somebody asking for black meant.
 */
/** One of the named text colours. */
type TextColour = (typeof TEXT_COLOURS)[number];
/**
 * **The shades.** `light` on the light ground (#fbfbf9), `dark` on graphite
 * (#0e0f12), `paper` on every paper in both themes. The stylesheet carries
 * them as `--text-<name>` (light/dark) and `--paper-text-<name>` (both
 * themes), and `web/test/textcolour.test.ts` holds the two copies equal.
 */
export declare const TEXT_COLOUR_SHADES: Record<TextColour, {
    light: string;
    dark: string;
    paper: string;
}>;
/**
 * The surfaces words land on, by theme — the stylesheet's `--ground` and the
 * five papers. Copied here (and held equal to `styles.css` by
 * `web/test/textcolour.test.ts`) so the CLI can say where a hex will not
 * read without a browser.
 */
export declare const TEXT_SURFACES: {
    light: {
        ground: string;
        papers: Record<Paper, string>;
    };
    dark: {
        ground: string;
        papers: Record<Paper, string>;
    };
};
/** A text colour as a property holds it: a name, or a lowercase `#rrggbb`. */
export type TextColourValue = TextColour | `#${string}`;
/**
 * What somebody typed, as the property's value: a name (any case), `#rgb` or
 * `#rrggbb` (normalised to lowercase six digits), `"auto"` for the theme's
 * own ink — or null, so the caller can refuse with the list rather than guess.
 */
export declare function textColourFrom(value: string): TextColourValue | "auto" | null;
/**
 * **Where a colour will not read**, as sentences — empty when it reads
 * everywhere it can land. A name is always empty, by the test above; a hex is
 * measured against the ground in both themes, or against its paper in both
 * when it is on one.
 */
export declare function textColourWarnings(colour: TextColourValue | null, paper: Paper | null): string[];
/**
 * Everything that decides how a text node looks. Null means the default;
 * the colour and the font may also be left out, which leaves whatever the
 * node already has — a caller that predates them cannot wipe them.
 */
interface TextLook {
    style: TextStyle;
    face: TextFace;
    paper: Paper | null;
    colour?: TextColourValue | null | undefined;
    font?: TextFont | null | undefined;
}
/**
 * **The one spelling of a look**, as the patch that sets it — so the web's
 * bar and `isocan text`/`set` cannot write the same node two ways.
 *
 * Defaults are ABSENCE: `body`, `sans`, no paper, the theme's ink, no font
 * are each a removed property, never the word, so a node that says nothing
 * renders as every node made before the choice existed. A font writes its
 * face beside it, so a client that predates fonts still draws the right KIND
 * of letter.
 */
export declare function textLookPatch(look: TextLook): {
    properties: Record<string, string>;
    removeProperties: string[];
};
/** The properties a NEW text node is born with in this look — the add-side of `textLookPatch`. */
export declare function textLookProperties(look: TextLook): Record<string, string>;
/** `--color`, read or refused with the whole list — `auto` is null, the theme's ink. */
export declare function textColourChoice(value: string): TextColourValue | null;
/** `--font`, read or refused with the whole list — `none` (or empty) is null, the plain face. */
export declare function textFontChoice(value: string): TextFont | null;
/**
 * **`isocan set --prop textColor=… textFont=…`, spelled the way the bar
 * spells it.** A property patch is a bag anybody could write, so on a text
 * node this reads the two new keys through the same doors as `--color` and
 * `--font`: a name is lower-cased, a hex normalised, `auto`/`none` become a
 * removal rather than a word, anything else is refused with the list. A font
 * writes its face beside it (`textLookPatch`'s rule); a face set on its own
 * lets go of a font, the way choosing a face on the bar does. The colour's
 * warnings are measured against the paper the node will have.
 */
export declare function textPropsPatch(item: Item, patch: {
    properties?: Record<string, string>;
    removeProperties?: string[];
}): {
    properties?: Record<string, string>;
    removeProperties?: string[];
    warnings: string[];
};
export {};
