#!/usr/bin/env node
/**
 * **Loop findings: pull, triage, decide, push back.**
 *
 *   node scripts/loop.mjs pull                    # fetch Loop's insights into docs/loop/
 *   node scripts/loop.mjs list [--json] [-d proposed]
 *   node scripts/loop.mjs propose <slug> --rank next --project wireframes [--lesson 20] --note "…" [--read "…"]
 *   node scripts/loop.mjs decide <slug> <accepted|declined|stale|done> [--rank …] [--project …] [--note "…"] [--no-push]
 *   node scripts/loop.mjs push [--dry-run]        # dismiss what we declined; send decisions and measures as Loop contexts
 *   node scripts/loop.mjs mine [priority...]      # ask Loop to re-mine the code now (all priorities by default)
 *   node scripts/loop.mjs render [--check]        # write docs/LOOP.md (and fail if stale, for CI)
 *
 * The logic lives in `packages/core/src/loop.ts`; this file is the I/O — the
 * `stitch` CLI on one side and `docs/loop/` on the other. The workspace comes
 * from `.stitch.json`, or LOOP_WORKSPACE.
 *
 * Ported from Ledger's `scripts/loop.ts`, where it has run since September. The
 * two differences are on purpose: a finding belongs to a PROJECT here
 * (`docs/projects/<name>/`) because that is isocan's unit of work, and the
 * telemetry context is the repo's own measures (`scripts/measure.mjs`) rather
 * than a device's web vitals — an oplog digest would carry what people did on
 * their canvases to a third party, and that is a decision, not a default.
 *
 * `propose` is for whoever reads the claim against the code (usually an agent).
 * `decide` is a person's. Only a decision reaches Loop: `declined` and `stale`
 * dismiss every id of the finding, and all decisions go up together as one
 * context, so Loop's next pass is mined knowing what was turned down and why. A
 * dismissal alone carries no reason — Loop's API has no field for one — which is
 * why the context exists.
 */
