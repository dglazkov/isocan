#!/usr/bin/env node
/**
 * **The repository's own health, as panels on a canvas.**
 *
 * The read half of `docs/research/2026-08-30-repo-admin-canvas.md`, built to
 * that note's one rule: *every panel is either derived and regenerated, or
 * decided here and nowhere else — nothing in between.* Everything this script
 * writes is the first kind. It reads personas, takes their goals' numbers, and
 * reads git; it decides nothing, and nothing on the canvas is its source.
 *
 *   node scripts/canvas-board.mjs                    # refresh every panel
 *   node scripts/canvas-board.mjs --only status      # one panel
 *   node scripts/canvas-board.mjs --dry-run          # render, write nothing
 *   node scripts/canvas-board.mjs --notify           # also say so in the Chat
 *
 * **A new VERSION, never a new item.** The note names silting — a fresh item
 * per run, forty panels by Friday — as the most likely way this goes wrong in
 * week two, so `publish()` finds the panel by title and `isocan edit`s it.
 * And it compares the rendered bytes against the version already there: a run
 * that changed nothing stacks nothing, because a version history where every
 * entry is identical is not a history.
 *
 * **A broken instrument is not a zero.** Same rule as `scripts/persona-run.mjs`,
 * for the same reason: "0 contrast failures" and "nothing could be measured"
 * must never render the same. Broken reads amber and says which command failed.
 */
import { createHash } from "node:crypto";
import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boardEnv as env } from "./board-identity.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);
const DRY = has("--dry-run");
const ONLY = arg("--only");
const NOTIFY = has("--notify");
const LAY_OUT = has("--layout");
const AS_ME = has("--as-me");
const cli = path.join(repo, "packages/cli/bin/isocan.js");

/** The canvas these panels live on. The marker in this directory names the
 *  repo's OWN canvas, which is not necessarily the board's — so the board's is
 *  configured, and says so when it has not been. */
const CANVAS =
  arg("--canvas") ??
  process.env.ISOCAN_BOARD_CANVAS ??
  (() => {
    const f = path.join(repo, ".isocan", "board.json");
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).canvas;
    return undefined;
  })();
if (!CANVAS && !DRY) {
  console.error(
    "no board canvas — set one and this is remembered:\n" +
      "  echo '{\"canvas\":\"prj_…\"}' > .isocan/board.json\n" +
      "or pass --canvas <ref>, or export ISOCAN_BOARD_CANVAS.",
  );
  process.exit(2);
}

const boardEnv = env(AS_ME);

const isocan = (...args) =>
  execFileSync("node", [cli, ...(CANVAS ? ["--canvas", CANVAS] : []), ...args], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: boardEnv,
  });
const isocanJSON = (...args) => JSON.parse(isocan("--json", ...args));
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trimEnd();
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* ── what the repo says about itself ─────────────────────────────────────── */

const personas = () => isocanJSON("persona", "ls");

/**
 * Take one goal's number. Copied in spirit from `scripts/persona-run.mjs` — a
 * command that fails, or prints something that is not a number, is a BROKEN
 * INSTRUMENT and says so. It is never read as zero.
 */
function take(goal) {
  let out;
  try {
    out = execSync(goal.measuredBy, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    return { broken: `the command failed: ${String(err.stderr ?? err.message).trim().slice(0, 240)}` };
  }
  const value = Number(out.trim().split(/\s+/).pop());
  if (!Number.isFinite(value)) {
    return { broken: `expected a number on stdout, got ${JSON.stringify(out.trim().slice(0, 80))}` };
  }
  return { value };
}
const met = (goal, value) =>
  goal.bound.kind === "at most" ? value <= goal.bound.value : value >= goal.bound.value;

/** green | red | amber | grey — grey is "no goal", which is not the same as fine. */
function verdictOf(readings, goals) {
  if (goals.length === 0) return "grey";
  if (readings.some((r) => r.broken)) return "amber";
  return readings.every((r) => met(r.goal, r.value)) ? "green" : "red";
}

/** `43 8 * * *` → `daily 08:43`. Anything cleverer than this belongs in a
 *  library, and this file has no dependencies on purpose. */
function cronWords(cron) {
  const [min, hour, dom, mon, dow] = String(cron).split(/\s+/);
  const at = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  if (dom === "*" && mon === "*" && dow === "*") return `daily ${at}`;
  if (dom === "*" && mon === "*") return `weekly ${at}`;
  return `${cron}`;
}

/** The newest run page a persona wrote, by the date its filename carries. */
function latestRun(persona) {
  const dir = path.join(repo, persona.runs ?? "docs/reviews/");
  if (!existsSync(dir)) return undefined;
  const pages = readdirSync(dir)
    .filter((f) => f.endsWith(`-${persona.name}.md`))
    .sort();
  const page = pages.at(-1);
  return page ? path.relative(repo, path.join(dir, page)) : undefined;
}

const facts = () => ({
  commit: git("rev-parse", "--short", "HEAD"),
  subject: git("log", "-1", "--pretty=%s"),
  author: git("log", "-1", "--pretty=%an"),
  when: git("log", "-1", "--pretty=%ad", "--date=iso-strict"),
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  dirty: git("status", "--porcelain").length > 0,
});

/**
 * Commits in the last `days`, newest first, with what each one touched.
 *
 * **Two passes, because `--shortstat` and `--pretty` interleave.** Asking for
 * both at once puts the stat block BETWEEN records, so any parser that reads a
 * record as "up to the next separator" silently swallows every commit after the
 * first — which is exactly what the first version of this did, and it looked
 * fine because "nothing landed in the last 14 days" is a sentence a panel can
 * say with a straight face. The stats are read separately and joined by sha.
 */
function recentCommits(days = 14) {
  const since = `--since=${days} days ago`;
  const stats = new Map();
  for (const chunk of git("log", since, "--shortstat", "--pretty=%x1e%h")
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)) {
    const [short, ...rest] = chunk.split("\n");
    stats.set(short.trim(), rest.join(" ").trim());
  }
  return git("log", since, "--date=short", "--pretty=%h%x1f%ad%x1f%an%x1f%s%x1f%b%x1e")
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [short, date, author, subject, body = ""] = chunk.split("\x1f");
      return {
        short: short.trim(),
        date,
        author,
        subject,
        body: body.trim(),
        stat: stats.get(short.trim()) ?? "",
      };
    })
    .filter((c) => c.short && c.date);
}

