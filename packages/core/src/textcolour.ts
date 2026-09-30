import { CONTRAST_BODY, contrastRatio } from "./contrast.ts";
import type { Item } from "./model.ts";
import {
  TEXT_COLOR_PROP,
  TEXT_COLOURS,
  TEXT_FACE_PROP,
  TEXT_FONTS,
  TEXT_FONT_PROP,
  TEXT_PROPERTIES,
  TEXT_STYLE_PROP,
  paperOf,
  paperPatch,
  textColourOf,
  textFontFrom,
  textFontOf,
  type Paper,
  type TextFace,
  type TextFont,
  type TextStyle,
} from "./textnode.ts";

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
export const TEXT_COLOUR_SHADES: Record<TextColour, { light: string; dark: string; paper: string }> = {
  red: { light: "#df222f", dark: "#f2707a", paper: "#a71821" },
  orange: { light: "#cc4400", dark: "#f59042", paper: "#993300" },
  yellow: { light: "#877100", dark: "#e8c547", paper: "#635300" },
  green: { light: "#218339", dark: "#5cc672", paper: "#18622b" },
  blue: { light: "#1f70db", dark: "#6ea8f0", paper: "#1753a1" },
  purple: { light: "#9650d3", dark: "#b98ce8", paper: "#762db6" },
  pink: { light: "#d42583", dark: "#ec7fbd", paper: "#9e1c61" },
  brown: { light: "#8b5a2b", dark: "#c76300", paper: "#7a491f" },
  grey: { light: "#6d737b", dark: "#9aa0a8", paper: "#50555b" },
};

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

/** A text colour as a property holds it: a name, or a lowercase `#rrggbb`. */
export type TextColourValue = TextColour | `#${string}`;

/**
 * What somebody typed, as the property's value: a name (any case), `#rgb` or
 * `#rrggbb` (normalised to lowercase six digits), `"auto"` for the theme's
 * own ink — or null, so the caller can refuse with the list rather than guess.
 */
export function textColourFrom(value: string): TextColourValue | "auto" | null {
  const wanted = value.trim().toLowerCase();
  if (wanted === "auto" || wanted === "") return "auto";
  const named = TEXT_COLOURS.find((c) => c === wanted || (wanted === "gray" && c === "grey"));
  if (named) return named;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(wanted)?.[1];
  if (!hex) return null;
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex}`;
}

/**
 * **Where a colour will not read**, as sentences — empty when it reads
 * everywhere it can land. A name is always empty, by the test above; a hex is
 * measured against the ground in both themes, or against its paper in both
 * when it is on one.
 */
export function textColourWarnings(colour: TextColourValue | null, paper: Paper | null): string[] {
  if (colour === null || !colour.startsWith("#")) return [];
  const out: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    const surface = paper ? TEXT_SURFACES[theme].papers[paper] : TEXT_SURFACES[theme].ground;
    const ratio = contrastRatio(colour, surface);
    if (ratio !== null && ratio < CONTRAST_BODY) {
      out.push(
        `${colour} measures ${ratio}:1 on the ${paper ? `${paper} paper` : "ground"} in the ${theme} theme — body text needs ${CONTRAST_BODY}. A named colour adapts to the theme; a hex is drawn exactly.`,
      );
    }
  }
  return out;
}

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
export function textLookPatch(look: TextLook): { properties: Record<string, string>; removeProperties: string[] } {
  const face = look.font ? look.font.face : look.face;
  const set: Record<string, string | null | undefined> = {
    [TEXT_STYLE_PROP]: look.style === "body" ? null : look.style,
    [TEXT_FACE_PROP]: face === "sans" ? null : face,
    [TEXT_COLOR_PROP]: look.colour,
    [TEXT_FONT_PROP]: look.font === undefined ? undefined : (look.font?.name ?? null),
  };
  const properties: Record<string, string> = {};
  const removeProperties: string[] = [];
  for (const [key, value] of Object.entries(set)) {
    if (value === null) removeProperties.push(key);
    else if (value !== undefined) properties[key] = value;
  }
  const onPaper = paperPatch(look.paper);
  if ("properties" in onPaper) Object.assign(properties, onPaper.properties);
  else removeProperties.push(...onPaper.removeProperties);
  return { properties, removeProperties };
}

/** The properties a NEW text node is born with in this look — the add-side of `textLookPatch`. */
export function textLookProperties(look: TextLook): Record<string, string> {
  return { ...TEXT_PROPERTIES, ...textLookPatch(look).properties };
}

/** `--color`, read or refused with the whole list — `auto` is null, the theme's ink. */
export function textColourChoice(value: string): TextColourValue | null {
  const parsed = textColourFrom(value);
  if (parsed === null) {
    throw new Error(`a text colour is one of: ${TEXT_COLOURS.join(", ")}, a #rrggbb, or auto — got: ${value}`);
  }
  return parsed === "auto" ? null : parsed;
}

/** `--font`, read or refused with the whole list — `none` (or empty) is null, the plain face. */
export function textFontChoice(value: string): TextFont | null {
  if (/^(none|)$/i.test(value.trim())) return null;
  const font = textFontFrom(value);
  if (!font) throw new Error(`a font is one of: ${TEXT_FONTS.map((f) => f.name).join(", ")}, or none — got: ${value}`);
  return font;
}

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
export function textPropsPatch(
  item: Item,
  patch: { properties?: Record<string, string>; removeProperties?: string[] },
): { properties?: Record<string, string>; removeProperties?: string[]; warnings: string[] } {
  const properties = { ...patch.properties };
  const removeProperties = [...(patch.removeProperties ?? [])];
  const drop = (key: string) => {
    delete properties[key];
    if (!removeProperties.includes(key)) removeProperties.push(key);
  };
  if (TEXT_COLOR_PROP in properties) {
    const colour = textColourChoice(properties[TEXT_COLOR_PROP]!);
    if (colour === null) drop(TEXT_COLOR_PROP);
    else properties[TEXT_COLOR_PROP] = colour;
  }
  if (TEXT_FONT_PROP in properties) {
    const font = textFontChoice(properties[TEXT_FONT_PROP]!);
    if (font === null) drop(TEXT_FONT_PROP);
    else {
      properties[TEXT_FONT_PROP] = font.name;
      if (font.face === "sans") drop(TEXT_FACE_PROP);
      else properties[TEXT_FACE_PROP] = font.face;
    }
  } else if (TEXT_FACE_PROP in properties && textFontOf(item)) {
    drop(TEXT_FONT_PROP);
  }
  const next = { ...item.properties, ...properties };
  for (const key of removeProperties) delete next[key];
  const warnings = textColourWarnings(textColourOf(next), paperOf({ ...item, properties: next }));
  return {
    ...(Object.keys(properties).length ? { properties } : {}),
    ...(removeProperties.length ? { removeProperties } : {}),
    warnings,
  };
}
