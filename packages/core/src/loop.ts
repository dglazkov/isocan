import { frontMatterFields } from "./docstatus.ts";
import { splitFrontMatter } from "./persona.ts";

/**
 * **Loop's insights, triaged here rather than trusted there.**
 *
 * Stitch Loop mines a repository against standing priorities and files
 * *insights*. It files them generously — near-duplicates under new ids, claims
 * about code that has since changed, work already done — and ranks them by its
 * own lights. So an insight is an input, not a verdict. Each one becomes a
 * *finding* in `docs/loop/`, where the ranking, the project it belongs to and
 * the decision are ours.
 *
 * The same rule as the roadmap: the decision lives in the finding's own front
 * matter, and every view of it — `docs/LOOP.md`, the Loop column in
 * `docs/ROADMAP.md`, the context sent back to Loop — is derived from those
 * files. Nothing stores what can be computed, including whether a dismissal
 * still needs sending: that is read off Loop's own state for the ids.
 *
 * Pure on purpose. The reading of files and the talking to the `stitch` CLI
 * are `scripts/loop.mjs`; nothing here touches either, so the reducer's
 * package stays portable.
 */

/**
 * Where a finding stands.
 *
 * - `untriaged` — pulled from Loop, nobody has read it.
 * - `proposed`  — someone (usually an agent) has checked the claim against the
 *   code and proposed a rank and a home. Waiting on a person.
 * - `accepted`  — a person agreed it is work; it belongs to `project`.
 * - `declined`  — a person said no, and `note` says why. Dismissed in Loop.
 * - `stale`     — the claim does not match the code (fixed since, or never
 *   true). Dismissed in Loop, with the evidence in `note`.
 * - `done`      — accepted and then fixed.
 */
export const LOOP_DECISIONS = ["untriaged", "proposed", "accepted", "declined", "stale", "done"] as const;
type LoopDecision = (typeof LOOP_DECISIONS)[number];

/** Decisions that end a finding's life in Loop: they are sent as dismissals. */
export const DISMISSED_BY_US: readonly LoopDecision[] = ["declined", "stale"];

/**
 * Our priority, deliberately not Loop's P0–P3 vocabulary, so the two can never
 * be confused in a diff. `never` on a proposal is a recommendation to decline.
 */
export const LOOP_RANKS = ["now", "next", "later", "never"] as const;
type LoopRank = (typeof LOOP_RANKS)[number];

type LoopState = "ACTIVE" | "RESOLVED" | "DISMISSED";

/** One insight as Loop reports it, reduced to what triage uses. */
export interface LoopInsight {
  id: string;
  title: string;
  description: string;
  state: LoopState;
  /** Loop's own "P2", or "P2/S1" when it sends a severity too. */
  rank: string;
  confidence: number | null;
  /** The name of the standing priority it was mined against, when known. */
  goal: string | null;
  files: string[];
}

export interface LoopFinding {
  slug: string;
  title: string;
  /** Every Loop insight id filed for this finding. Loop re-files; they all land here. */
  loop: string[];
  /** Loop's most severe rank across those ids, kept only for comparison. */
  loop_rank: string | null;
  /** Loop's aggregate state across those ids, as of the last pull. */
  loop_state: LoopState | null;
  loop_goal: string | null;
  decision: LoopDecision;
  rank: LoopRank | null;
  /** The `docs/projects/<name>` this belongs to, or "new" to propose one. */
  project: string | null;
  /** The `docs/reviews/lessons.md` row whose shape this is an instance of. */
  lesson: number | null;
  since: string | null;
  note: string | null;
  body: string;
}

// ── Parsing and writing ──────────────────────────────────────────────────

/** Front matter order on disk, so a diff shows what changed and not what moved. */
const FIELDS: (keyof LoopFinding)[] = [
  "title",
  "loop",
  "loop_rank",
  "loop_state",
  "loop_goal",
  "decision",
  "rank",
  "project",
  "lesson",
  "since",
  "note",
];

/** Fields that may hold any words, and so are written in double quotes. */
const QUOTED = new Set<keyof LoopFinding>(["title", "note", "loop_goal"]);