/**
 * The roadmap's own rows, read from the generated view. Parsing the view rather
 * than re-deriving from every front matter is deliberate: `docs/ROADMAP.md`
 * IS the derivation, and a second one here would be the exact second-copy bug
 * the design note is written around.
 */
function roadmap() {
  const file = path.join(repo, "docs/ROADMAP.md");
  if (!existsSync(file)) return { sections: [], counts: "" };
  const text = readFileSync(file, "utf8");
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^## (.+?)(?: <sub>(\d+)<\/sub>)?\s*$/);
    if (h) {
      current = { title: h[1], count: Number(h[2] ?? 0), rows: [] };
      sections.push(current);
      continue;
    }
    if (!current || !line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0]) || cells[1] === "What") continue;
    const link = cells[1].match(/\[(.+?)\]\((.+?)\)/);
    if (!link) continue;
    current.rows.push({
      kind: cells[0].replace(/\*/g, ""),
      what: link[1],
      href: link[2],
      since: cells[2],
      note: cells[3],
    });
  }
  const counts = (text.match(/\*\*(\d+ built · \d+ still open)\*\*/) ?? [])[1] ?? "";
  return { sections, counts };
}

/* ── the look ────────────────────────────────────────────────────────────── */

/**
 * The app's own tokens, re-valued for `prefers-color-scheme` rather than the
 * `data-theme` attribute the app stamps on `<html>`. A panel is served in its
 * own frame, so it never sees that attribute — following the viewer's system
 * theme is the closest thing to honest, and it is what the artifact rules ask
 * for anyway.
 */
const SHELL = `
:root {
  color-scheme: light;
  --ground:#fbfbf9; --card:#ffffff; --line:#e2e3dd; --line-soft:#eff0ea;
  --ink:#23262b; --ink-muted:#646d76; --chip:#f0f1ec; --chip-line:#e0e1da;
  --accent:#1f3fd0; --accent-wash:rgba(31,63,208,0.08);
  --good:#2e8540; --good-wash:rgba(46,133,64,0.14);
  --danger:#b3261e; --danger-wash:rgba(179,38,30,0.12);
  --warn:#a06000; --warn-wash:rgba(160,96,0,0.14);
  --radius:8px;
  --shadow-card:0 1px 2px rgba(30,34,40,.08), 0 10px 24px -14px rgba(30,34,40,.28);
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --ground:#0e0f12; --card:#1b1e23; --line:#2c313a; --line-soft:#23272e;
    --ink:#e7e9ec; --ink-muted:#8b929d; --chip:#23272e; --chip-line:#2c313a;
    --accent:#4c6ef5; --accent-wash:rgba(76,110,245,0.14);
    --good:#56b06a; --good-wash:rgba(86,176,106,0.18);
    --danger:#e5776f; --danger-wash:rgba(229,119,111,0.16);
    --warn:#d99a3a; --warn-wash:rgba(217,154,58,0.18);
    --shadow-card:0 1px 2px rgba(0,0,0,.5), 0 10px 24px -14px rgba(0,0,0,.7);
  }
}
* { box-sizing: border-box; }
body {
  margin:0; padding:20px; background:var(--ground); color:var(--ink);
  font:14px/1.5 ui-sans-serif, -apple-system, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing:antialiased;
}
h1 { font-size:19px; line-height:1.25; margin:0; letter-spacing:-0.01em; }
h2 { font-size:12px; margin:0 0 8px; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-muted); font-weight:600; }
a { color:var(--accent); text-decoration:none; }
code, .mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow-card); }
.muted { color:var(--ink-muted); }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex:none; }
.dot.green{background:var(--good)} .dot.red{background:var(--danger)}
.dot.amber{background:var(--warn)} .dot.grey{background:var(--ink-muted); opacity:.45}
.pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:.02em; }
.pill.green{background:var(--good-wash); color:var(--good)}
.pill.red{background:var(--danger-wash); color:var(--danger)}
.pill.amber{background:var(--warn-wash); color:var(--warn)}
.pill.grey{background:var(--chip); color:var(--ink-muted)}
.chip { display:inline-block; padding:2px 8px; border-radius:999px; background:var(--chip); border:1px solid var(--chip-line); font-size:11px; color:var(--ink-muted); }
table { width:100%; border-collapse:collapse; }
th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-muted); font-weight:600; padding:0 8px 6px 0; border-bottom:1px solid var(--line-soft); }
td { padding:7px 8px 7px 0; border-bottom:1px solid var(--line-soft); vertical-align:top; font-size:13px; }
tr:last-child td { border-bottom:0; }
.num { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12.5px; white-space:nowrap; }
footer { margin-top:14px; padding-top:10px; border-top:1px solid var(--line-soft); font-size:11px; color:var(--ink-muted); }
footer .mono { font-size:11px; }
`;

