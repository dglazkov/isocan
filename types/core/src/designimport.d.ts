import type { DesignTokens } from "./designmd.js";
/**
 * **Bringing somebody else's theme onto this canvas.**
 *
 * The research that asked for this looked at seven component-library sites and
 * found the same thing at each: what they actually publish that survives the
 * trip is a set of TOKENS. Not components, which arrive with a build step and
 * a runtime, but the colours, radii and type a house has agreed on. This takes
 * those and lands them as this canvas's DESIGN.md, which is the one change
 * that makes all seven useful.
 *
 * Two shapes go in, because those are the two the world actually ships:
 *
 * - **CSS custom properties** — a `:root { --primary: … }` block. This is what
 *   a shadcn theme IS, what a Tailwind config compiles to, and what anybody
 *   can paste out of devtools.
 * - **W3C DTCG JSON** — the interchange format, `{ "$value": …, "$type": … }`,
 *   which is what a design tool exports when it exports anything.
 *
 * **Nothing is dropped in silence.** A property this cannot classify is
 * reported, not discarded: an import that quietly loses half a theme is worse
 * than one that says which half it could not read, because the first is
 * discovered weeks later by somebody wondering why a colour is missing.
 */
export interface ImportedDesign {
    tokens: DesignTokens;
    /** What could not be read or placed, in the importer's own words. */
    problems: string[];
    /** Which shape it turned out to be, for the report. */
    format: "css" | "dtcg";
}
type Bucket = "colors" | "rounded" | "spacing" | "typography" | null;
/**
 * Where one token belongs. Value first, then the name — a `#ff0000` named
 * `--spacing-large` is a colour whatever it is called, because the value is a
 * fact and the name is somebody's habit.
 */
export declare function classifyToken(name: string, value: string): Bucket;
/**
 * Every custom property in a stylesheet, wherever it is declared.
 *
 * **Not just `:root`.** A shadcn theme puts its light palette in `:root` and
 * its dark one in `.dark`, and an importer that read only the first would take
 * half a theme and say nothing. Later declarations win, which is what the
 * cascade would do — so pasting a file with both leaves the dark values, and
 * pasting only the block you want is how you choose.
 */
export declare function readCssTokens(css: string): Map<string, string>;
/** Which shape this text is, decided by reading it rather than by a flag. */
export declare function detectFormat(text: string): "css" | "dtcg";
/** A theme's name, from the file it came in. `shadcn-theme.css` → "shadcn
 *  theme" — enough that `design check` has something to cite and a person can
 *  see at a glance which import this is. */
export declare function importedName(source: string): string;
export declare function importDesign(text: string, source?: string): ImportedDesign;
/**
 * The prose that ships with an import.
 *
 * A DESIGN.md is a document an agent READS before it designs, so a file that
 * is nothing but a token table teaches nothing. This says where the tokens
 * came from and what the sections are for — and says plainly that the prose is
 * a starting point, because a house's actual rules are not in its colour
 * palette and pretending otherwise is how an imported theme becomes a lie
 * about what a team has agreed.
 */
export declare function importedBody(source: string, tokens: DesignTokens): string;
export {};
