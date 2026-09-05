/**
 * DESIGN.md — a design system both a person and an agent can read.
 *
 * The format is Google Labs' (github.com/google-labs-code/design.md,
 * Apache-2.0): YAML front matter carrying typed design tokens, then markdown
 * sections carrying the reasoning. The tokens are normative and the prose says
 * how to apply them, which is exactly the split this canvas needs — an agent
 * grading a screen wants numbers, and a person deciding what to build wants
 * sentences.
 *
 * Adopting somebody's format rather than inventing one is the whole point: the
 * same file works in other tools, converts to and from `tokens.json` and
 * Figma variables, and does not need this canvas to be present to be useful.
 *
 * THE YAML HERE IS A SUBSET, deliberately. Core has one dependency and a YAML
 * library would land in every install of isocan to serve the canvases that
 * have a design system. What the schema actually uses is maps up to three deep,
 * scalar values, and one list of strings-or-small-maps — so that is what this
 * reads, and anything outside it is reported rather than guessed at.
 */
export interface DesignTypography {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: number | string;
    lineHeight?: string | number;
    letterSpacing?: string;
    fontFeature?: string;
    fontVariation?: string;
}
export interface DesignTokens {
    version?: string;
    name?: string;
    description?: string;
    /** Sections left out on purpose, so a linter stays quiet about them. */
    omitted?: (string | {
        section: string;
        reason?: string;
    })[];
    colors?: Record<string, string>;
    typography?: Record<string, DesignTypography>;
    rounded?: Record<string, string>;
    spacing?: Record<string, string | number>;
    components?: Record<string, Record<string, string>>;
}
export interface DesignDoc {
    tokens: DesignTokens;
    /** Everything after the front matter, verbatim. */
    body: string;
    /** `## Heading` → its prose, in the order they appear. */
    sections: {
        title: string;
        body: string;
    }[];
    /** What could not be read, said rather than swallowed. */
    problems: string[];
}
/** The section order the spec asks for. */
export declare const DESIGN_SECTIONS: string[];
/** The canonical name of a heading, or the heading itself when it is not one
 * of the spec's sections. */
export declare function canonicalSection(heading: string): string;
/** The subset parser. Exported for its own tests — it is the part most likely
 * to meet something it was not built for. */
export declare function parseFrontMatter(yaml: string): {
    data: Record<string, unknown>;
    problems: string[];
};
/** Read a DESIGN.md: its tokens, its prose, and what it could not read. */
export declare function parseDesign(text: string): DesignDoc;
/**
 * Every `{path}` in a value, resolved by substitution — a value may hold
 * several (`{spacing.md} {spacing.lg}` is a padding, `{spacing.xs} 0` a
 * shorthand). Whole-string matching called 214 of a 74-file corpus's 308
 * errors "not in this file" when every path was; this reads each one.
 */
export declare function referencesIn(value: string): string[];
/** The references in a value that do not resolve — empty when it is sound. */
export declare function unresolvedReferences(tokens: DesignTokens, value: string): string[];
/** `{colors.primary}` → the value it points at, or null. */
export declare function resolveToken(tokens: DesignTokens, reference: string): unknown;
/** Write it back out: front matter, then the prose. */
export declare function serializeDesign(tokens: DesignTokens, body: string): string;