const page = (title, body, derivedFrom) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${SHELL}</style></head>
<body>
${body}
<footer>Derived by <span class="mono">scripts/canvas-board.mjs</span> from ${derivedFrom}.
Regenerated, never edited here — a panel edited on the canvas and regenerated from the repo is two sources for one fact.</footer>
</body></html>
`;

/* ── the panels ──────────────────────────────────────────────────────────── */

function personaPanel(p, readings, verdict, run) {
  const word = { green: "holding", red: "missed", amber: "instrument broken", grey: "no goal" }[verdict];
  const rows = readings.length
    ? readings
        .map((r) => {
          const unit = r.goal.unit ?? "";
          const target = `${r.goal.bound.kind} ${r.goal.bound.value}${unit}`;
          if (r.broken) {
            return `<tr><td>${esc(r.goal.name)}</td><td class="num muted">${esc(target)}</td>
              <td class="num">—</td><td><span class="pill amber">broken</span></td></tr>
              <tr><td colspan="4" class="muted" style="font-size:11.5px;padding-top:0;border-bottom:0">
              <span class="mono">${esc(r.goal.measuredBy)}</span> — ${esc(r.broken)}</td></tr>`;
          }
          const ok = met(r.goal, r.value);
          const was = r.goal.baseline?.value;
          // Against the BASELINE as well as the bound: a number inside its
          // bound that moved the wrong way is what a pass/fail column hides.
          const drift =
            was === undefined || was === r.value
              ? ""
              : ` <span class="muted">(was ${was}${unit} on ${esc(r.goal.baseline.at)})</span>`;
          return `<tr><td>${esc(r.goal.name)}</td><td class="num muted">${esc(target)}</td>
            <td class="num">${r.value}${esc(unit)}${drift}</td>
            <td><span class="pill ${ok ? "green" : "red"}">${ok ? "held" : "missed"}</span></td></tr>`;
        })
        .join("\n")
    : `<tr><td colspan="4" class="muted">No goal, so a run cannot say whether anything got better or
        worse. It reports prose or nothing. Give it a number, or take it off the schedule.</td></tr>`;

  const trigger =
    p.trigger?.kind === "schedule" ? cronWords(p.trigger.cron) : (p.trigger?.kind ?? "manual");

  return page(
    `${p.name} — ${word}`,
    `<div style="display:flex;align-items:baseline;gap:9px">
       <span class="dot ${verdict}" style="position:relative;top:-2px"></span>
       <h1>${esc(p.name)}</h1>
       <span class="pill ${verdict}">${esc(word)}</span>
     </div>
     <p class="muted" style="margin:9px 0 14px;font-size:13px">${esc(p.description)}</p>
     <table><thead><tr><th>Goal</th><th>Target</th><th>Now</th><th></th></tr></thead>
     <tbody>${rows}</tbody></table>
     <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px">
       <span class="chip">${esc(p.model ?? "—")} · ${esc(p.effort ?? "—")}</span>
       <span class="chip">${esc(trigger)}</span>
       <span class="chip">${(p.tools ?? []).length} tools</span>
       ${run ? `<span class="chip">last run ${esc(path.basename(run).slice(0, 10))}</span>` : `<span class="chip">no run page</span>`}
     </div>
     <div class="mono muted" style="margin-top:10px;font-size:11px">${esc(p.file)}${run ? ` · ${esc(run)}` : ""}</div>`,
    `<span class="mono">isocan --json persona ls</span> and each goal’s own measurement command`,
  );
}

/**
 * **The last CI run per workflow, at the newest sha GitHub has seen.**
 *
 * Reached through `gh`, which the design note lists as free. Everything about
 * this can be absent — no `gh`, not signed in, no network, no runs yet — and
 * every one of those absences returns `unknown`. **`unknown` never renders as
 * green**, for the same reason a broken instrument is never a zero: "nothing
 * failed" and "nothing was asked" are different facts, and a board that shows
 * them the same way is worse than a board with no signal at all.
 */
function ci() {
  let raw;
  try {
    raw = execFileSync(
      "gh",
      ["run", "list", "--limit", "20", "--json", "conclusion,status,name,headSha,createdAt"],
      { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 },
    );
  } catch (err) {
    return { unknown: String(err.stderr ?? err.message).trim().split("\n")[0].slice(0, 160) || "gh would not run" };
  }
  let runs;
  try {
    runs = JSON.parse(raw);
  } catch {
    return { unknown: "gh did not return JSON" };
  }
  if (!Array.isArray(runs) || runs.length === 0) return { unknown: "no runs recorded yet" };

  // The newest sha GitHub has SEEN, which is not necessarily local HEAD — a
  // board reporting CI for a commit nobody pushed is the same stale-copy bug
  // in miniature, so the sha is carried and shown.
  const sha = runs[0].headSha;
  const latest = new Map();
  for (const r of runs) {
    if (r.headSha !== sha) continue;
    if (!latest.has(r.name)) latest.set(r.name, r);
  }
  const workflows = [...latest.values()].map((r) => ({
    name: r.name,
    running: r.status !== "completed",
    ok: r.conclusion === "success" || r.conclusion === "skipped" || r.conclusion === "neutral",
    conclusion: r.conclusion || r.status,
  }));
  return {
    sha: sha.slice(0, 7),
    workflows,
    failed: workflows.filter((w) => !w.running && !w.ok),
    running: workflows.filter((w) => w.running),
  };
}

/**
 * **The one word.** Its rule is printed on the panel, because a light nobody
 * knows the rule for is a light nobody trusts.
 *
 * RED   — CI failed at that sha, or an instrument would not run.
 * AMBER — CI is still going, or a goal is past its bound.
 * GREEN — CI passed at that sha and every goal is holding.
 * NO SIGNAL — CI could not be reached. Never green.
 */
function signal(c, board) {
  const broken = board.some((b) => b.readings.some((r) => r.broken));
  const missed = board.some((b) => b.readings.some((r) => !r.broken && !met(r.goal, r.value)));
  if (c.unknown) return { word: broken ? "RED" : "NO SIGNAL", tone: broken ? "red" : "grey" };
  if (c.failed.length || broken) return { word: "RED", tone: "red" };
  if (c.running.length || missed) return { word: "AMBER", tone: "amber" };
  return { word: "GREEN", tone: "green" };
}

function buildPanel(c, board, f) {
  const { word, tone } = signal(c, board);
  const goals = board.flatMap((b) => b.readings);
  const missed = goals.filter((r) => !r.broken && !met(r.goal, r.value));
  const broken = goals.filter((r) => r.broken);

  const ciLine = c.unknown
    ? `<span class="pill grey">no signal</span> <span class="muted">${esc(c.unknown)}</span>`
    : c.workflows
        .map(
          (w) =>
            `<span class="pill ${w.running ? "amber" : w.ok ? "green" : "red"}">${esc(w.name)}</span>`,
        )
        .join(" ");

  // CI runs what was pushed. A board that does not say when those differ is
  // reporting a green for code nobody has seen.
  const drift =
    !c.unknown && c.sha !== f.commit
      ? `<div class="muted" style="margin-top:6px;font-size:12px">CI ran <span class="mono">${esc(c.sha)}</span>;
         you are on <span class="mono">${esc(f.commit)}</span> — this light is about the pushed commit, not yours.</div>`
      : "";

  return page(
    `Build — ${word}`,
    `<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
       <div style="font-size:clamp(48px, 17vw, 92px);line-height:1;font-weight:800;letter-spacing:-0.03em;
         color:var(--${tone === "grey" ? "ink-muted" : tone === "amber" ? "warn" : tone === "red" ? "danger" : "good"})">
         ${word}</div>
       <div style="flex:1;min-width:200px">
         <div style="display:flex;flex-wrap:wrap;gap:6px">${ciLine}</div>
         <div class="muted" style="margin-top:8px;font-size:12.5px">
           ${goals.length - missed.length - broken.length}/${goals.length} goals holding${
             missed.length ? ` · ${missed.length} past bound` : ""
           }${broken.length ? ` · ${broken.length} instrument${broken.length === 1 ? "" : "s"} broken` : ""}
         </div>
         ${drift}
       </div>
     </div>
     <p class="muted" style="margin:16px 0 0;font-size:11.5px;line-height:1.6">
       <b>GREEN</b> CI passed here and every goal holds · <b>AMBER</b> CI still going, or a goal past bound ·
       <b>RED</b> a workflow failed, or an instrument would not run · <b>NO SIGNAL</b> CI unreachable,
       which is never green</p>`,
    `<span class="mono">gh run list</span> and each goal's own measurement command`,
  );
}