const unquote = (v: string) => v.replace(/\\(["\\])/g, "$1");
const quote = (v: string) => `"${v.replace(/\s+/g, " ").trim().replace(/[\\"]/g, "\\$&")}"`;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseFinding(raw: string, slug: string): LoopFinding {
  const split = splitFrontMatter(raw);
  const kv = split ? frontMatterFields(split.front) : new Map<string, string>();
  const str = (k: string) => {
    const v = kv.get(k);
    return v && v.trim() ? unquote(v.trim()) : null;
  };
  const oneOf = <T extends string>(k: string, all: readonly T[]): T | null => {
    const v = str(k);
    return v !== null && (all as readonly string[]).includes(v) ? (v as T) : null;
  };
  const lesson = str("lesson");
  const since = str("since");
  return {
    slug,
    title: str("title") ?? slug,
    loop: (kv.get("loop") ?? "")
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
    loop_rank: str("loop_rank"),
    loop_state: oneOf<LoopState>("loop_state", ["ACTIVE", "RESOLVED", "DISMISSED"]),
    loop_goal: str("loop_goal"),
    decision: oneOf("decision", LOOP_DECISIONS) ?? "untriaged",
    rank: oneOf("rank", LOOP_RANKS),
    project: str("project"),
    lesson: lesson !== null && /^\d+$/.test(lesson) ? Number(lesson) : null,
    since: isDay(since) ? since : null,
    note: str("note"),
    body: (split?.body ?? raw).trim(),
  };
}

export function serializeFinding(f: LoopFinding): string {
  const lines: string[] = [];
  for (const k of FIELDS) {
    const v = f[k];
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
    const text = Array.isArray(v) ? v.join(", ") : String(v);
    lines.push(`${k}: ${QUOTED.has(k) ? quote(text) : text}`);
  }
  return `---\n${lines.join("\n")}\n---\n\n${f.body.trim()}\n`;
}

/**
 * What is wrong with a finding, in words meant to be read. `projects` is the
 * set of `docs/projects/` directory names; when given, a `project` that names
 * none of them is a finding pointing at nothing.
 */
export function findingProblems(f: LoopFinding, projects?: readonly string[]): string[] {
  const out: string[] = [];
  if (!f.loop.length) out.push("no loop ids — nothing links it back to Loop");
  if (f.decision === "untriaged") return out;
  if (!f.since) out.push("no since — the date it entered this decision");
  if (!f.note) out.push(`no note — a ${f.decision} finding says why`);
  if ((f.decision === "proposed" || f.decision === "accepted") && !f.rank) {
    out.push(`no rank — one of ${LOOP_RANKS.join(", ")}`);
  }
  if (f.decision === "accepted" && f.rank === "never") out.push("accepted with rank never — decline it instead");
  if (f.decision === "accepted" && f.project === null) {
    out.push("accepted with no project — say where the work lives, or project: new");
  }
  if (projects && f.project && f.project !== "new" && !projects.includes(f.project)) {
    out.push(`project ${f.project} is not a directory under docs/projects/`);
  }
  return out;
}

export function slugify(title: string): string {
  const full = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (full.length <= 60) return full;
  // Cut at a word boundary, so a slug never ends in half a word.
  const cut = full.slice(0, 61);
  return cut.slice(0, cut.lastIndexOf("-")) || full.slice(0, 60);
}

// ── From Loop's wire format ──────────────────────────────────────────────

const REPO_BLOB = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\//;

/**
 * One raw insight from `stitch find insights --format json`. `goalTitles` maps
 * a priority id to its name, so a finding says "Always isomorphic" and not an
 * id nobody can read.
 */
export function normalizeInsight(raw: Record<string, any>, goalTitles: ReadonlyMap<string, string> = new Map()): LoopInsight {
  const refs = Object.values((raw.references ?? {}) as Record<string, any>);
  const files = refs
    .map((r) => r?.source?.uri)
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.replace(REPO_BLOB, ""));
  const goalId = ((raw.priorities?.[0] ?? raw.goals?.[0]) as string | undefined)?.split("/").pop();
  return {
    id: String(raw.id),
    title: String(raw.title ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    state: (["ACTIVE", "RESOLVED", "DISMISSED"].includes(raw.state) ? raw.state : "ACTIVE") as LoopState,
    // Either part can be missing while Loop re-mines an insight; say only what it said.
    rank: [raw.priority, raw.severity].filter((x) => typeof x === "string" && x).join("/") || "unranked",
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    goal: goalId ? (goalTitles.get(goalId) ?? goalId) : null,
    files: [...new Set(files)],
  };
}

/** "P1/S0" sorts before "P2/S1", and "P2/S1" before a bare "P2". Unknown sorts last. */
function loopSeverity(rank: string | null): string {
  const p = rank?.match(/P(\d)/)?.[1] ?? "9";
  const s = rank?.match(/S(\d)/)?.[1] ?? "9";
  return `${p}${s}`;
}

/**
 * Loop's aggregate view of a finding. Any id still ACTIVE keeps the finding
 * active in Loop — exactly the case where a decision still needs sending.
 * Otherwise dismissed wins over resolved: it records that a person looked.
 */
function aggregateState(states: LoopState[]): LoopState | null {
  if (!states.length) return null;
  if (states.includes("ACTIVE")) return "ACTIVE";
  if (states.includes("DISMISSED")) return "DISMISSED";
  return "RESOLVED";
}

interface LoopReconciled {
  findings: LoopFinding[];
  /** Newly created, by slug. */
  added: string[];
  /** Existing findings that gained a re-filed Loop id, by slug. */
  refiled: string[];
  /** Findings whose ids Loop now reports all resolved, while we have not said done. */
  resolvedInLoop: string[];
  /** Findings dismissed in Loop that nobody here has decided on. */
  dismissedInLoop: string[];
}

function insightBody(i: LoopInsight): string {
  const files = i.files.map((f) => `- \`${f}\``);
  const conf = i.confidence === null ? "" : `, confidence ${i.confidence}`;
  return [
    `# ${i.title}`,
    "",
    `> **Loop says** (${i.rank}${conf}): ${i.description}`,
    ...(files.length ? ["", ...files] : []),
    "",
    "## Our read",
    "",
    "Not yet checked against the code.",
  ].join("\n");
}

/**
 * Fold a fresh pull from Loop into the findings on disk.
 *
 * An insight joins the finding that already holds its id, else the one with
 * the same title (Loop's re-filings keep the title and mint a new id), else it
 * starts a new finding. Our fields — decision, rank, project, note, body — are
 * never touched: a pull refreshes what Loop says, not what we decided.
 */
export function reconcile(existing: LoopFinding[], insights: LoopInsight[]): LoopReconciled {
  const findings = existing.map((f) => ({ ...f, loop: [...f.loop] }));
  const byId = new Map<string, LoopFinding>();
  const byTitle = new Map<string, LoopFinding>();
  const slugs = new Set(findings.map((f) => f.slug));
  for (const f of findings) {
    for (const id of f.loop) byId.set(id, f);
    byTitle.set(f.title.toLowerCase(), f);
  }

  const added: string[] = [];
  const refiled = new Set<string>();
  const seen = new Map<LoopFinding, LoopInsight[]>();

  for (const i of insights) {
    let f = byId.get(i.id) ?? byTitle.get(i.title.toLowerCase());
    if (!f) {
      let slug = slugify(i.title) || i.id.slice(0, 8);
      if (slugs.has(slug)) slug = `${slug}-${i.id.slice(0, 6)}`;
      slugs.add(slug);
      f = {
        slug,
        title: i.title,
        loop: [],
        loop_rank: null,
        loop_state: null,
        loop_goal: i.goal,
        decision: "untriaged",
        rank: null,
        project: null,
        lesson: null,
        since: null,
        note: null,
        body: insightBody(i),
      };
      findings.push(f);
      byTitle.set(i.title.toLowerCase(), f);
      added.push(slug);
    }
    if (!f.loop.includes(i.id)) {
      if (!added.includes(f.slug)) refiled.add(f.slug);
      f.loop.push(i.id);
    }
    byId.set(i.id, f);
    seen.set(f, [...(seen.get(f) ?? []), i]);
  }

  const resolvedInLoop: string[] = [];
  const dismissedInLoop: string[] = [];
  for (const [f, xs] of seen) {
    f.loop_state = aggregateState(xs.map((x) => x.state));
    f.loop_rank = xs.map((x) => x.rank).sort((a, b) => loopSeverity(a).localeCompare(loopSeverity(b)))[0] ?? f.loop_rank;
    f.loop_goal ??= xs[0]!.goal;
    if (f.loop_state === "RESOLVED" && f.decision !== "done" && f.decision !== "stale") resolvedInLoop.push(f.slug);
    if (f.loop_state === "DISMISSED" && (f.decision === "untriaged" || f.decision === "proposed")) {
      dismissedInLoop.push(f.slug);
    }
  }

  return { findings, added, refiled: [...refiled], resolvedInLoop, dismissedInLoop };
}

/**
 * Loop ids that still need dismissing: every id of a finding we declined or
 * found stale that Loop still shows as active. Derived from Loop's own state,
 * so re-filed ids are covered without anyone remembering to.
 */
export function pendingDismissals(findings: LoopFinding[], insights: LoopInsight[]): { slug: string; id: string }[] {
  const active = new Set(insights.filter((i) => i.state === "ACTIVE").map((i) => i.id));
  const out: { slug: string; id: string }[] = [];
  for (const f of findings) {
    if (!DISMISSED_BY_US.includes(f.decision)) continue;
    for (const id of f.loop) if (active.has(id)) out.push({ slug: f.slug, id });
  }
  return out;
}

// ── Views ────────────────────────────────────────────────────────────────

const RANK_ORDER: Record<string, number> = { now: 0, next: 1, later: 2, never: 3 };
const byRank = (a: LoopFinding, b: LoopFinding) =>
  (RANK_ORDER[a.rank ?? ""] ?? 4) - (RANK_ORDER[b.rank ?? ""] ?? 4) ||
  loopSeverity(a.loop_rank).localeCompare(loopSeverity(b.loop_rank)) ||
  a.title.localeCompare(b.title);

/** Per project: how many findings are accepted and how many await a decision. */
export function projectCounts(findings: LoopFinding[]): Map<string, { accepted: number; proposed: number }> {
  const out = new Map<string, { accepted: number; proposed: number }>();
  for (const f of findings) {
    if (f.project === null || (f.decision !== "accepted" && f.decision !== "proposed")) continue;
    const c = out.get(f.project) ?? { accepted: 0, proposed: 0 };
    c[f.decision] += 1;
    out.set(f.project, c);
  }
  return out;
}

/** What each decision means, counted — the line the roadmap and LOOP.md both print. */
export function loopSummary(findings: LoopFinding[]): string {
  const n = (d: LoopDecision) => findings.filter((f) => f.decision === d).length;
  return (
    `${n("proposed")} to decide · ${n("accepted")} accepted · ${n("declined")} declined · ` +
    `${n("stale")} stale · ${n("done")} done · ${n("untriaged")} not yet read`
  );
}

const LOOP_DOC_HEADER =
  "<!-- Generated by scripts/loop.mjs. Do not edit — edit the finding in docs/loop/,\n     which is where its decision lives. -->";

/** `docs/LOOP.md`: every finding, by what it needs from a person. */
export function renderLoopDoc(findings: LoopFinding[]): string {
  const where = (p: string | null) => (p === "new" ? "new project" : p === null ? "—" : `[${p}](projects/${p}/)`);
  const row = (f: LoopFinding) =>
    `| ${f.rank ?? "—"} | [${f.title}](loop/${f.slug}.md) | ${f.loop_rank ?? "—"} | ${where(f.project)}${
      f.lesson === null ? "" : ` · [lesson ${f.lesson}](reviews/lessons.md)`
    } | ${(f.note ?? "—").replace(/\|/g, "\\|")} |`;
  const table = (xs: LoopFinding[]) => [
    "| Ours | Finding | Loop | Where | Why |",
    "| --- | --- | --- | --- | --- |",
    ...[...xs].sort(byRank).map(row),
    "",
  ];
  const of = (d: LoopDecision) => findings.filter((f) => f.decision === d);

  const out: string[] = [
    LOOP_DOC_HEADER,
    "# Loop findings",
    "",
    "What [Stitch Loop](https://jules.google.com/jitro) found in this codebase,",
    "**ranked by us, not by Loop**. Each finding is a file in [`loop/`](loop/)",
    "holding Loop's claim, our read of it against the code, and the decision.",
    "Loop's own rank is kept only for comparison. Declined and stale findings are",
    "dismissed in Loop, and every decision is sent back to it as a context so its",
    "next pass knows why. `node scripts/loop.mjs pull` fetches; `decide <slug>",
    "<decision>` decides — and deciding is a person's, because it is sent to a",
    "workspace other people read.",
    "",
    `**${loopSummary(findings)}.**`,
    "",
  ];

  const proposed = of("proposed");
  if (proposed.length) {
    out.push("## Needs a decision", "", "Proposed rank and home; `never` is a recommendation to decline.", "");
    out.push(...table(proposed));
  }

  const accepted = of("accepted");
  if (accepted.length) {
    out.push("## Accepted, by project", "");
    const groups = new Map<string, LoopFinding[]>();
    for (const f of accepted) groups.set(f.project ?? "", [...(groups.get(f.project ?? "") ?? []), f]);
    for (const k of [...groups.keys()].sort()) out.push(`### ${where(k || null)}`, "", ...table(groups.get(k)!));
  }

  for (const [d, heading, lede] of [
    ["declined", "Declined", "Real, and not doing it. Dismissed in Loop, with the reason sent back."],
    ["stale", "Stale", "The claim does not match the code. Dismissed in Loop, with the evidence sent back."],
    ["done", "Done", ""],
  ] as const) {
    const xs = of(d);
    if (!xs.length) continue;
    out.push(`## ${heading}`, "", ...(lede ? [lede, ""] : []), ...table(xs));
  }

  const untriaged = of("untriaged");
  if (untriaged.length) {
    out.push(
      "## Not yet read",
      "",
      ...[...untriaged].sort(byRank).map((f) => `- [${f.title}](loop/${f.slug}.md) — Loop ${f.loop_rank ?? "?"}`),
      "",
    );
  }

  const broken = findings.filter((f) => findingProblems(f).length);
  if (broken.length) {
    out.push("## Needs fixing", "");
    for (const f of broken) out.push(`- [\`${f.slug}\`](loop/${f.slug}.md) — ${findingProblems(f).join("; ")}`);
    out.push("");
  }
  return out.join("\n");
}

/**
 * The context sent back to Loop. Loop takes context as JSON and reads it while
 * mining: what we decided and why, so the next pass does not re-file what was
 * declined. Decisions only — a proposal is not ours until a person makes it,
 * so nothing merely proposed is sent, and nothing at all is sent while there is
 * nothing decided (`decisions` empty).
 */
export function loopContextPayload(findings: LoopFinding[]) {
  const decided = findings
    .filter((f) => f.decision !== "untriaged" && f.decision !== "proposed")
    .sort((a, b) => a.decision.localeCompare(b.decision) || byRank(a, b));
  return {
    kind: "isocan-triage-decisions",
    guidance:
      "People triage every Loop insight in this repo under docs/loop/ and rank it independently " +
      "(now, next, later, never). Do not re-file an insight recorded here as declined or stale unless the " +
      "code has changed in a way that answers the stated reason. Accepted insights are planned work, in the named project.",
    decisions: decided.map((f) => ({
      title: f.title,
      decision: f.decision,
      rank: f.rank,
      project: f.project,
      reason: f.note,
      decided: f.since,
      insights: f.loop,
    })),
  };
}
