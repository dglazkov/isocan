import type { Paper } from "./textnode.ts";

/**
 * The surfaces words land on, by theme — the stylesheet's `--ground` and the
 * five papers. Copied here (and held equal to `styles.css` by
 * `web/test/textcolour.test.ts`) so the CLI can say where a hex will not
 * read without a browser.
 */
export const TEXT_SURFACES: {
  light: { ground: string; papers: Record<Paper, string> };
  dark: { ground: string; papers: Record<Paper, string> };
} = {
  light: {
    ground: "#fbfbf9",
    papers: { yellow: "#fdf3c3", pink: "#fbdce6", blue: "#d8ebf9", green: "#d9f0dc", grey: "#e6e7e3" },
  },
  dark: {
    ground: "#0e0f12",
    papers: { yellow: "#e6dba8", pink: "#e4c3ce", blue: "#c3d6e4", green: "#c2d8c6", grey: "#cdcec9" },
  },
};