/**
 * **The repo's own canvas** — the one `.isocan/project.json` names, which is a
 * committed marker and therefore travels with a clone. It is a different canvas
 * from the one this board is published to, and conflating the two is the easy
 * mistake: the board is where the panels live, the marker is what the
 * repository itself says its canvas is.
 *
 * Everything here is read with `--canvas`, so nothing rebinds this directory.
 */
function repoCanvas() {
  const marker = path.join(repo, ".isocan", "project.json");
  if (!existsSync(marker)) return { none: "this directory has no .isocan/project.json" };
  let id;
  try {
    ({ projectId: id } = JSON.parse(readFileSync(marker, "utf8")));
  } catch {
    return { none: "`.isocan/project.json` is not readable JSON" };
  }
  if (!id) return { none: "`.isocan/project.json` names no canvas" };
  const ask = (...args) => {
    try {
      return JSON.parse(
        execFileSync("node", [cli, "--json", "--canvas", id, ...args], {
          cwd: repo,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: boardEnv,
        }),
      );
    } catch (err) {
      // Unreachable is not empty. Same rule as a broken instrument.
      throw new Error(String(err.stderr ?? err.message).trim().split("\n")[0].slice(0, 200));
    }
  };
  try {
    return { id, items: ask("ls"), threads: ask("comment", "list"), who: ask("who", "--all"), activity: ask("activity") };
  } catch (err) {
    return { id, unreachable: err.message };
  }
}

