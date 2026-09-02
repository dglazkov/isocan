/**
 * **A persona: a named role an agent takes on.**
 *
 * A lens, the skills to use it, a goal it is judged against, and a memory of
 * what it already found. `docs/projects/personas/design.md` is the argument;
 * this file is the one reading of the format, so the CLI, the web app and any
 * harness that opens the file are looking at the same thing.
 *
 * **The persona is the costume, not the actor.** Any agent can wear one, and
 * the canvas already knows who is actually working — presence is a session
 * with an actor behind it. Nothing here identifies a person.
 *
 * The file is Markdown with YAML-ish front matter, in the shape Claude Code
 * already parses, so the doorway in `.claude/agents/` needs no translation.
 * Keys that vendor does not know (`goal`, `runs`, `trigger`) are ours and it
 * ignores them, which is the whole reason to stay inside its shape rather than
 * invent a better one.
 */

/**
 * **A goal is a number, a bound, and the command that produces it.**
 *
 * Not an aspiration. The night shift's rule, which this borrows verbatim
 * because it is stricter than it looks: a change may be called an improvement
 * only if it names, BEFORE the work starts, a number that is already being
 * measured. "Keep the design accessible" is not a goal. "Zero contrast
 * failures at 390, 768 and 1440, measured by `grade.mjs`" is one.
 *
 * `at` is deliberately absent until somebody measures it. A baseline invented
 * at authoring time is a number nobody took, and a persona judged against one
 * is judged against fiction — see `baselineOf`.
 */
interface PersonaGoal {
  /** What is counted, in the words a person would use. */
  name: string;
  /** The direction that is good, and the line. */
  bound: { kind: "at most" | "at least"; value: number };
  /** The command that produces the number. Runnable, not descriptive. */
  measuredBy: string;
  /** The unit, when there is one — "ms", "%", left off for a plain count. */
  unit?: string;
  /** What it measured when the baseline was taken, and when. */
  baseline?: { value: number; at: string; commit?: string };
}

/** Time, or an event. `docs/projects/personas/design.md` argues for starting
 *  with time: it is built, and its failure mode is boring. */
type PersonaTrigger =
  | { kind: "schedule"; cron: string }
  | { kind: "push"; to: string; paths?: string[] }
  | { kind: "manual" };

export interface Persona {
  /** The filename's stem, and the name every surface calls it by. */
  name: string;
  /** When to reach for it — one line, because it is read in a list. */
  description: string;
  model?: string;
  effort?: string;
  /** Tool names, as the harness spells them. Not validated here: this file
   *  must not become a registry of what some vendor allows this month. */
  tools: string[];
  goals: PersonaGoal[];
  trigger: PersonaTrigger;
  /** Where its runs are filed. */
  runs?: string;
  /** Everything after the front matter — the lens itself, in prose, which is
   *  the part a model actually reads. Kept verbatim. */
  body: string;
  /** Front-matter keys this build did not recognise, kept so a round trip
   *  through an editor cannot silently delete somebody else's. */
  extra: Record<string, string>;
}

export const PERSONA_DIR = ".agents/personas";
/**
 * Where the vendor doorway goes. A relative symlink to the file above, never
 * a copy — `installSkill` uses the same arrangement for the skill, and its
 * comment says why: one copy per directory, several doorways to it.
 */
export const PERSONA_DOORWAY = ".claude/agents";

/** Split front matter from body. Returns null when there is no front matter,
 *  which is a file that is not a persona rather than a malformed one. */
export function splitFrontMatter(text: string): { front: string; body: string } | null {
  // `\r?\n` throughout: these files are committed, and a repo cloned on
  // Windows arrives with CRLF whatever anybody intended.
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return null;
  return { front: match[1]!, body: text.slice(match[0].length) };
}

/**
 * The subset of YAML these files actually use, read directly rather than by
 * pulling in a parser.
 *
 * **The line to hold: this is not a YAML implementation and must not grow into
 * one.** It reads `key: value`, a list of `- item` under a key, and a list of
 * indented `key: value` blocks under a key. Anything else is left in `extra`
 * verbatim, so a file this build does not fully understand still round-trips
 * without losing anything. A persona format that needs anchors and multi-line
 * folding is a persona format that has gone wrong.
 */
function readFront(front: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let key: string | null = null;
  for (const raw of front.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const indented = /^\s/.test(raw);
    if (!indented) {
      const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
      if (!m) continue;
      key = m[1]!;
      out.set(key, m[2]!.trim() === "" ? [] : [m[2]!.trim()]);
      continue;
    }
    if (key) out.get(key)!.push(raw.trim());
  }
  return out;
}

