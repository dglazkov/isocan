#!/usr/bin/env node
/**
 * **Proactive agent phase 11: one night, recorded.** Builds a synthetic Acme
 * Bakery canvas on a SCRATCH daemon (a temp `ISOCAN_HOME`, a free port, owned
 * by `scripts/lib/daemon.mjs` and taken down with this script — never
 * isocan.io, never the daemon on 4441), enrols a lead agent through the real
 * `isocan rc`, and walks the night as a person would from a terminal:
 * `goodnight start` → the lead's opener → one steer → `goodnight plan`
 * ("That's the plan") → the night → the lead's `goodnight done` → the morning
 * review. Every proposal the night made is written to `night-results.json`
 * with its source, its take, its cites (resolved to the words they point at),
 * its why and its kind (sure, hunch, failed, edit), beside the brief and the
 * review. `judge.mjs` asks whether a designer would keep each one.
 *
 *   node night.mjs --plan       what it would build and run, the harness this
 *                               machine has, and the price; no daemon, no model
 *   node night.mjs --dry-run    build the canvas on a scratch daemon and enrol
 *                               the lead, then stop before summoning it; no model
 *   node night.mjs --stand-in   the whole flow with `packages/cli/test/fake-acp.mjs`
 *                               as the lead (scripted, as the proactive journeys
 *                               do): proves the plumbing; no model. Writes to a
 *                               temp file unless --out names one, never to
 *                               night-results.json
 *   node night.mjs --fixture <dir>   write the five Acme screens as HTML files
 *                               into <dir> (for the verify walk); nothing else
 *   node night.mjs --yes        the real night: a real harness, real model calls
 *                               (Dion's yes, once). Writes night-results.json
 *
 *   --harness <name>   the harness to enrol the lead on (default: this machine's
 *                      default, from `isocan harness`)
 *   --model <id>       pin the lead's model (as `isocan rc add --model`)
 *   --minutes <n>      how long the night may run before it is called (default 60)
 *   --keep             leave the scratch home and daemon up at the end, so a
 *                      person can open the morning (prints the address)
 *   --out <file>       where the record goes
 *
 * The lead's cost is the harness's: it runs on whatever account that harness
 * is logged in to, and nothing here sees a key.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon } from "../../../../scripts/lib/daemon.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const cli = path.join(repo, "packages/cli/bin/isocan.js");
const fakeAcp = path.join(repo, "packages/cli/test/fake-acp.mjs");
const resultsFile = path.join(here, "night-results.json");

/** Bumped when the fixture, the steer or the record's shape changes; recorded in the results. */
export const NIGHT_VERSION = "night-1";
/** The lead's name on the canvas, as in the journey's scenes. */
const LEAD = "Kit";

// ---------- the fixture: Acme Bakery, synthetic (journey.md: "The fixture throughout")