import { spawn, execFileSync } from "node:child_process";
import { closeSync, openSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = path.join(ROOT, "docs", "loop");
const OUT = path.join(ROOT, "docs", "LOOP.md");
const CONTEXT_SOURCE = "isocan:docs/loop";
const MEASURES_SOURCE = "isocan:measures";

// One reader for front matter, and one place the words live: core. Registered
// once, the way `roadmap.mjs` does it, so this is not a second parser.
register();
registerLoader("../packages/cli/bin/workspace-loader.mjs", import.meta.url);
const core = await import("@isocan/core");
const {
  LOOP_DECISIONS,
  LOOP_RANKS,
  findingProblems,
  normalizeInsight,
  parseFinding,
  pendingDismissals,
  reconcile,
  renderLoopDoc,
  serializeFinding,
  loopContextPayload,
} = core;

const today = () => new Date().toISOString().slice(0, 10);

// ── stitch ───────────────────────────────────────────────────────────────

function workspace() {
  let cfg = {};
  try {
    cfg = JSON.parse(readFileSync(path.join(ROOT, ".stitch.json"), "utf8"));
  } catch {}
  const ws = process.env.LOOP_WORKSPACE ?? cfg.workspace;
  if (!ws) throw new Error("No Loop workspace: commit .stitch.json with {\"workspace\": \"<id>\"}, or set LOOP_WORKSPACE.");
  return ws;
}

/**
 * Run stitch and return `data` from its JSON envelope, or throw its error.
 *
 * Its stdout goes to a file, not a pipe: stitch exits before a piped stdout
 * drains, so anything past the first 64KB — most of a list of insights — is cut
 * off mid-JSON. A file descriptor is written synchronously.
 */
async function stitch(args, { format = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-loop-"));
  const file = path.join(dir, "out.json");
  const fd = openSync(file, "w");
  const code = await new Promise((resolve, reject) => {
    const child = spawn("stitch", [...args, ...(format ? ["--format", "json"] : []), "-q"], {
      cwd: ROOT,
      env: { ...process.env, LOOP_INCLUDE_DISMISSED: "1" },
      stdio: ["ignore", fd, fd],
    });
    child.on("error", reject);
    child.on("close", resolve);
  }).finally(() => closeSync(fd));
  const stdout = readFileSync(file, "utf8");
  rmSync(dir, { recursive: true, force: true });
  let out;
  try {
    out = JSON.parse(stdout);
  } catch {
    throw new Error(`stitch ${args.join(" ")} (exit ${code}): unreadable output\n${stdout.slice(0, 500)}`);
  }
  if (out.success === false || out.error) {
    const err = out.error ?? {};
    throw new Error(`stitch ${args.slice(0, 2).join(" ")}: ${err.message ?? JSON.stringify(err)}`);
  }
  return out.data ?? out;
}

async function fetchInsights() {
  const ws = workspace();
  const goals = (await stitch(["find", "priorities", "-w", ws])).items ?? [];
  const titles = new Map(goals.map((g) => [String(g.id), String(g.description ?? g.title ?? g.id)]));
  const data = await stitch(["find", "insights", "-w", ws, "--limit", "1000"]);
  return (data.items ?? []).map((raw) => normalizeInsight(raw, titles));
}

// ── disk ─────────────────────────────────────────────────────────────────

function projects() {
  return readdirSync(path.join(ROOT, "docs", "projects"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function loadFindings() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .sort()
    .map((n) => parseFinding(readFileSync(path.join(DIR, n), "utf8"), n.replace(/\.md$/, "")));
}

function save(f) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, `${f.slug}.md`), serializeFinding(f), "utf8");
}

function find(ref) {
  const all = loadFindings();
  const hits = all.filter((f) => f.slug === ref || f.loop.some((id) => id.startsWith(ref)));
  if (hits.length !== 1) {
    throw new Error(hits.length ? `"${ref}" matches ${hits.map((h) => h.slug).join(", ")}` : `no finding "${ref}" in docs/loop/`);
  }
  return hits[0];
}

/** Every finding's own problems, against the projects that exist. */
function allProblems(findings) {
  const names = projects();
  return findings.flatMap((f) => findingProblems(f, names).map((p) => `docs/loop/${f.slug}.md: ${p}`));
}

function render(check) {
  const findings = loadFindings();
  const page = renderLoopDoc(findings) + "\n";
  if (check) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current.trim() !== page.trim()) {
      console.error("docs/LOOP.md is out of date — run: node scripts/loop.mjs render");
      process.exit(1);
    }
    const broken = allProblems(findings);
    for (const line of broken) console.error(line);
    if (broken.length) process.exit(1);
    console.log("docs/LOOP.md is current");
    return;
  }
  writeFileSync(OUT, page, "utf8");
  // The roadmap counts findings against their projects, so it moves with them.
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "roadmap.mjs")], { cwd: ROOT, stdio: "ignore" });
}

// ── fields from flags ────────────────────────────────────────────────────