const unquote = (s: string) => s.replace(/^["']|["']$/g, "").trim();

/**
 * **`at most 12ms` and `at least 3`** — the two bounds a goal can have, read
 * off one line so the file stays something a person writes by hand.
 *
 * The unit rides with the number rather than in its own key, because that is
 * how anybody would type it, and separating them is the kind of tidiness that
 * makes a format worse to use than to parse.
 */
export function parseBound(text: string): { bound: PersonaGoal["bound"]; unit?: string } | null {
  const m = /^(at most|at least)\s+([0-9]+(?:\.[0-9]+)?)\s*([%a-zA-Z]*)$/.exec(text.trim());
  if (!m) return null;
  return {
    bound: { kind: m[1] as "at most" | "at least", value: Number(m[2]) },
    ...(m[3] ? { unit: m[3] } : {}),
  };
}

/** One `- name: … / at most: … / measured by: …` block. */
function readGoals(lines: string[]): PersonaGoal[] {
  const goals: PersonaGoal[] = [];
  let current: Record<string, string> | null = null;
  const flush = () => {
    if (!current) return;
    const name = current["name"];
    const measuredBy = current["measured by"] ?? current["measuredBy"];
    const boundText = current["at most"] !== undefined
      ? `at most ${current["at most"]}`
      : current["at least"] !== undefined
        ? `at least ${current["at least"]}`
        : "";
    const parsed = parseBound(boundText);
    // A goal missing any of its three parts is DROPPED rather than half-kept.
    // Half a goal is a bound with nothing measuring it, or a command with no
    // line to cross — either one reports success forever, which is the exact
    // failure this whole feature is meant to make impossible.
    if (name && measuredBy && parsed) {
      goals.push({
        name,
        bound: parsed.bound,
        measuredBy,
        ...(parsed.unit ? { unit: parsed.unit } : {}),
        ...(current["baseline"]
          ? (() => {
              const [value, at, commit] = current["baseline"]!.split(/\s*,\s*/);
              return Number.isFinite(Number(value)) && at
                ? { baseline: { value: Number(value), at, ...(commit ? { commit } : {}) } }
                : {};
            })()
          : {}),
      });
    }
    current = null;
  };
  for (const line of lines) {
    const start = /^-\s*(.*)$/.exec(line);
    if (start) {
      flush();
      current = {};
      if (start[1]) {
        const m = /^([^:]+):\s*(.*)$/.exec(start[1]);
        if (m) current[m[1]!.trim()] = unquote(m[2]!);
      }
      continue;
    }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m && current) current[m[1]!.trim()] = unquote(m[2]!);
  }
  flush();
  return goals;
}

function readTrigger(lines: string[] | undefined): PersonaTrigger {
  if (!lines || lines.length === 0) return { kind: "manual" };
  const kv = new Map<string, string>();
  for (const line of lines) {
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m) kv.set(m[1]!.trim(), unquote(m[2]!));
  }
  const cron = kv.get("cron") ?? kv.get("schedule");
  if (cron) return { kind: "schedule", cron };
  if (kv.get("on") === "push") {
    const paths = kv.get("paths");
    return {
      kind: "push",
      to: kv.get("to") ?? "main",
      ...(paths ? { paths: paths.split(/\s*,\s*/).filter(Boolean) } : {}),
    };
  }
  return { kind: "manual" };
}

/**
 * Read one persona file. `name` falls back to the filename's stem, because a
 * file whose front matter disagrees with what it is called is a persona two
 * surfaces would refer to differently.
 */
export function parsePersona(text: string, filename: string): Persona | null {
  const split = splitFrontMatter(text);
  if (!split) return null;
  const front = readFront(split.front);
  const one = (key: string) => front.get(key)?.[0];
  const stem = filename.replace(/\.md$/i, "").split("/").pop() ?? filename;
  const known = new Set(["name", "description", "model", "effort", "tools", "goal", "goals", "trigger", "runs", "color"]);
  const extra: Record<string, string> = {};
  for (const [key, value] of front) {
    if (!known.has(key)) extra[key] = value.join("\n");
  }
  return {
    name: one("name") ?? stem,
    description: one("description") ?? "",
    ...(one("model") !== undefined ? { model: one("model")! } : {}),
    ...(one("effort") !== undefined ? { effort: one("effort")! } : {}),
    tools: (one("tools") ?? "").split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean),
    goals: readGoals(front.get("goal") ?? front.get("goals") ?? []),
    trigger: readTrigger(front.get("trigger")),
    ...(one("runs") !== undefined ? { runs: one("runs")! } : {}),
    body: split.body,
    extra,
  };
}

