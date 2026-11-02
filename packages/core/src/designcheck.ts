import { compileDesignContract } from "./design-contract.ts";
import { CONTRAST_BODY, CONTRAST_UI, contrastRatio, parseHex } from "./contrast.ts";
import { readDesignDirection } from "./design-direction.ts";
import { DESIGN_SECTIONS, DESIGN_SURFACES, unresolvedReferences, type DesignDoc } from "./designmd.ts";

/**
 * Is this design system usable, or just written down?
 *
 * A style guide fails quietly: a colour that no longer parses, a reference to
 * a token somebody renamed, an accent that cannot carry text on its own
 * ground. None of it announces itself — the screens simply drift, and by then
 * the guide is the thing nobody trusts.
 *
 * So the checks are the ones a machine can be right about: shapes, references,
 * and arithmetic. Whether a palette is any GOOD is not in here and should not
 * be; that is what the prose and a person are for.
 */

type DesignSeverity = "error" | "warning" | "note";

interface DesignFinding {
  severity: DesignSeverity;
  /** Where it is: a token path, a section name, or "front matter". */
  where: string;
  what: string;
  /** What to do, when there is a single obvious answer. */
  fix?: string;
}

/** Sections the spec expects; anything listed in `omitted` is excused. */
function omittedSections(doc: DesignDoc): Set<string> {
  const out = new Set<string>();
  for (const entry of doc.tokens.omitted ?? []) {
    out.add(typeof entry === "string" ? entry.toLowerCase() : entry.section.toLowerCase());
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidSourcesMap(value: unknown): value is Record<string, string> {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(
    ([key, item]) => key.trim().length > 0 && typeof item === "string" && item.trim().length > 0,
  );
}

/**
 * **Read board tile citations from `tokens.isocan.sources`** (moodboard phase 3,
 * design §5) — maps token paths (`colors.<name>`) and direction fields
 * (`direction.<field>`, `direction.treatments.<name>`) to the `itemId` of the
 * kept or reference tile each came from. Returns `{}` when absent or malformed.
 */
export function readDesignSources(doc: DesignDoc | undefined | null): Record<string, string> {
  if (!doc?.tokens || !isPlainObject(doc.tokens.isocan)) return {};
  const raw = doc.tokens.isocan.sources;
  if (!isValidSourcesMap(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = value.trim();
  return out;
}

export function checkDesign(doc: DesignDoc, options?: { boardTileIds?: ReadonlySet<string> }): DesignFinding[] {
  const findings: DesignFinding[] = [];
  const { tokens } = doc;

  for (const problem of doc.problems) {
    findings.push({ severity: "error", where: "front matter", what: problem });
  }

  for (const problem of compileDesignContract(tokens).problems) {
    findings.push({ severity: "error", where: problem.path, what: problem.message });
  }

  if (!tokens.name) {
    findings.push({
      severity: "warning",
      where: "front matter",
      what: "the system has no name",
      fix: "add `name:` — it is what an agent cites when it says which system it built to",
    });
  }

  if (!tokens.colors || Object.keys(tokens.colors).length === 0) {
    findings.push({
      severity: "error",
      where: "colors",
      what: "no colour tokens",
      fix: "at least `primary` — the spec requires it, and prose alone cannot be graded against",
    });
  } else if (!tokens.colors.primary) {
    findings.push({
      severity: "warning",
      where: "colors",
      what: "no `primary` colour",
      fix: "name one palette `primary`, so anything reading this knows where to start",
    });
  }

  // Every value that claims to be a colour has to be one.
  for (const [name, value] of Object.entries(tokens.colors ?? {})) {
    if (String(value).includes("{")) {
      const missing = unresolvedReferences(tokens, String(value));
      if (missing.length > 0) {
        findings.push({
          severity: "error",
          where: `colors.${name}`,
          what: `points at ${missing.join(" and ")}, which ${missing.length === 1 ? "is" : "are"} not in this file`,
          fix: "fix the path, or inline the value",
        });
      }
      continue;
    }
    if (parseHex(String(value)) === null && !/^(rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix|color)\(|^[a-z]+$/i.test(String(value).trim())) {
      findings.push({
        severity: "error",
        where: `colors.${name}`,
        what: `"${value}" is not a CSS colour`,
      });
    }
  }

  // References anywhere else have to resolve too — each one, inside a value
  // that may hold several (`{spacing.md} {spacing.lg}` is a padding).
  for (const [component, props] of Object.entries(tokens.components ?? {})) {
    for (const [prop, value] of Object.entries(props)) {
      const missing = String(value).includes("{") ? unresolvedReferences(tokens, String(value)) : [];
      if (missing.length > 0) {
        findings.push({
          severity: "error",
          where: `components.${component}.${prop}`,
          what: `points at ${missing.join(" and ")}, which ${missing.length === 1 ? "is" : "are"} not in this file`,
        });
      }
    }
  }

  // A surface nobody draws is read as flat — said, so a typo is not a silent downgrade.
  if (tokens.surface !== undefined && !(DESIGN_SURFACES as readonly string[]).includes(String(tokens.surface).trim().toLowerCase())) {
    findings.push({
      severity: "warning",
      where: "surface",
      what: `"${tokens.surface}" is not a surface this canvas draws — it is read as flat`,
      fix: DESIGN_SURFACES.join(", "),
    });
  }

  // Typography: a level with no size is a level nothing can be set in.
  for (const [name, level] of Object.entries(tokens.typography ?? {})) {
    if (!level.fontSize) {
      findings.push({
        severity: "warning",
        where: `typography.${name}`,
        what: "no fontSize",
        fix: "a level without a size cannot be applied; give it one or drop it",
      });
    }
  }

  // The arithmetic nobody does by eye.
  const ground = tokens.colors?.neutral ?? tokens.colors?.background ?? tokens.colors?.surface;
  const ink = tokens.colors?.primary;
  if (ground && ink) {
    const ratio = contrastRatio(String(ink), String(ground));
    if (ratio !== null && ratio < CONTRAST_BODY) {
      findings.push({
        severity: "error",
        where: "colors.primary",
        what: `${ratio}:1 against the ground — body text needs ${CONTRAST_BODY}:1`,
        fix: "darken the ink or lighten the ground; this is the one finding that excludes people",
      });
    }
  }
  const accent = tokens.colors?.tertiary ?? tokens.colors?.accent;
  if (ground && accent) {
    const ratio = contrastRatio(String(accent), String(ground));
    if (ratio !== null && ratio < CONTRAST_UI) {
      findings.push({
        severity: "warning",
        where: "colors.accent",
        what: `${ratio}:1 against the ground — a control's edge needs ${CONTRAST_UI}:1`,
      });
    }
  }

  // Sections: present, and in the order the spec asks for.
  const excused = omittedSections(doc);
  const present = doc.sections.map((section) => section.title);
  for (const section of ["Overview", "Colors", "Typography"]) {
    if (!present.includes(section) && !excused.has(section.toLowerCase())) {
      findings.push({
        severity: "warning",
        where: section,
        what: "section missing",
        fix: `add "## ${section}" — the tokens say what, the prose says why`,
      });
    }
  }
  const ranked = present
    .map((title) => DESIGN_SECTIONS.indexOf(title))
    .filter((index) => index >= 0);
  if (ranked.some((index, i) => i > 0 && index < ranked[i - 1]!)) {
    findings.push({
      severity: "note",
      where: "sections",
      what: "sections are out of the spec's order",
      fix: DESIGN_SECTIONS.join(" → "),
    });
  }

  // Board-derived systems cite their kept tiles in `isocan.sources` (moodboard phase 3, design §5).
  if (isPlainObject(tokens.isocan) && tokens.isocan.sources !== undefined) {
    if (!isValidSourcesMap(tokens.isocan.sources)) {
      findings.push({
        severity: "error",
        where: "isocan.sources",
        what: "isocan.sources must map token and direction paths to nonempty tile itemIds",
      });
    } else {
      const sources = readDesignSources(doc);
      const dirRead = readDesignDirection(doc);
      const rationale = dirRead.status === "valid" ? dirRead.direction.rationale.toLowerCase() : "";

      for (const [name, value] of Object.entries(tokens.colors ?? {})) {
        if (!sources[`colors.${name}`]) {
          const nameLower = name.toLowerCase();
          const valueLower = String(value).trim().toLowerCase();
          const explained =
            rationale.includes(nameLower) ||
            (valueLower.length > 0 && rationale.includes(valueLower));
          if (!explained) {
            findings.push({
              severity: "error",
              where: `colors.${name}`,
              what: "uncited palette token — cite a kept tile in isocan.sources or explain it in direction.rationale",
            });
          }
        }
      }

      if (dirRead.status === "valid") {
        for (const field of ["layout", "density", "typography", "palettePurpose"] as const) {
          const cited = sources[`direction.${field}`] ?? sources[field];
          if (!cited) {
            const lower = field.toLowerCase();
            const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();
            if (!rationale.includes(lower) && !rationale.includes(spaced)) {
              findings.push({
                severity: "error",
                where: `direction.${field}`,
                what: "uncited direction field — cite a kept tile in isocan.sources or explain it in direction.rationale",
              });
            }
          }
        }
        for (const treatment of dirRead.direction.treatments) {
          const cited = sources[`direction.treatments.${treatment.name}`] ?? sources["direction.treatments"];
          if (!cited && !rationale.includes(treatment.name.toLowerCase())) {
            findings.push({
              severity: "error",
              where: `direction.treatments.${treatment.name}`,
              what: "uncited direction field — cite a kept tile in isocan.sources or explain it in direction.rationale",
            });
          }
        }
      }

      if (options?.boardTileIds) {
        for (const [path, itemId] of Object.entries(sources)) {
          if (!options.boardTileIds.has(itemId)) {
            findings.push({
              severity: "error",
              where: `isocan.sources.${path}`,
              what: `cites ${itemId}, which is not a kept or reference tile on the Mood board`,
            });
          }
        }
      }
    }
  }

  return findings;
}

/** Worst first, so a report leads with what matters. */
export function bySeverity(findings: DesignFinding[]): DesignFinding[] {
  const rank: Record<DesignSeverity, number> = { error: 0, warning: 1, note: 2 };
  return [...findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