function applyFields(f, v) {
  if (typeof v.rank === "string") {
    if (!LOOP_RANKS.includes(v.rank)) throw new Error(`--rank must be one of ${LOOP_RANKS.join(", ")}`);
    f.rank = v.rank;
  }
  if (typeof v.project === "string") {
    f.project = v.project === "none" ? null : v.project;
  }
  if (typeof v.lesson === "string") f.lesson = v.lesson === "none" ? null : Number(v.lesson);
  if (typeof v.note === "string") f.note = v.note.trim();
  if (typeof v.read === "string") {
    const [head] = f.body.split(/\n## Our read\n/);
    f.body = `${head.trimEnd()}\n\n## Our read\n\n${v.read.trim()}`;
  }
}

// ── push ─────────────────────────────────────────────────────────────────

async function push(dryRun) {
  const ws = workspace();
  const findings = loadFindings();
  const insights = await fetchInsights();

  const dismiss = pendingDismissals(findings, insights);
  if (dismiss.length) {
    console.log(`${dryRun ? "would dismiss" : "dismissing"} ${dismiss.length} Loop insight(s):`);
    for (const d of dismiss) console.log(`  ${d.id.slice(0, 8)}  ${d.slug}`);
    if (!dryRun) {
      // As a JSON payload, not positional ids: `stitch dismiss` (v0.10) reads
      // the value of `--format json` as one more id to dismiss.
      const payload = { resource: "insights", ids: dismiss.map((d) => d.id), workspace: ws, concurrency: 5 };
      const res = await stitch(["dismiss", "--json", JSON.stringify(payload)], { format: false });
      for (const f of res.failed ?? []) console.error(`  Loop refused ${JSON.stringify(f)}`);
    }
  }

  // Nothing decided yet is nothing to say: a context with no decisions would
  // only teach Loop that we had been asked.
  const payload = loopContextPayload(findings);
  if (payload.decisions.length) {
    await upsertContext(ws, dryRun, {
      source: CONTEXT_SOURCE,
      data: JSON.stringify(payload),
      description: "isocan's triage decisions on Loop insights: what was declined or found stale and why, and how accepted work is ranked. Generated from docs/loop/ in the repo.",
      annotations: { isocan: "triage" },
    });
  } else {
    console.log("No decisions yet — nothing to send as the triage context.");
  }

  await upsertContext(ws, dryRun, {
    source: MEASURES_SOURCE,
    data: JSON.stringify(measures()),
    description: "isocan's own measures, each a number the repo can reproduce with node scripts/measure.mjs: the operation vocabulary, the web-only operations, the core's runtime dependencies, colour literals, unused and undocumented exports, and the lines in the files every feature must edit.",
    annotations: { isocan: "measures" },
  });
}

/**
 * The measures that are cheap, deterministic and about the code — read through
 * `measure.mjs`, the one place those numbers are defined. An instrument that
 * would not run is reported as such, never as a zero.
 */
const MEASURES = [
  ["op-types", "operations in the vocabulary; every one is a fact both surfaces must speak"],
  ["web-only-ops", "operations a person can send and an agent cannot; the isomorphism, as a number"],
  ["core-runtime-deps", "runtime dependencies of @isocan/core; the reducer must stay portable"],
  ["colour-literals", "colours written as literals where a token exists"],
  ["unused-exports", "exports nothing outside their own file uses"],
  ["undocumented-exports", "exports with no comment above them"],
  ["registry-lines", "lines in the files every feature must edit"],
  ["copy-tells", "user-facing strings that trip a greppable copy rule"],
];

function measures() {
  const out = MEASURES.map(([name, meaning]) => {
    try {
      const value = Number(execFileSync(process.execPath, [path.join(ROOT, "scripts", "measure.mjs"), name], { cwd: ROOT, encoding: "utf8", timeout: 240_000 }).trim());
      return Number.isFinite(value) ? { measure: name, meaning, value } : { measure: name, meaning, error: "instrument printed no number" };
    } catch (e) {
      return { measure: name, meaning, error: "instrument would not run" };
    }
  });
  return {
    kind: "isocan-measures",
    guidance:
      "Deterministic counts taken from the repository on one day, each reproducible with `node scripts/measure.mjs <measure>`. " +
      "A measure with an `error` did not run and says nothing. Ratchet-style counts (unused, undocumented, colour literals) " +
      "matter as a direction over days, not as one reading.",
    day: today(),
    measures: out,
  };
}

/**
 * Put one derived context in Loop. Replace rather than patch: it is derived, so
 * the whole of it is always the right value, and a listing leaves out `data`, so
 * the one context is fetched to see whether anything changed.
 */
async function upsertContext(ws, dryRun, c) {
  const contexts = (await stitch(["find", "contexts", "-w", ws])).items ?? [];
  const listed = contexts.find((x) => x.dataSource === c.source);
  const contextId = listed ? (listed.id ?? String(listed.name).split("/").pop()) : null;
  const mine = contextId ? await stitch(["get", "context", contextId, "-w", ws]) : null;
  if (mine && mine.data === c.data) {
    console.log(`Loop context "${c.source}" is already current.`);
    return;
  }
  if (dryRun) {
    console.log(`would ${mine ? "update" : "create"} the Loop context "${c.source}" (${c.data.length} chars)`);
    return;
  }
  if (contextId) await stitch(["delete", "context", contextId, "-w", ws]);
  await stitch(["create", "context", "-w", ws, "--json", JSON.stringify({ body: { data: c.data, dataSource: c.source, description: c.description, annotations: c.annotations } })]);
  console.log(`${mine ? "updated" : "created"} the Loop context "${c.source}".`);
}

// ── commands ─────────────────────────────────────────────────────────────

const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rank: { type: "string" },
    project: { type: "string" },
    lesson: { type: "string" },
    note: { type: "string" },
    read: { type: "string" },
    decision: { type: "string", short: "d" },
    json: { type: "boolean" },
    check: { type: "boolean" },
    "dry-run": { type: "boolean" },
    "no-push": { type: "boolean" },
    "no-render": { type: "boolean" },
  },
});
const [cmd = "list", ...rest] = positionals;

