#!/usr/bin/env node
/**
 * **The findings that want a person, on the canvas, where deciding one is a
 * reaction.**
 *
 *   node scripts/docket.mjs --dry-run     # what it would put there
 *   node scripts/docket.mjs               # publish, then read decisions back
 *   node scripts/docket.mjs --read-only   # read decisions, publish nothing
 *
 * #206 phases 2 and 3. The note's argument in one line: *"If the canvas only
 * ever displays, it is a dashboard and will be looked at twice"* (#148) — so
 * the docket is the one place where a fact is DECIDED rather than shown, and
 * the fact is a finding's outcome.
 *
 * ## One item per QUESTION, not per row
 *
 * A missed bound writes a new `unanswered` row every night, and `findingKey`
 * already says those nights are one question — the goal and the bound, not the
 * number, which moves. So the docket carries one item per question. That is
 * also what stops the silting #148 names as the most likely way this goes
 * wrong in week two: forty items by Friday.
 *
 * ## The decision is a reaction
 *
 * ✅ accepts, ❌ rejects. No new op — `item.react` has existed since long
 * before this — so the vocabulary stays at 33, and three things come free:
 * the decision carries WHO made it, two people disagreeing is visible instead
 * of last-writer-wins, and taking a reaction off is an undo.
 *
 * ## The canvas decides; the repo keeps
 *
 * The canvas holds no authority. Reactions are read, the run pages are
 * edited, and a commit carries the decision — so `findUnanswered` goes on
 * reading markdown with no daemon and no network, which is what lets the
 * guard run in CI, in a worktree, and on a plane. And every decision lands in
 * git history with an author, which is the only thing that makes "humans and
 * agents working on it together" auditable.
 *
 * **Idempotent, because it reads STATE rather than ops.** An item's
 * `reactions` are the truth; reconciling twice writes the same bytes, and a
 * missed tail entry costs nothing.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();
const { connect } = await import("@isocan/api");
const { reviewPages, isAnswered, findingKey, askedAgain } = await import("./reviews.mjs");

const repo = fileURLToPath(new URL("..", import.meta.url));
const REVIEWS = path.join(repo, "docs/reviews");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const READ_ONLY = argv.includes("--read-only");

/** ✅ accepts, ❌ rejects. Two marks and no more for a VERDICT: a docket where
 *  six emoji mean six things is a docket nobody can read at a glance. */
export const MARKS = { "✅": "accepted", "❌": "rejected" };

/**
 * **✋ — I am taking this** (#206 phase 4).
 *
 * A third mark, and the only one that is not a verdict, which is why it is
 * separate rather than a third entry above: a verdict CLOSES a question and a
 * claim does not. Somebody can take a question, work for a week, and hand it
 * back, and nothing about the question has changed.
 *
 * **A claim lives on the canvas and nowhere else, and that is the line.** The
 * repository keeps DECISIONS, because they are permanent and belong in a
 * history with an author. Work in flight is transient — it is true this
 * afternoon and false tomorrow — and a canvas is exactly where live state
 * belongs. Committing it would be a git history of people picking things up.
 *
 * Presence and `narrate` already say where somebody is STANDING. This is the
 * half that does not exist: what they are standing there for.
 */
export const CLAIM = "✋";

/**
 * **The open questions**, one per `findingKey` identity, newest value first.
 *
 * Prose findings — anything `findingKey` cannot identify — are deliberately
 * NOT here. They are asked once, in their own words, and a canvas item per
 * sentence somebody wrote is the wall this is trying not to become.
 */
