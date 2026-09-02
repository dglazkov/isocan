import { CONTRAST_BODY, CONTRAST_UI, contrastRatio, parseHex } from "./contrast.ts";
import { DESIGN_SECTIONS, resolveToken, type DesignDoc } from "./designmd.ts";

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

export function checkDesign(doc: DesignDoc): DesignFinding[] {
  const findings: DesignFinding[] = [];
  const { tokens } = doc;

  for (const problem of doc.problems) {
    findings.push({ severity: "error", where: "front matter", what: problem });
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
    if (String(value).startsWith("{")) {
      if (resolveToken(tokens, String(value)) === null) {
        findings.push({
          severity: "error",
          where: `colors.${name}`,
          what: `points at ${value}, which is not in this file`,
          fix: "fix the path, or inline the value",
        });
      }
      continue;
    }
    if (parseHex(String(value)) === null && !/^(rgb|hsl|hwb|oklch|oklab|lch|lab|color-mix)\(|^[a-z]+$/i.test(String(value))) {
      findings.push({
        severity: "error",
        where: `colors.${name}`,
        what: `"${value}" is not a CSS colour`,
      });
    }
  }

  // References anywhere else have to resolve too.
  for (const [component, props] of Object.entries(tokens.components ?? {})) {
    for (const [prop, value] of Object.entries(props)) {
      if (String(value).startsWith("{") && resolveToken(tokens, String(value)) === null) {
        findings.push({
          severity: "error",
          where: `components.${component}.${prop}`,
          what: `points at ${value}, which is not in this file`,
        });
      }
    }
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

  return findings;
}

/** Worst first, so a report leads with what matters. */
export function bySeverity(findings: DesignFinding[]): DesignFinding[] {
  const rank: Record<DesignSeverity, number> = { error: 0, warning: 1, note: 2 };
  return [...findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