function repoCanvasPanel(rc, f) {
  if (rc.none) {
    return page(
      "The repo's canvas",
      `<h1>The repo's canvas</h1>
       <p class="muted" style="margin-top:10px">${esc(rc.none)} — so this repository does not name one.
       <span class="mono">isocan use &lt;ref&gt;</span> binds this directory to a canvas, and the marker it
       writes is committable, so a clone lands on the same canvas rather than a copy of it.</p>`,
      `<span class="mono">.isocan/project.json</span>`,
    );
  }
  if (rc.unreachable) {
    return page(
      "The repo's canvas",
      `<h1>The repo's canvas</h1>
       <p style="margin-top:10px"><span class="pill amber">unreachable</span></p>
       <p class="muted" style="margin-top:10px"><span class="mono">${esc(rc.id)}</span> — ${esc(rc.unreachable)}</p>
       <p class="muted" style="font-size:12px">Unreachable is not empty: this panel will not draw an empty
       canvas from a failed read.</p>`,
      `<span class="mono">isocan --canvas ${esc(rc.id)}</span>`,
    );
  }

  const kinds = new Map();
  for (const i of rc.items) kinds.set(i.kind, (kinds.get(i.kind) ?? 0) + 1);
  // A thread whose last word is a question nobody has answered is the thing
  // worth surfacing; a thread count is not.
  const open = rc.threads.filter((t) => (t.comments.at(-1)?.body ?? "").trimStart().startsWith("/ask"));
  const live = rc.who.filter((w) => w.live);
  const recent = rc.activity.slice(0, 8);

  const body = rc.items.length === 0 && rc.threads.length === 0
    ? `<p class="muted" style="margin-top:10px">Nothing on it yet — no items, no conversation. That is a
       real state and not a failed read: the marker names <span class="mono">${esc(rc.id)}</span> and the
       canvas answered. When something lands there, this panel shows what and who, and the watcher
       (<span class="mono">npm run board:watch</span>) refreshes the board and says so in the Chat.</p>`
    : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 14px">
         <span class="chip">${rc.items.length} item${rc.items.length === 1 ? "" : "s"}</span>
         ${[...kinds].map(([k, n]) => `<span class="chip">${n} ${esc(k)}</span>`).join("")}
         <span class="chip">${rc.threads.length} thread${rc.threads.length === 1 ? "" : "s"}</span>
         ${open.length ? `<span class="pill amber">${open.length} unanswered</span>` : ""}
         ${live.length ? `<span class="pill green">${live.length} here now</span>` : ""}
       </div>
       ${
         open.length
           ? `<h2>Waiting on a person</h2>
              <table><tbody>${open
                .map(
                  (t) =>
                    `<tr><td style="width:120px" class="muted">${esc(t.comments.at(-1).author.name)}</td>` +
                    `<td>${esc((t.comments.at(-1).body ?? "").replace(/^\/ask\s*/, "").slice(0, 160))}</td></tr>`,
                )
                .join("")}</tbody></table>`
           : ""
       }
       ${
         recent.length
           ? `<h2 style="margin-top:16px">Lately</h2>
              <table><tbody>${recent
                .map(
                  (a) =>
                    `<tr><td style="width:120px" class="muted">${esc(a.who)}</td>` +
                    `<td>${esc(a.kind)} <b>${esc(a.subject ?? "")}</b>${
                      a.body ? `<div class="muted" style="font-size:11.5px;margin-top:2px">${esc(a.body.slice(0, 120))}</div>` : ""
                    }</td></tr>`,
                )
                .join("")}</tbody></table>`
           : ""
       }`;

  return page(
    "The repo's canvas",
    `<h1>The repo's canvas</h1>
     <p class="muted" style="margin:8px 0 0;font-size:13px">
       <span class="mono">${esc(rc.id)}</span>, named by this repository's committed
       <span class="mono">.isocan/project.json</span> — so a clone lands on it rather than on a copy.
       Not the canvas these panels live on.</p>
     ${body}`,
    `<span class="mono">isocan --canvas ${esc(rc.id)} ls / comment list / who / activity</span> at <span class="mono">${esc(f.commit)}</span>`,
  );
}

function statusPanel(board, f) {
  const red = board.filter((b) => b.verdict === "red");
  const amber = board.filter((b) => b.verdict === "amber");
  const green = board.filter((b) => b.verdict === "green");
  const grey = board.filter((b) => b.verdict === "grey");
  // Amber outranks red: a number nobody could take is worse news than a number
  // that went the wrong way, because it means the board itself is not reporting.
  const overall = amber.length ? "amber" : red.length ? "red" : green.length ? "green" : "grey";
  const headline = amber.length
    ? `${amber.length} instrument${amber.length === 1 ? "" : "s"} would not run`
    : red.length
      ? `${red.length} persona${red.length === 1 ? "" : "s"} past its bound`
      : "every goal holding";

  const chips = board
    .map(
      (b) =>
        `<span class="chip" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px">
           <span class="dot ${b.verdict}"></span>${esc(b.persona.name)}</span>`,
    )
    .join(" ");

  const misses = board
    .flatMap((b) =>
      b.readings
        .filter((r) => !r.broken && !met(r.goal, r.value))
        .map(
          (r) =>
            `<tr><td>${esc(b.persona.name)}</td><td>${esc(r.goal.name)}</td>
             <td class="num">${r.value}${esc(r.goal.unit ?? "")}</td>
             <td class="num muted">${esc(r.goal.bound.kind)} ${r.goal.bound.value}${esc(r.goal.unit ?? "")}</td></tr>`,
        )
        .concat(
          b.readings
            .filter((r) => r.broken)
            .map(
              (r) =>
                `<tr><td>${esc(b.persona.name)}</td><td>${esc(r.goal.name)}</td>
                 <td colspan="2" class="muted">instrument broken — <span class="mono">${esc(r.goal.measuredBy)}</span></td></tr>`,
            ),
        ),
    )
    .join("\n");

  return page(
    `Tree status — ${headline}`,
    `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
       <span class="dot ${overall}" style="width:13px;height:13px;position:relative;top:-1px"></span>
       <h1>${esc(headline)}</h1>
       <span class="muted" style="font-size:13px">${green.length} holding · ${red.length} missed · ${amber.length} broken · ${grey.length} unmeasured</span>
     </div>
     <div style="margin:14px 0 16px;display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
     ${
       misses
         ? `<h2>What is not holding</h2>
            <table><thead><tr><th>Persona</th><th>Goal</th><th>Now</th><th>Bound</th></tr></thead>
            <tbody>${misses}</tbody></table>`
         : `<p class="muted">Every goal inside its bound, every instrument answering. This is the
            reading to distrust first: check that a metric can still fail —
            <span class="mono">node scripts/measure.mjs --selftest</span>.</p>`
     }
     <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:6px">
       <span class="chip mono">${esc(f.commit)}</span>
       <span class="chip">${esc(f.branch)}</span>
       <span class="chip">${f.dirty ? "working tree dirty" : "working tree clean"}</span>
     </div>
     <div class="muted" style="margin-top:8px;font-size:12px">${esc(f.subject)} — ${esc(f.author)}</div>`,
    `<span class="mono">isocan --json persona ls</span>, each goal's own command, and <span class="mono">git</span> at this commit`,
  );
}

