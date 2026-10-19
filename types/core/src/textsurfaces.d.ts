import type { Paper } from "./textnode.js";
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