const page = (title, body, accent = "#b3261e") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
body{margin:0;font:16px/1.4 system-ui,sans-serif;color:#2b2118;background:#fffaf3}
header{padding:20px 24px 8px;font-weight:700;font-size:22px}
main{padding:0 24px 24px}
.btn{display:block;margin-top:16px;padding:14px;border-radius:12px;background:${accent};color:#fff;text-align:center;font-weight:600}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eadfce}
.muted{color:#7a6a58;font-size:14px}
</style></head><body><header>${title}</header><main>${body}</main></body></html>`;

/** Five screens of a pre-order app for a neighbourhood bakery. Checkout puts the total before the pickup slot on purpose. */
export const SCREENS = [
  {
    key: "menu",
    title: "Menu",
    html: page("Menu", `<p class="muted">Bake day: Saturday</p>
<div class="row"><span>Sourdough loaf</span><span>$8</span></div>
<div class="row"><span>Seeded rye</span><span>$7</span></div>
<div class="row"><span>Focaccia, rosemary</span><span>$6</span></div>
<div class="row"><span>Cinnamon buns (4)</span><span>$10</span></div>
<span class="btn">View basket</span>`),
  },
  {
    key: "basket",
    title: "Basket",
    html: page("Basket", `<p style="margin-top:80px;text-align:center" class="muted">Your basket is empty.</p>`),
  },
  {
    key: "checkout",
    title: "Checkout",
    html: page("Checkout", `<div class="row"><span>Sourdough loaf × 1</span><span>$8</span></div>
<div class="row"><span>Cinnamon buns (4)</span><span>$10</span></div>
<div class="row"><b>Total</b><b>$18</b></div>
<span class="btn">Pay $18</span>
<p class="muted" style="margin-top:24px">Pickup: Saturday, 9:00–9:30 · Change</p>`),
  },
  {
    key: "history",
    title: "Order history",
    html: page("Order history", `<div class="row"><span>11 Oct · Sourdough loaf, Focaccia</span><span>$14</span></div>
<div class="row"><span>4 Oct · Sourdough loaf</span><span>$8</span></div>
<div class="row"><span>27 Sep · Seeded rye, Cinnamon buns (4)</span><span>$17</span></div>
<div class="row"><span>20 Sep · Sourdough loaf</span><span>$8</span></div>`),
  },
  {
    key: "profile",
    title: "Profile",
    html: page("Profile", `<div class="row"><span>Name</span><span>Maya</span></div>
<div class="row"><span>Pickup reminders</span><span>On</span></div>
<div class="row"><span>Favourite loaf</span><span>Sourdough</span></div>
<div class="row"><span>Sign out</span><span></span></div>`),
  },
];

/** A variation of the menu, chosen today, so "settled today" has something in it. */
const MENU_B = page("Menu", `<p class="muted">Bake day: Saturday · order by Friday 6pm</p>
<div class="row"><span>Sourdough loaf</span><span>$8</span></div>
<div class="row"><span>Seeded rye</span><span>$7</span></div>
<div class="row"><span>Focaccia, rosemary</span><span>$6</span></div>
<div class="row"><span>Cinnamon buns (4)</span><span>$10</span></div>
<span class="btn">View basket</span>`);

/** The day's talk, as comments on the screens: what a night can cite. */
export const COMMENTS = [
  { on: "checkout", body: "Ravi says people miss the pickup slot: they only see it after the total, under the pay button." },
  { on: "basket", body: "/ask Should the empty basket suggest a loaf? It feels like a dead end." },
  { on: "menu", body: "Not sure about the red on the buttons. It reads as an error to me." },
];

/** What the person says: the goodnight's first words, the one steer, and "That's the plan". */
export const SAYS = {
  start: "long day. the empty basket still bugs me",
  steer: "rework the checkout screen too, pickup before the total. leave the menu alone, it's settled",
  plan: "that's the plan",
};

// ---------- the scripted lead, for --stand-in: no model, the journeys' fake ACP agent

/** Kit, scripted: opener, restatement, then on "That's the plan" the note and the whole night. Mirrors the proactive-morning journey, plus one proposal citing a comment. */
const STAND_IN_ACT = `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
export default async function act({ prompt, cli, cwd }) {
  const canvasId = /"canvasId":\\s*"([^"]+)"/.exec(prompt)?.[1];
  const run = (...args) => execFileSync(process.execPath, [cli, "--canvas", canvasId, ...args], { encoding: "utf8" });
  const json = (...args) => JSON.parse(execFileSync(process.execPath, [cli, "--json", "--canvas", canvasId, ...args], { encoding: "utf8" }));
  const read = json("goodnight", "read");
  if (!read.youLead || !read.conversation) return;
  const listed = json("comment", "ls");
  const threads = Array.isArray(listed) ? listed : listed.threads;
  const main = threads.find((t) => t.main);
  const at = main.comments.findIndex((c) => c.id === read.conversation.askId);
  const kitSaid = main.comments.slice(at + 1).some((c) => c.author.name === "${LEAD}");
  const page = (title, body) => "<!doctype html><title>" + title + "</title><body style='font:16px system-ui;padding:24px'><h1>" + title + "</h1>" + body + "</body>";
  if (read.conversation.planned) {
    if (main.comments.some((c) => c.goodnight?.step === "brief")) return;
    const note = json("goodnight", "note",
      "--promise", "Basket | a finished take on the empty basket | one take",
      "--promise", "Basket | a sketch of the empty basket | one sketch",
      "--promise", "Order history | group past orders by month | one take",
      "--edit", "Checkout | pickup before the total | one new version");
    for (const line of note.lines) {
      const file = path.join(cwd, "take-" + line.n + ".html");
      if (line.edit) {
        writeFileSync(file, page("Checkout", "<p><b>Pickup: Saturday 9:00–9:30</b> · Change</p><p>Sourdough loaf × 1 — $8</p><p>Cinnamon buns (4) — $10</p><p>Total $18</p>"));
        run("goodnight", "fill", line.on, file);
      } else if (line.n === 1) {
        writeFileSync(file, page("Your basket is empty", "<p>Saturday's sourdough is still baking. Add a loaf?</p>"));
        run("goodnight", "fill", line.frame, file, "--why", "Empty states teach: show the first step, not the void.");
      } else if (line.n === 2) {
        writeFileSync(file, page("Nothing here yet", "<p>A loaf, sketched, and one button.</p>"));
        run("goodnight", "fill", line.frame, file, "--hunch", "--why", "A sketch first: how warm the empty state should be is the open question.");
      } else {
        writeFileSync(file, page("Order history", "<p>October: two orders</p><p>September: two orders</p>"));
        run("goodnight", "fill", line.frame, file, "--failed", "grouping by month hid the dates a regular scans for");
      }
    }
    const redThread = threads.find((t) => !t.main && t.comments.some((c) => /red on the buttons/.test(c.body)));
    const profile = json("ls").find((i) => i.title === "Profile");
    if (redThread && profile) {
      const file = path.join(cwd, "profile.html");
      writeFileSync(file, page("Profile", "<p>Name: Maya</p><p>Pickup reminders: On</p><p style='color:#2b2118'>Sign out</p>"));
      run("propose", profile.id, file, "--cites", "comment:" + redThread.comments[0].id, "--hunch", "--why", "Reserve red for errors: a neutral sign-out keeps the signal clean.");
    }
    run("goodnight", "done", "Two takes on the basket: one I'm sure of, one hunch. Checkout reworked, pickup first. The order-history regroup did not work.",
      "--left", "Not sure about the red | the menu is settled today; one hunch on Profile instead");
    return;
  }
  if (!kitSaid) {
    run("comment", "reply", main.id, "**Settled today:** the menu. **Tonight I could try:** two takes on the empty Basket, one a sketch; Order history grouped by month; and Checkout reworked with the pickup first, if you name it for editing.");
    return;
  }
  run("comment", "reply", main.id, "The plan as it stands: two takes on the Basket, beside it; the Order history regroup; Checkout reworked, pickup first, because you named it. Say that's the plan when it is right.");
}
`;

// ---------- small helpers

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback = null) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : fallback;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The environment every CLI call and the rc get: the scratch home and port, and no harness variables from the shell this runs in. */
function scratchEnv(home, port, extra = {}) {
  const env = { ...process.env, ISOCAN_HOME: home, ...(port ? { ISOCAN_PORT: String(port) } : {}), ...extra };
  for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "ISOCAN_SESSION_ID", "ISOCAN_HARNESS", "ISOCAN_CANVAS", "CODEX_SANDBOX", "CODEX_THREAD_ID"]) delete env[name];
  return env;
}

function cliFor(home, env) {
  const raw = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: home, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  const json = (...args) => {
    const out = raw("--json", ...args);
    return /^[[{]/.test(out.trim()) ? JSON.parse(out) : out;
  };
  return { raw, json };
}

/** A temp home with Maya's identity; `standIn` names the scripted harness in its config. */
function makeHome({ standIn }) {
  const home = mkdtempSync(path.join(tmpdir(), "isocan-night-bench-"));
  mkdirSync(path.join(home, "kit"), { recursive: true });
  writeFileSync(path.join(home, "identity.json"), JSON.stringify({ id: "usr_bench_maya", name: "Maya", createdAt: new Date().toISOString() }));
  if (standIn) {
    writeFileSync(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { "claude-code": [process.execPath, fakeAcp] }, defaultHarness: "claude-code" }));
    writeFileSync(path.join(home, "act.mjs"), STAND_IN_ACT);
  }
  return home;
}

/** What `isocan harness` says about this machine, read under a home (no daemon). */
function harnesses(home) {
  const out = execFileSync(process.execPath, [cli, "--json", "harness"], { encoding: "utf8", env: scratchEnv(home, null), stdio: ["ignore", "pipe", "pipe"] });
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : (parsed.harnesses ?? []);
}

function chooseHarness(home) {
  const list = harnesses(home);
  const named = option("--harness");
  const pick = named ? list.find((h) => h.name === named) : (list.find((h) => h.default && h.runnable) ?? list.find((h) => h.runnable));
  return { list, pick: pick ?? null, named };
}

// ---------- the canvas

/** Build the Acme canvas and enrol the lead. Returns the ids the night is read against. */
function buildCanvas(c, home, { harness, model }) {
  const id = c.json("canvas", "create", "Acme Bakery").canvasId;
  const screens = {};
  SCREENS.forEach((s, i) => {
    const file = path.join(home, `screen-${s.key}.html`);
    writeFileSync(file, s.html);
    screens[s.key] = c.json("--canvas", id, "add", file, "--title", s.title, "--size", "390x700", "--at", `${i * 470},0`).itemId;
  });
  // Settled today: a menu variation, chosen.
  const variation = path.join(home, "screen-menu-b.html");
  writeFileSync(variation, MENU_B);
  const menuB = c.json("--canvas", id, "add", variation, "--title", "Menu — order-by line", "--size", "390x700", "--at", "0,800", "--prop", `parent=${screens.menu}`).itemId;
  c.json("--canvas", id, "choose", menuB);
  for (const k of COMMENTS) c.json("--canvas", id, "comment", "add", k.body, "--item", screens[k.on]);
  c.json("--canvas", id, "rc", "add", LEAD, "--dir", path.join(home, "kit"), ...(harness ? ["--harness", harness] : []), ...(model ? ["--model", model] : []));
  c.json("--canvas", id, "canvas", "edit", "--prop", `proactive=${LEAD}`);
  // Maya's evening visit: her seen mark, older than the night's ready-by.
  c.json("--canvas", id, "seen", "--mark");
  return { id, screens };
}

// ---------- reading the night back

function mainThread(c, id) {
  const listed = c.json("--canvas", id, "comment", "ls");
  const threads = Array.isArray(listed) ? listed : listed.threads;
  return { threads, main: threads.find((t) => t.main) ?? { comments: [] } };
}

/** An item's current bytes as text a judge can read: tags stripped, entities folded, whitespace collapsed. */
function textOf(c, id, itemId, versionId = null) {
  let raw;
  try {
    raw = c.raw("--canvas", id, "get", itemId, ...(versionId ? ["--rev", versionId] : []));
  } catch {
    return null;
  }
  return raw
    .replace(/<head>[\s\S]*?<\/head>/i, " ")
    .replace(/<style>[\s\S]*?<\/style>/gi, " ")
    .replace(/<title>[\s\S]*?<\/title>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A cite resolved to the words it points at, where the bench can: a comment's body, a promise's line. */
function resolveCite(cite, { comments, note }) {
  if (cite.kind === "comment") {
    const hit = comments.get(cite.ref);
    return { ...cite, text: hit ? `${hit.author}: ${hit.body}` : null };
  }
  if (cite.kind === "promise") {
    const n = Number(/#(\d+)$/.exec(cite.ref)?.[1]);
    const line = note?.lines?.find((l) => l.n === n);
    return { ...cite, text: line ? `promised tonight: ${line.text ?? JSON.stringify(line)}` : null };
  }
  return { ...cite, text: null };
}

function parseCites(raw) {
  try {
    const list = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** A failed promise's reason, from the note line its frame cites. */
function failedOf(note, rawCites) {
  const promise = parseCites(rawCites).find((ct) => ct.kind === "promise");
  const n = Number(/#(\d+)$/.exec(promise?.ref ?? "")?.[1]);
  const line = note?.lines?.find((l) => l.n === n);
  return line?.result?.failed ? { failed: line.result.failed } : {};
}

/** Everything the night left, as the record judge.mjs reads. */
function readNight(c, id, screens, before, { leadName }) {
  const { threads, main } = mainThread(c, id);
  const comments = new Map();
  for (const t of threads) for (const k of t.comments) comments.set(k.id, { author: k.author?.name ?? "?", body: k.body });
  let note = null;
  try {
    note = c.json("--canvas", id, "goodnight", "show");
  } catch {
    note = null;
  }
  const review = (() => {
    try {
      return { json: c.json("--canvas", id, "goodnight", "review"), text: c.raw("--canvas", id, "goodnight", "review").trim() };
    } catch (err) {
      return { error: String(err.stderr ?? err.message).trim() };
    }
  })();
  const brief = main.comments.filter((k) => k.goodnight?.step === "brief").at(-1) ?? null;
  const askAt = main.comments.findIndex((k) => /^\/goodnight\b/.test(k.body ?? "") || k.goodnight?.step === "ask");
  const conversation = main.comments.slice(Math.max(0, askAt)).map((k) => ({ author: k.author?.name ?? "?", body: k.body, at: k.createdAt ?? null, ...(k.goodnight ? { goodnight: k.goodnight } : {}) }));
  const items = c.json("--canvas", id, "ls");
  const titleOf = new Map(items.map((i) => [i.id, i.title]));
  const proposals = [];
  for (const it of items) {
    const shown = c.json("--canvas", id, "show", it.id);
    const props = shown.properties ?? {};
    if (!props.proposal) continue;
    if (shown.createdBy?.name && shown.createdBy.name !== leadName) continue;
    const sourceId = props.parent ?? null;
    proposals.push({
      id: it.id,
      title: it.title,
      kind: props.proposal,
      source: sourceId ? { id: sourceId, title: titleOf.get(sourceId) ?? null, text: textOf(c, id, sourceId) } : null,
      take: textOf(c, id, it.id),
      cites: parseCites(props.proposalCites).map((ct) => resolveCite(ct, { comments, note })),
      why: props.proposalWhy ?? "",
      ...failedOf(note, props.proposalCites),
      createdAt: shown.createdAt ?? null,
    });
  }
  // Originals the night edited: a named line's new version. Everything else must be byte for byte.
  const edits = [];
  const untouched = [];
  for (const [key, itemId] of Object.entries(screens)) {
    const s = c.json("--canvas", id, "show", itemId);
    const now = { versions: s.versions.length, current: s.currentVersionId };
    if (now.current === before[key].current) {
      untouched.push(key);
      continue;
    }
    const line = note?.lines?.find((l) => l.edit && l.on === itemId) ?? null;
    edits.push({
      id: itemId,
      title: s.title,
      kind: "edit",
      named: Boolean(line),
      source: { id: itemId, title: s.title, text: textOf(c, id, itemId, before[key].current) },
      take: textOf(c, id, itemId),
      cites: line ? [{ kind: "promise", ref: `${note.itemId}#${line.n}`, text: `named for editing tonight: ${line.text ?? JSON.stringify(line)}` }] : [],
      why: line?.text ?? "",
    });
  }
  return { note, brief: brief ? { body: brief.body, goodnight: brief.goodnight ?? null } : null, review, conversation, proposals, edits, untouched };
}