/** Commits per day, newest day first — the shape of the fortnight. */
function byDay(commits) {
  const days = new Map();
  for (const c of commits) {
    if (!days.has(c.date)) days.set(c.date, []);
    days.get(c.date).push(c);
  }
  return [...days.entries()];
}

/**
 * A bar per day, drawn with a div rather than written as fourteen numbers: the
 * shape of a fortnight is the thing a person actually reads off this panel.
 */
function dayBars(days) {
  const peak = Math.max(1, ...days.map(([, l]) => l.length));
  return days
    .map(
      ([day, list]) => `<tr>
        <td class="num muted" style="width:88px">${esc(day)}</td>
        <td style="width:100%">
          <span style="display:inline-block;height:9px;border-radius:3px;background:var(--accent);
            width:${Math.max(2, Math.round((list.length / peak) * 100))}%"></span>
        </td>
        <td class="num" style="width:44px;text-align:right">${list.length}</td>
      </tr>`,
    )
    .join("");
}

/**
 * **Recently** — the fortnight's shape, then the last three days in detail.
 *
 * This repository lands hundreds of commits a fortnight, so the first version
 * of this panel was 470 rows and answered nothing. A cap is fine; a SILENT cap
 * is not, which is why every bounded count here says what it left out.
 */
function recentlyPanel(commits, f) {
  const days = byDay(commits);
  const DETAIL_DAYS = 3;
  const PER_DAY = 12;
  const authors = [...new Set(commits.map((c) => c.author))];
  const detail = days
    .slice(0, DETAIL_DAYS)
    .map(([day, list]) => {
      const shown = list.slice(0, PER_DAY);
      const rest = list.length - shown.length;
      const rows = shown
        .map(
          (c) =>
            `<tr><td class="num muted" style="width:64px">${esc(c.short)}</td>` +
            `<td>${esc(c.subject)}` +
            (c.stat ? `<div class="muted" style="font-size:11.5px;margin-top:2px">${esc(c.stat)}</div>` : "") +
            `</td></tr>`,
        )
        .join("");
      const more = rest > 0
        ? `<p class="muted" style="font-size:11.5px;margin:6px 0 0">…and ${rest} more that day, not shown.</p>`
        : "";
      return `<h2 style="margin-top:16px">${esc(day)} <span style="text-transform:none;letter-spacing:0;font-weight:400">· ${list.length} commit${list.length === 1 ? "" : "s"}</span></h2>
        <table><tbody>${rows}</tbody></table>${more}`;
    })
    .join("\n");

  const shape = days.length ? `<h2>Fourteen days</h2><table><tbody>${dayBars(days)}</tbody></table>` : "";
  const tail =
    days.length > DETAIL_DAYS
      ? `<p class="muted" style="font-size:12px;margin-top:14px">Detail stops at ${DETAIL_DAYS} days; the
         ${days.length - DETAIL_DAYS} earlier days are counted above and not listed.
         <span class="mono">git log --since='14 days ago'</span> is the whole of it.</p>`
      : "";

  return page(
    "Recently",
    `<h1>Recently</h1>
     <p class="muted" style="margin:8px 0 16px;font-size:13px">
       ${commits.length} commit${commits.length === 1 ? "" : "s"} in the last 14 days from
       ${authors.length} author${authors.length === 1 ? "" : "s"}. Subject lines only — in this repo the
       argument lives in the commit body, and a summary that flattens it loses the reason.</p>
     ${shape}
     ${detail || `<p class="muted">Nothing landed in the last 14 days.</p>`}
     ${tail}`,
    `<span class="mono">git log --since='14 days ago'</span> at <span class="mono">${esc(f.commit)}</span>`,
  );
}

/**
 * **The morning brief** — what got done, what is on deck, what wants a person.
 *
 * Every line of it is derived: git for the week, `docs/ROADMAP.md` (itself
 * derived from each doc's front matter) for what is open, and the personas'
 * own commands for what is not holding. Nothing here is decided on the canvas,
 * so nothing here can go stale against the repo.
 */