/**
 * **What a persona is judged on, in one line per goal.** The same sentence on
 * every surface — a list in the terminal, a row in the app — because a goal
 * described two ways is a goal two people disagree about.
 */
export function goalLine(goal: PersonaGoal): string {
  const unit = goal.unit ?? "";
  const target = `${goal.bound.kind} ${goal.bound.value}${unit}`;
  if (!goal.baseline) return `${goal.name} — ${target}, never measured`;
  const met = goal.bound.kind === "at most"
    ? goal.baseline.value <= goal.bound.value
    : goal.baseline.value >= goal.bound.value;
  return `${goal.name} — ${target}; was ${goal.baseline.value}${unit} on ${goal.baseline.at}${met ? "" : " — MISSED"}`;
}

/**
 * **A persona with no measured goal cannot fail**, and the build rule from the
 * design says so plainly: three instruments this week reported nothing and were
 * believed. This is that rule as a function, so both surfaces can say it in the
 * same words rather than each deciding how loudly to worry.
 */
export function personaWarnings(persona: Persona): string[] {
  const out: string[] = [];
  if (persona.goals.length === 0) {
    out.push("no goal — this persona cannot report a number, only prose");
  }
  const unmeasured = persona.goals.filter((g) => !g.baseline);
  if (unmeasured.length > 0) {
    out.push(
      `${unmeasured.length} goal${unmeasured.length === 1 ? "" : "s"} never measured — ` +
        "run it once and record the baseline, or the bound is a guess",
    );
  }
  if (persona.trigger.kind === "manual" && persona.goals.length > 0) {
    out.push("no trigger — somebody has to remember to run it");
  }
  return out;
}

/** Newest baseline wins; used when a run records one. */
export function withBaseline(
  persona: Persona,
  goalName: string,
  reading: { value: number; at: string; commit?: string },
): Persona {
  return {
    ...persona,
    goals: persona.goals.map((g) => (g.name === goalName ? { ...g, baseline: reading } : g)),
  };
}

/**
 * **What a run found, and what was done about it.**
 *
 * Step 5 of `docs/projects/personas/design.md`: a finding is accepted,
 * rejected, or unanswered — *"still no score, just the column."*
 *
 * Read out of the run page's own table rather than kept in a second file,
 * because the page is what a person edits when they decide. A record that
 * lives beside the thing it describes cannot drift from it; one that lives
 * elsewhere needs somebody to keep the two in step, and nobody ever does.
 */
type FindingOutcome = "accepted" | "rejected" | "unanswered";

export interface RunFinding {
  finding: string;
  outcome: FindingOutcome;
}

const OUTCOMES = new Set<string>(["accepted", "rejected", "unanswered"]);

/**
 * The findings table of one run page. Anything that is not one of the three
 * words is read as `unanswered` — a cell somebody typed a sentence into is a
 * finding nobody has decided, and guessing at their meaning would be worse
 * than saying so.
 */
export function runFindings(page: string): RunFinding[] {
  const start = page.indexOf("## Findings");
  if (start < 0) return [];
  const out: RunFinding[] = [];
  for (const line of page.slice(start).split(/\r?\n/)) {
    if (line.startsWith("#") && !line.startsWith("## Findings")) break;
    const cells = /^\|([^|]*)\|([^|]*)\|\s*$/.exec(line);
    if (!cells) continue;
    const finding = cells[1]!.trim();
    const outcome = cells[2]!.trim().toLowerCase();
    // The header row and the empty-table placeholder are not findings.
    if (finding === "" || finding === "—" || finding === "Finding" || /^-+$/.test(finding)) continue;
    out.push({
      finding,
      outcome: (OUTCOMES.has(outcome) ? outcome : "unanswered") as FindingOutcome,
    });
  }
  return out;
}

/**
 * **Counted, and deliberately not scored.**
 *
 * An accept rate over five findings is noise, and a trust score that governs
 * autonomy before it means anything is a way to lose trust in trust. So this
 * returns the tally and nothing derived from it: the ratio is somebody's to
 * compute when there is enough to argue about.
 */
export function tallyOutcomes(findings: readonly RunFinding[]): Record<FindingOutcome, number> {
  const tally: Record<FindingOutcome, number> = { accepted: 0, rejected: 0, unanswered: 0 };
  for (const f of findings) tally[f.outcome] += 1;
  return tally;
}