// ---------- the flow

async function waitFor(test, what, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(1000)) {
    const hit = test();
    if (hit) return hit;
  }
  throw new Error(`timed out after ${Math.round(ms / 1000)}s waiting for ${what}`);
}

/** The lead's comments in the Chat after `index`. */
const leadSaidAfter = (c, id, index) => mainThread(c, id).main.comments.slice(index + 1).filter((k) => k.author?.name === LEAD);

async function night({ mode }) {
  const standIn = mode === "stand-in";
  const real = mode === "real";
  const home = makeHome({ standIn });
  const minutes = Number(option("--minutes", standIn ? "3" : "60"));
  const turnMs = standIn ? 60_000 : 15 * 60_000;
  const { list, pick, named } = chooseHarness(home);
  if (!pick || !pick.runnable) {
    console.error(`No runnable harness${named ? ` called ${named}` : ""} on this machine (isocan harness: ${list.map((h) => `${h.name} ${h.runnable ? "runnable" : "not runnable"}`).join(", ")}). Nothing was called.`);
    rmSync(home, { recursive: true, force: true });
    process.exit(2);
  }
  const model = option("--model");
  const daemon = await startDaemon({ cli, home });
  const env = scratchEnv(home, daemon.port, standIn ? { FAKE_ACP_ACT: path.join(home, "act.mjs"), FAKE_ACP_CLI: cli } : {});
  const c = cliFor(home, env);
  console.log(`scratch daemon on ${daemon.origin}, home ${home}`);
  let rc = null;
  let rcOut = "";
  const started = Date.now();
  const keep = flag("--keep");
  try {
    const { id, screens } = buildCanvas(c, home, { harness: pick.name, model });
    const shot = (key) => {
      const s = c.json("--canvas", id, "show", screens[key]);
      return { versions: s.versions.length, current: s.currentVersionId };
    };
    const before = Object.fromEntries(Object.keys(screens).map((k) => [k, shot(k)]));
    console.log(`canvas ${id}: ${SCREENS.length} screens, a chosen menu variation, ${COMMENTS.length} comments; ${LEAD} enrolled on ${pick.name}${model ? ` (${model})` : ""} and named lead`);
    const read = c.json("--canvas", id, "goodnight", "read", "--for", "Maya");
    if (mode === "dry-run") {
      console.log(`the lead's read, before any summons: ${JSON.stringify({ lead: read.lead?.name ?? read.lead ?? null, answerable: read.answerable ?? null, room: read.room ?? null, settled: (read.settled ?? []).map((s) => s.what), open: (read.open ?? []).map((s) => s.what) })}`);
      console.log(`stopped before summoning ${LEAD}: no rc started, no goodnight said, no model called.`);
      return;
    }

    rc = spawn(process.execPath, [cli, "--canvas", id, "rc"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
    rc.stdout.on("data", (b) => (rcOut = (rcOut + b).slice(-200_000)));
    rc.stderr.on("data", (b) => (rcOut = (rcOut + b).slice(-200_000)));
    await sleep(2000);

    const asked = c.json("--canvas", id, "goodnight", "start", SAYS.start);
    const askIndex = () => mainThread(c, id).main.comments.findIndex((k) => k.id === asked.askId || k.id === asked.commentId);
    console.log(`goodnight said; waiting for ${LEAD}'s opener`);
    await waitFor(() => leadSaidAfter(c, id, askIndex()).length >= 1, `${LEAD}'s opener`, turnMs);
    const steerAt = mainThread(c, id).main.comments.length - 1;
    c.json("--canvas", id, "comment", "reply", asked.threadId, SAYS.steer);
    console.log("steered; waiting for the plan to be restated");
    await waitFor(() => leadSaidAfter(c, id, steerAt).length >= 1, `${LEAD} restating the plan`, turnMs);
    c.json("--canvas", id, "goodnight", "plan", SAYS.plan);
    console.log(`that's the plan; the night has ${minutes} minute(s)`);
    let finished = true;
    try {
      await waitFor(() => mainThread(c, id).main.comments.some((k) => k.goodnight?.step === "brief"), "the night's brief", minutes * 60_000);
    } catch (err) {
      finished = false;
      console.error(`${err.message}: recording what the night left anyway`);
    }
    const record = readNight(c, id, screens, before, { leadName: LEAD });
    let commit = null;
    try {
      commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    } catch {
      commit = null;
    }
    const out = {
      ranAt: new Date().toISOString(),
      commit,
      nightVersion: NIGHT_VERSION,
      mode,
      standIn,
      lead: { name: LEAD, harness: pick.name, model: model ?? (standIn ? "fake-acp (scripted, no model)" : "the harness's default") },
      finished,
      wallSeconds: Math.round((Date.now() - started) / 1000),
      says: SAYS,
      canvas: { title: "Acme Bakery", screens: SCREENS.map((s) => ({ key: s.key, id: screens[s.key], title: s.title })) },
      ...record,
      rcTail: rcOut.slice(-4000),
    };
    const file = option("--out") ? path.resolve(option("--out")) : real ? resultsFile : path.join(tmpdir(), `isocan-night-${mode}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
    const kinds = {};
    for (const p of [...record.proposals, ...record.edits]) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
    console.log(`\nthe night ${finished ? "finished" : "did NOT finish"} in ${out.wallSeconds}s: ${record.proposals.length} proposal(s), ${record.edits.length} edited original(s) ${JSON.stringify(kinds)}; untouched: ${record.untouched.join(", ")}`);
    console.log(`brief: ${record.brief?.body ?? "(none)"}`);
    console.log(`review due: ${record.review.json?.due ?? "?"}`);
    console.log(`written to ${file}`);
    if (keep) console.log(`\n--keep: the daemon stays at ${daemon.origin} (home ${home}); open the canvas with ISOCAN_HOME=${home} ISOCAN_PORT=${daemon.port} node ${path.relative(process.cwd(), cli)} --canvas ${id} open`);
  } catch (err) {
    console.error(`${err.message}\n--- rc ---\n${rcOut.slice(-3000)}`);
    process.exitCode = 1;
  } finally {
    if (rc) {
      rc.kill("SIGINT");
      await new Promise((r) => {
        rc.once("exit", r);
        setTimeout(r, 3000);
      });
      if (rc.exitCode === null) rc.kill("SIGKILL");
    }
    if (keep && process.exitCode !== 1) {
      console.log("Ctrl-C ends the daemon and removes the scratch home.");
      await new Promise(() => {});
    }
    await daemon.stop();
    rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---------- the plan: free, no daemon, no model

function describePlan() {
  const home = makeHome({ standIn: false });
  try {
    const { list, pick, named } = chooseHarness(home);
    console.log(`fixture: Acme Bakery, ${SCREENS.length} screens (${SCREENS.map((s) => s.title).join(", ")}), a chosen menu variation, ${COMMENTS.length} comments`);
    console.log(`flow: scratch daemon (temp ISOCAN_HOME, free port) → ${LEAD} enrolled through isocan rc and named lead → goodnight start "${SAYS.start}" → opener → "${SAYS.steer}" → goodnight plan → the night → goodnight done → goodnight review`);
    console.log(`harnesses here: ${list.map((h) => `${h.name}${h.runnable ? "" : " (not runnable)"}${h.default ? " [default]" : ""}`).join(", ")}`);
    if (!pick) console.log(`the lead would run on: nothing${named ? ` — no harness called ${named}` : ""}; the run would refuse`);
    else console.log(`the lead would run on: ${pick.name}${option("--model") ? `, model ${option("--model")}` : ", its default model"}${pick.runnable ? "" : " — NOT runnable here, the run would refuse"}`);
    console.log(`model turns, real run: about 3 to 5 — the opener, the restatement, the night (one long turn that writes the note, fills every promise and posts the brief), and any delete or reply the rc wakes it for; the night may last ${option("--minutes", "60")} minute(s)`);
    console.log("price: the harness's own, on whatever account it is logged in to; nothing here sees a key. See README.md for the estimate.");
    console.log("then: node judge.mjs --plan (one cheapest-tier call per proposal with a take)");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

if (flag("--fixture")) {
  const dir = path.resolve(option("--fixture") ?? ".");
  mkdirSync(dir, { recursive: true });
  for (const s of SCREENS) writeFileSync(path.join(dir, `${s.key}.html`), s.html);
  console.log(`wrote ${SCREENS.map((s) => `${s.key}.html`).join(", ")} to ${dir}`);
} else if (flag("--plan")) describePlan();
else if (flag("--dry-run")) await night({ mode: "dry-run" });
else if (flag("--stand-in")) await night({ mode: "stand-in" });
else if (flag("--yes")) await night({ mode: "real" });
else {
  describePlan();
  console.error("\nThe real night spends model calls on the lead's harness and waits on Dion's yes: run it with --yes. --dry-run and --stand-in call no model. Nothing was called.");
  process.exit(2);
}