function briefPanel(commits, board, rm, f, now) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Los_Angeles" }).format(now);
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
  const week = commits.filter((c) => (now - new Date(`${c.date}T12:00:00Z`)) / 86400000 <= 7);
  const authors = [...new Set(week.map((c) => c.author))];
  const days = byDay(week);
  const SHOWN = 8;

  const headlines = week
    .slice(0, SHOWN)
    .map((c) => `<li>${esc(c.subject)} <span class="mono muted">${esc(c.short)}</span></li>`)
    .join("");

  const done = week.length
    ? `<p style="margin:0 0 10px">${week.length} commit${week.length === 1 ? "" : "s"} from
         ${authors.map((a) => esc(a)).join(", ")}, over ${days.length} day${days.length === 1 ? "" : "s"}.</p>
       <table style="margin-bottom:12px"><tbody>${dayBars(days)}</tbody></table>
       <p class="muted" style="font-size:11.5px;margin:0 0 4px">The ${Math.min(SHOWN, week.length)} most recent:</p>
       <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">${headlines}</ul>
       ${
         week.length > SHOWN
           ? `<p class="muted" style="font-size:11.5px;margin-top:6px">The other ${week.length - SHOWN} are
              counted above and not listed — see <b>Recently</b>.</p>`
           : ""
       }`
    : `<p class="muted">Nothing landed this week.</p>`;

  const section = (name) => rm.sections.find((s) => s.title.toLowerCase().startsWith(name));
  const onDeck = [
    ...(section("blocked")?.rows ?? []).map((r) => ({ ...r, why: "blocked" })),
    ...(section("partly")?.rows ?? []).slice(0, 5).map((r) => ({ ...r, why: "partly built" })),
    ...(section("designed")?.rows ?? []).slice(0, 5).map((r) => ({ ...r, why: "designed" })),
  ];
  const deckRows = onDeck
    .map(
      (r) =>
        `<tr><td style="width:96px"><span class="chip">${esc(r.why)}</span></td>` +
        `<td>${esc(r.what)}` +
        (r.note ? `<div class="muted" style="font-size:11.5px;margin-top:2px">${esc(r.note)}</div>` : "") +
        `</td></tr>`,
    )
    .join("");

  const misses = board.flatMap((b) =>
    b.readings
      .filter((r) => !r.broken && !met(r.goal, r.value))
      .map(
        (r) =>
          `<li><b>${esc(b.persona.name)}</b> — ${esc(r.goal.name)} is ${r.value}, past ${r.goal.bound.value}</li>`,
      ),
  );
  const broken = board.flatMap((b) =>
    b.readings
      .filter((r) => r.broken)
      .map(
        (r) =>
          `<li><b>${esc(b.persona.name)}</b> — <span class="mono">${esc(r.goal.measuredBy)}</span> would not run</li>`,
      ),
  );

  const decide =
    misses.length || broken.length
      ? `<h2 style="margin-top:20px">Wants a person</h2>
         <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">${broken.join("")}${misses.join("")}</ul>
         <p class="muted" style="font-size:12px;margin-top:6px">A missed goal is news, not a build break —
         accept it and move the baseline, or reject it and fix the code. Nothing here decides that, and
         nothing here should: the outcome of a finding is the one fact this board must never generate.</p>`
      : "";

  return page(
    `Welcome to ${day}`,
    `<h1>Welcome to ${esc(day)}!</h1>
     <p class="muted" style="margin:8px 0 18px;font-size:13px">${esc(dateStr)} · at
       <span class="mono">${esc(f.commit)}</span>${f.dirty ? " · working tree dirty" : ""}</p>
     <h2>Completed in the last seven days</h2>
     ${done}
     <h2 style="margin-top:20px">On deck</h2>
     ${
       deckRows
         ? `<table><tbody>${deckRows}</tbody></table>
            <p class="muted" style="font-size:12px;margin-top:8px">${esc(rm.counts)} — the top rows of each
            section only. The full list is <span class="mono">docs/ROADMAP.md</span>, itself derived from
            each doc's front matter.</p>`
         : `<p class="muted">No roadmap rows to show.</p>`
     }
     ${decide}`,
    `<span class="mono">git log</span>, <span class="mono">docs/ROADMAP.md</span>, and each goal's own command`,
  );
}

/* ── putting them on the canvas ──────────────────────────────────────────── */

const out = DRY ? mkdtempSync(path.join(tmpdir(), "isocan-board-")) : mkdtempSync(path.join(tmpdir(), "isocan-board-"));
let existing = DRY ? [] : isocanJSON("ls");
const changed = [];

/**
 * One panel onto the canvas: created once, then a new VERSION every time its
 * bytes change — and nothing at all when they have not.
 *
 * **Identity is a property, not the title.** A panel is found by
 * `properties.board === <slug>`, so renaming "Recently" on the canvas to
 * "This week" keeps it the same panel. Title matching is the fallback, used
 * once per panel to adopt one made before this rule existed — and it stamps the
 * property as it goes, so the fallback is needed exactly once.
 *
 * The bytes are compared against the current version's `blobHash`, which is the
 * sha256 of what the canvas is holding. So an unchanged run is genuinely a
 * no-op rather than an identical version stacked on an identical version, and
 * the stack that IS there is the history of the repo's health.
 */
function publish(slug, title, html, place) {
  const file = path.join(out, `${slug}.html`);
  writeFileSync(file, html);
  if (DRY) {
    console.log(`would publish "${title}" → ${file}`);
    return;
  }
  const hash = sha256(Buffer.from(html));
  const byProp = existing.find((i) => i.properties?.board === slug);
  const item = byProp ?? existing.find((i) => i.title === title);

  if (!item) {
    const args = ["add", file, "--title", title, "--prop", `board=${slug}`];
    if (place?.at) args.push("--at", place.at);
    if (place?.size) args.push("--size", place.size);
    for (const [k, v] of Object.entries(place?.props ?? {})) args.push("--prop", `${k}=${v}`);
    isocan(...args);
    changed.push({ title, what: "created" });
    existing = isocanJSON("ls");
    return;
  }
  // Adopting a panel from before identity was a property: stamp it once, and
  // never match this one by title again.
  if (!byProp) isocan("set", item.id, "--prop", `board=${slug}`);

  const current = item.versions.find((v) => v.id === item.currentVersionId);
  if (current?.blobHash === hash) return;
  isocan("edit", item.id, file);
  changed.push({ title, what: `v${item.versions.length + 1}` });
}

/* ── the run ─────────────────────────────────────────────────────────────── */

const f = facts();
const all = personas();
const wantPanel = (name) => !ONLY || ONLY === name;

/**
 * **Taken once, and only if something asks.** Eleven commands is about fifteen
 * seconds, which is the whole cost of a run — so `--only recent`, which needs
 * no number at all, should not pay it. Memoised for that reason, and not
 * because measuring twice would be wrong.
 */
let taken;
const readBoard = () =>
  (taken ??= all.map((p) => {
    const readings = p.goals.map((goal) => ({ goal, ...take(goal) }));
    return { persona: p, readings, verdict: verdictOf(readings, p.goals) };
  }));

/**
 * The arrangement, top to bottom: **the one word and the brief first**, because
 * the two questions somebody opens this canvas with are *is it green* and
 * *what happened*; then the status band, then a persona per card, then the
 * fortnight.
 *
 * **Positions apply on creation only.** Once a person has dragged a panel it
 * stays dragged — a version never moves an item, and a generator that re-tidies
 * every run is a generator that argues with whoever is looking. `--layout` is
 * the deliberate exception: one `items.move`, one undo, and only when asked.
 */