try {
  switch (cmd) {
    case "pull": {
      const insights = await fetchInsights();
      const r = reconcile(loadFindings(), insights);
      for (const f of r.findings) save(f);
      render(false);
      const say = (label, xs) => xs.length && console.log(`${label} (${xs.length}): ${xs.join(", ")}`);
      console.log(`${r.findings.length} findings in docs/loop/.`);
      say("new", r.added);
      say("re-filed by Loop under a new id", r.refiled);
      say("Loop now reports resolved — worth checking and marking done", r.resolvedInLoop);
      say("dismissed in Loop with no decision here", r.dismissedInLoop);
      const owed = pendingDismissals(r.findings, insights);
      if (owed.length) console.log(`${owed.length} declined id(s) still active in Loop — run: node scripts/loop.mjs push`);
      break;
    }
    case "list": {
      const all = loadFindings();
      const xs = v.decision ? all.filter((f) => f.decision === v.decision) : all;
      if (v.json) {
        console.log(JSON.stringify(xs.map(({ body, ...f }) => f), null, 2));
      } else {
        for (const f of xs) console.log(`${f.decision.padEnd(10)} ${(f.rank ?? "-").padEnd(5)} ${(f.loop_rank ?? "").padEnd(6)} ${f.slug}`);
      }
      break;
    }
    case "propose": {
      const f = find(rest[0] ?? "");
      if (f.decision !== "untriaged" && f.decision !== "proposed") {
        throw new Error(`${f.slug} is already ${f.decision} — that was a decision, and a proposal does not override it`);
      }
      applyFields(f, v);
      f.decision = "proposed";
      f.since = today();
      const problems = findingProblems(f, projects());
      if (problems.length) throw new Error(`${f.slug}: ${problems.join("; ")}`);
      save(f);
      if (!v["no-render"]) render(false);
      console.log(`proposed ${f.slug}: ${f.rank}${f.project === null ? "" : `, ${f.project}`}`);
      break;
    }
    case "decide": {
      const [ref, decision] = rest;
      if (!LOOP_DECISIONS.includes(decision)) throw new Error(`decision is one of ${LOOP_DECISIONS.join(", ")}`);
      const f = find(ref ?? "");
      applyFields(f, v);
      f.decision = decision;
      f.since = today();
      const problems = findingProblems(f, projects());
      if (problems.length) throw new Error(`${f.slug}: ${problems.join("; ")}`);
      save(f);
      render(false);
      console.log(`${f.slug} is ${f.decision}.`);
      if (!v["no-push"]) await push(false);
      break;
    }
    case "push":
      await push(Boolean(v["dry-run"]));
      break;
    case "mine": {
      // Ask Loop to look at the code again — after a fix lands, so it can mark
      // what is resolved. One request per priority: the API refuses several
      // goals in one call (v0.10), and `generate` ignores .stitch.json, so the
      // workspace is passed explicitly. It runs in the background on Loop's
      // side; `pull` in a while to see what changed.
      const ws = workspace();
      const ids = rest.length ? rest : ((await stitch(["find", "priorities", "-w", ws])).items ?? []).map((p) => p.id);
      for (const id of ids) {
        const res = await stitch(["generate", "insights", "-w", ws, "--priority", id]);
        console.log(`${id}: ${res.state ?? "requested"}`);
      }
      console.log("Loop is re-mining. Run `node scripts/loop.mjs pull` in 10–20 minutes to see what it found and resolved.");
      break;
    }
    case "render":
      render(Boolean(v.check));
      if (!v.check) console.log("wrote docs/LOOP.md");
      break;
    default:
      throw new Error(`unknown command "${cmd}" — pull, list, propose, decide, push, mine, render`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