export function openQuestions(pages = reviewPages()) {
  const repeats = new Map(askedAgain(pages, 1).map((r) => [`${r.goal}|${r.bound}`, r.runs]));
  const byId = new Map();
  for (const page of [...pages].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const finding of page.findings) {
      const key = findingKey(finding.what);
      if (key === null) continue;
      const id = `${key.goal}|${key.bound}`;
      if (isAnswered(finding.outcome)) {
        byId.delete(id);
        continue;
      }
      byId.set(id, {
        id,
        goal: key.goal,
        bound: key.bound,
        value: key.value,
        persona: page.persona,
        since: byId.get(id)?.since ?? page.date,
        latest: page.date,
        nights: repeats.get(id) ?? 1,
        what: finding.what,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.nights - a.nights || a.goal.localeCompare(b.goal));
}

/** A stable, short slug for an item property — the identity, not the number. */
export function slugOf(id) {
  return (
    "q-" +
    id
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
  );
}

/** The card a question wears. Deliberately plain: the number, the bound, how
 *  long it has been asked, and the two marks that answer it. */
export function cardHtml(q) {
  const nights = q.nights === 1 ? "asked once" : `asked ${q.nights} nights`;
  return `<!doctype html>
<meta charset="utf-8">
<style>
  body { margin: 0; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; color: #16191b; background: #fff; padding: 18px 20px; }
  .goal { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 10px; }
  .now { font: 500 26px/1 ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  .bound { color: #5d666b; font-size: 12.5px; margin-top: 4px; }
  .who { color: #8b9490; font-size: 11.5px; margin-top: 12px; }
  .ask { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e4e6e0; color: #5d666b; font-size: 12.5px; }
  .taken { margin-top: 10px; padding: 7px 10px; border-radius: 6px; background: #e8ecfb; color: #1f3fd0; font-size: 12.5px; }
  b { color: #16191b; }
</style>
<p class="goal">${escapeHtml(q.goal)}</p>
<div class="now">${escapeHtml(String(q.value))}</div>
<div class="bound">past <b>${escapeHtml(q.bound)}</b> · ${escapeHtml(nights)}, since ${escapeHtml(q.since)}</div>
<div class="who">${escapeHtml(q.persona)} · latest reading ${escapeHtml(q.latest)}</div>
<div class="ask">React <b>✅</b> to accept this, <b>❌</b> to reject it. Your answer is written into the run pages and committed.</div>
<div class="ask">React <b>✋</b> to say you are taking it. That stays here; it is not committed.</div>${
    q.takenBy && q.takenBy.length > 0
      ? `\n<div class="taken">✋ taken by <b>${escapeHtml(q.takenBy.join(", "))}</b></div>`
      : ""
  }`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/**
 * **What the canvas says**, read from item STATE rather than from ops: for
 * each docket item, the verdict its reactions carry and who put it there.
 *
 * A row wearing both marks is `undefined` and stays on the docket. That is not
 * a tie to break — it is two people disagreeing, and writing either answer
 * into the repository would be this tool picking a side.
 */
export function decisionsIn(items, names = {}) {
  const out = [];
  for (const item of items) {
    const slug = item.properties?.docket;
    if (!slug) continue;
    const marks = Object.entries(MARKS).filter(([emoji]) => (item.reactions?.[emoji] ?? []).length > 0);
    if (marks.length !== 1) continue;
    const [emoji, verdict] = marks[0];
    // `names` is core's `ActorNames` — a plain id → name record, which is what
    // a snapshot carries. It was a Map for one draft and the walk caught it.
    const who = (item.reactions[emoji] ?? []).map((id) => names[id] ?? id);
    out.push({ slug, verdict, who, itemId: item.id, title: item.title });
  }
  return out;
}

/**
 * **Who has taken each question**, by docket slug (#206 phase 4).
 *
 * Read the same way a verdict is — from item STATE, so it is idempotent and a
 * missed op costs nothing — and NOT written anywhere. A claim is true this
 * afternoon and false tomorrow; the canvas is where that belongs.
 */
export function claimsIn(items, names = {}) {
  const out = new Map();
  for (const item of items) {
    const slug = item.properties?.docket;
    if (!slug) continue;
    const held = item.reactions?.[CLAIM] ?? [];
    if (held.length > 0) out.set(slug, held.map((id) => names[id] ?? id));
  }
  return out;
}

/**
 * **Write a verdict into every page still asking that question.**
 *
 * Every unanswered row of the same identity, not just the newest: the queue
 * treats them as one question (`findUnanswered`'s `settled` map), so answering
 * the newest and leaving five older rows open would leave the suite red for a
 * question somebody had answered.
 *
 * Returns the files it changed. Writes nothing when the cell already says it,
 * which is what makes running this on every canvas change free.
 */
export function writeOutcomes(decisions, dir = REVIEWS, pages = reviewPages()) {
  const wanted = new Map(decisions.map((d) => [d.slug, d]));
  const changed = new Set();
  for (const page of pages) {
    const decisionsHere = [];
    for (const finding of page.findings) {
      const key = findingKey(finding.what);
      if (key === null || isAnswered(finding.outcome)) continue;
      const d = wanted.get(slugOf(`${key.goal}|${key.bound}`));
      if (d) decisionsHere.push({ finding, d });
    }
    if (decisionsHere.length === 0) continue;
    const file = path.join(dir, page.file);
    let text = readFileSync(file, "utf8");
    for (const { finding, d } of decisionsHere) {
      const cell = `${d.verdict} — decided on the canvas by ${d.who.join(", ")}`;
      const before = text;
      text = text
        .split("\n")
        .map((line) => {
          if (!line.startsWith("|") || !line.includes(finding.what)) return line;
          const parts = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|");
          if (parts.length < 2) return line;
          parts[parts.length - 1] = ` ${cell} `;
          return `|${parts.join("|")}|`;
        })
        .join("\n");
      if (text !== before) changed.add(page.file);
    }
    if (changed.has(page.file)) writeFileSync(file, text);
  }
  return [...changed];
}

/** The canvas the board lives on — the same one `canvas-board.mjs` uses. */
function boardCanvas() {
  const f = path.join(repo, ".isocan", "board.json");
  return (
    process.env.ISOCAN_BOARD_CANVAS ??
    (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).canvas : undefined)
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const questions = openQuestions();
  if (DRY) {
    console.log(`${questions.length} open question${questions.length === 1 ? "" : "s"}:`);
    for (const q of questions) {
      console.log(`  ${slugOf(q.id)}\n    ${q.goal} is ${q.value}, past ${q.bound} — ${q.nights} night(s), ${q.persona}`);
    }
    process.exit(0);
  }
  const canvasId = boardCanvas();
  if (!canvasId) {
    console.error("no board canvas — `echo '{\"canvas\":\"prj_…\"}' > .isocan/board.json`, or ISOCAN_BOARD_CANVAS");
    process.exit(1);
  }
  const client = await connect();
  const board = client.canvas(canvasId);
  const snapshot = await board.snapshot();
  const items = Object.values(snapshot.canvas.items);
  const names = snapshot.names ?? {};

  // Read first: a decision made before this run should not be lost to a
  // republish that happens to rewrite the item it was made on.
  const decisions = decisionsIn(items, names);
  const wrote = writeOutcomes(decisions);
  for (const d of decisions) console.log(`${d.verdict} · ${d.title} · by ${d.who.join(", ")}`);
  if (wrote.length > 0) {
    console.log(`wrote ${wrote.length} page${wrote.length === 1 ? "" : "s"}: ${wrote.join(", ")}`);
    execFileSync("node", [path.join(repo, "scripts/reviews.mjs")], { cwd: repo, stdio: "inherit" });
    /**
     * **The commit is the point** (#206 D3): the canvas decides, the repo
     * keeps. `findUnanswered` goes on reading markdown with no daemon and no
     * network, and every decision lands in git history with an author, which
     * is the only thing that makes "humans and agents working on it together"
     * auditable.
     *
     * Staged BY PATH and never `-A`: this runs on a machine where other
     * sessions have uncommitted work, and a reaction on a canvas must never
     * sweep it up. `docs/reviews/` and nothing else is also what makes this
     * the case Dion blessed unattended — "when it's safe to put something in,
     * such as docs/reviews just go for it".
     */
    if (!argv.includes("--no-commit")) {
      const who = decisions.map((d) => d.who.join(", ")).join("; ");
      const what = decisions.map((d) => `${d.verdict} ${d.title}`).join("; ");
      try {
        execFileSync("git", ["add", "--", "docs/reviews"], { cwd: repo, stdio: "inherit" });
        execFileSync(
          "git",
          ["commit", "-m", `Decided on the canvas: ${what}`, "-m", `By ${who}, through the docket (#206).`],
          { cwd: repo, stdio: "inherit" },
        );
      } catch {
        console.error("nothing committed — the pages are written; commit them yourself");
      }
    }
  }
  if (READ_ONLY) process.exit(0);

  // Then publish what is still open, and retire what is not.
  const open = openQuestions();
  const taken = claimsIn(items, names);
  const want = new Map(open.map((q) => [slugOf(q.id), { ...q, takenBy: taken.get(slugOf(q.id)) ?? [] }]));
  for (const [slug, who] of taken) {
    if (want.has(slug)) console.log(`✋ ${who.join(", ")} · ${want.get(slug).goal}`);
  }
  const COL = 460;
  let i = 0;
  for (const [slug, q] of want) {
    const html = cardHtml(q);
    const existing = items.find((it) => it.properties?.docket === slug);
    if (!existing) {
      await board.add({
        title: q.goal.slice(0, 60),
        content: html,
        mime: "text/html",
        filename: `${slug}.html`,
        at: { x: (i % 3) * (COL + 40), y: 3200 + Math.floor(i / 3) * 300 },
        size: { width: COL, height: 260 },
        properties: { docket: slug },
      });
      console.log(`asked: ${q.goal}`);
    } else {
      await board.edit(existing.id, { content: html, mime: "text/html", filename: `${slug}.html` });
    }
    i += 1;
  }
  for (const item of items) {
    const slug = item.properties?.docket;
    // Answered, so it is no longer a question. The run page keeps the record.
    if (slug && !want.has(slug)) {
      await board.remove(item.id);
      console.log(`answered, taken off the docket: ${item.title}`);
    }
  }
  await client.close?.();
}