const COL = 520, ROW = 460, GUT = 40, PER_ROW = 4;
const WIDE = COL * PER_ROW + GUT * (PER_ROW - 1); // 2200
const TOP = 520; // the Build word and the brief share the top row's height
const PERSONA_TOP = TOP + 40 + 300 + 40; // …then the status band, then the cards
/**
 * **However many personas there are.** This was `2 * (ROW + GUT)` — the number
 * of rows eight personas make — and a ninth (`journeys`, added while the
 * watcher was running) started a third row that landed exactly on top of
 * `Recently`. A constant standing in for a count is a layout that is correct
 * until somebody adds a thing, which is the only kind of layout bug worth
 * guarding.
 */
const PERSONA_ROWS = Math.max(1, Math.ceil(all.length / PER_ROW));
const PROSE_TOP = PERSONA_TOP + PERSONA_ROWS * (ROW + GUT);

const LAYOUT = {
  build: { at: "0,0", size: `${COL}x${TOP}` },
  "morning-brief": { at: `${COL + GUT},0`, size: `${WIDE - COL - GUT}x${TOP}` },
  "tree-status": { at: `0,${TOP + 40}`, size: `${WIDE}x300` },
  recently: { at: `0,${PROSE_TOP}`, size: `${WIDE}x620` },
  "repo-canvas": { at: `0,${PROSE_TOP + 660}`, size: `${WIDE}x420` },
};
all.forEach((p, i) => {
  LAYOUT[`persona-${p.name}`] = {
    at: `${(i % PER_ROW) * (COL + GUT)},${PERSONA_TOP + Math.floor(i / PER_ROW) * (ROW + GUT)}`,
    size: `${COL}x${ROW}`,
  };
});

const STATUS_TITLE = "Tree status";

if (wantPanel("build")) {
  publish("build", "Build", buildPanel(ci(), readBoard(), f), LAYOUT.build);
}
if (wantPanel("brief")) {
  publish(
    "morning-brief",
    "Morning brief",
    briefPanel(recentCommits(14), readBoard(), roadmap(), f, new Date()),
    LAYOUT["morning-brief"],
  );
}
if (wantPanel("status")) {
  publish("tree-status", STATUS_TITLE, statusPanel(readBoard(), f), LAYOUT["tree-status"]);
}

const statusId = DRY ? undefined : (existing.find((i) => i.properties?.board === "tree-status") ?? {}).id;

if (wantPanel("personas")) {
  for (const b of readBoard()) {
    const slug = `persona-${b.persona.name}`;
    publish(slug, `Persona · ${b.persona.name}`, personaPanel(b.persona, b.readings, b.verdict, latestRun(b.persona)), {
      ...LAYOUT[slug],
      props: statusId ? { parent: statusId } : {},
    });
  }
}
if (wantPanel("recent")) {
  publish("recently", "Recently", recentlyPanel(recentCommits(14), f), LAYOUT.recently);
}
if (wantPanel("repo-canvas")) {
  publish("repo-canvas", "The repo’s canvas", repoCanvasPanel(repoCanvas(), f), LAYOUT["repo-canvas"]);
}

/**
 * `--layout`: put every panel back where the generator would have put it.
 * Explicit because a person's drag outranks a script's grid — this is the
 * gesture that says "no, tidy it", and it is one move op, so one undo.
 */
if (LAY_OUT && !DRY) {
  let moved = 0;
  for (const item of isocanJSON("ls")) {
    const spot = LAYOUT[item.properties?.board];
    if (!spot) continue;
    const [x, y] = spot.at.split(",");
    const [w, h] = spot.size.split("x");
    if (String(item.x) === x && String(item.y) === y && String(item.width) === w && String(item.height) === h) continue;
    isocan("mv", item.id, x, y);
    isocan("set", item.id, "--size", spot.size);
    moved++;
  }
  console.log(moved ? `moved ${moved} panel${moved === 1 ? "" : "s"} back to the grid` : "layout already tidy");
}

/* ── say what happened ───────────────────────────────────────────────────── */

// Only what was actually taken. A run that measured nothing says so, rather
// than reporting "every goal holding" off an empty list — which is the same
// shape of lie as reading a broken instrument as a zero.
const reds = (taken ?? []).filter((b) => b.verdict === "red");
const ambers = (taken ?? []).filter((b) => b.verdict === "amber");
const line = ambers.length
  ? `⚠ ${ambers.map((b) => b.persona.name).join(", ")} — instrument would not run`
  : reds.length
    ? `${reds.map((b) => b.persona.name).join(", ")} past bound`
    : taken
      ? "every goal holding"
      : "no goal measured this run";

if (changed.length === 0) {
  console.log(`board unchanged — ${line}`);
} else {
  for (const c of changed) console.log(`${c.what.padEnd(9)} ${c.title}`);
  console.log(`${changed.length} panel${changed.length === 1 ? "" : "s"} written — ${line}`);
}

if (NOTIFY && !DRY) {
  const what = changed.length
    ? `${changed.length} panel${changed.length === 1 ? "" : "s"} updated`
    : "no panel changed";
  isocan(
    "notify",
    `\`${f.commit}\` ${f.subject} — ${f.author}. Board: ${line}; ${what}. See #Tree status`,
  );
}

/**
 * **Exit non-zero for one reason only: an instrument that would not run.**
 * A missed goal is news and must not break a build — a board that goes red
 * every morning trains everybody to stop looking. A number nobody could take
 * is the one thing a board must never report as fine.
 */
process.exit(ambers.length ? 1 : 0);
