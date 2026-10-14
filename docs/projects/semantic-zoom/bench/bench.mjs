#!/usr/bin/env node
/**
 * **Semantic Zoom phase 0: the bench.** Runs the three prompts (`prompts.mjs`)
 * over a synthetic "Acme" canvas (`fixture/`) on a cheap and a mid model, and
 * a vision variant over the fixture's screens, and writes every summary with
 * its words, latency, tokens and cost to `results.json`.
 *
 *   node bench.mjs render   re-render fixture/screens/*.png (playwright-core, installed Chrome)
 *   node bench.mjs plan     build the fixture, print every call it would make; no key, no model
 *   node bench.mjs run      plan, then make the calls (real money; Dion's yes, once)
 *   node bench.mjs table    print results.json as the README's table
 *
 * Nothing here touches a daemon or a canvas. The key is resolved exactly as
 * the home's text model resolves it (`resolveTextKey`, `@isocan/core/keystore`:
 * `ISOCAN_TEXT_API_KEY`, else `keys.json` under `ISOCAN_KEYS_HOME` /
 * `ISOCAN_HOME` / `~/.isocan`) and is never printed, logged or written. The
 * request is the one `claudeTextGenerator` (`@isocan/core/jev`) sends, made
 * here by hand only so the bench can read `usage` and attach images.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  SEMANTIC_ZOOM_PROMPT_VERSION,
  SUMMARY_SCHEMA,
  SUMMARY_TARGET_WORDS,
  checkSummary,
  semanticZoomPrompt,
  wordCount,
} from "./prompts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixture");
const resultsFile = path.join(here, "results.json");

/** The plan may not exceed this many calls (Dion's yes was for one run of about this size). */
const CALL_CAP = 150;
/** design.md §10: only notes longer than this are summarised in the product. The bench runs them all, to test the line. */
const LONG_NOTE_WORDS = 40;

/** Tiers per provider: cheap is the product default (§7), mid is the comparison. $ per million tokens, input/output. */
const TIERS = {
  anthropic: {
    cheap: { model: "claude-haiku-5-5", in: 0.1, out: 0.5 },
    mid: { model: "claude-sonnet-5-5", in: 2.0, out: 10.0 },
  },
};

// ---------- the product's request, as claudeTextGenerator sends it (packages/core/src/jev.ts)

const CLAUDE_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";
const CLAUDE_TEXT_EFFORT = "low";
/** /api/text's generator sends this system prompt with every request today — written for /wire copy, not summaries. */
const PRODUCT_SYSTEM =
  "You write the words on an app's screens: labels, headings, buttons, sample content. Answer with the JSON the schema asks for and nothing else.";

// ---------- the fixture, built in memory from fixture/canvas.json

function screenText(file) {
  const html = readFileSync(path.join(fixtureDir, file), "utf8");
  return html
    .replace(/<head>[\s\S]*?<\/head>/i, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFixture() {
  const raw = JSON.parse(readFileSync(path.join(fixtureDir, "canvas.json"), "utf8"));
  const items = new Map();
  for (const n of raw.notes) items.set(n.id, { kind: "note", ...n, words: wordCount(n.body) });
  for (const s of raw.screens) items.set(s.id, { kind: "screen", ...s, text: screenText(s.file), png: s.file.replace(/\.html$/, ".png") });
  // Cards are 360 × 100, placed by their top-left corner; an area holds what its centre is in (core area.ts inArea).
  for (const c of raw.cards) items.set(c.id, { kind: "card", ...c, w: 360, h: 100 });
  const inArea = (a, it) => {
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    return cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h;
  };
  const sources = [];
  for (const n of raw.notes) sources.push({ id: n.id, kind: "text", title: n.title, body: n.body, words: items.get(n.id).words });
  for (const g of raw.groups) {
    const members = g.members.map((id) => items.get(id));
    sources.push({ id: g.id, kind: "group", title: g.title, members, words: members.reduce((w, m) => w + wordCount(m.body ?? m.text ?? m.title), 0) });
  }
  for (const a of raw.areas) {
    const members = raw.cards
      .map((c) => items.get(c.id))
      .filter((c) => inArea(a, c))
      .sort((p, q) => p.y - q.y || p.x - q.x || p.id.localeCompare(q.id));
    sources.push({ id: a.id, kind: "area", title: a.title, members, words: members.reduce((w, m) => w + wordCount(`${m.title} ${m.body ?? ""}`), 0) });
  }
  const screens = raw.screens.map((s) => ({ id: s.id, kind: "screen", title: s.title, text: items.get(s.id).text, png: items.get(s.id).png, words: wordCount(items.get(s.id).text) }));
  return { title: raw.title, sources, screens };
}

/** Every call the run makes, in order. Vision runs on the cheap tier; a vision failure adds one mid call for it (counted as worst case). */
function plan(fixture, tiers) {
  const calls = [];
  for (const tier of ["cheap", "mid"]) {
    for (const s of fixture.sources) calls.push({ source: s, tier, vision: false });
  }
  for (const s of fixture.screens) calls.push({ source: s, tier: "cheap", vision: false });
  const visual = [...fixture.sources.filter((s) => s.kind === "group"), ...fixture.screens];
  for (const s of visual) calls.push({ source: s, tier: "cheap", vision: true });
  // Worst case: every vision call fails and is re-asked on mid; one shape retry per model (see ask()).
  const worst = calls.length + visual.length + Object.keys(tiers).length;
  return { calls, worst };
}

// ---------- the key, resolved the product's way

async function resolveKey() {
  const { tsImport } = await import("tsx/esm/api");
  const { resolveTextKey } = await tsImport("@isocan/core/keystore", import.meta.url);
  return resolveTextKey();
}

// ---------- one call

function imagesFor(source) {
  const pngs = source.kind === "screen" ? [source.png] : source.members.filter((m) => m.kind === "screen").map((m) => m.png);
  return pngs.slice(0, 8).map((p) => ({
    type: "image",
    source: { type: "base64", media_type: "image/png", data: readFileSync(path.join(fixtureDir, p)).toString("base64") },
  }));
}

const shapeRejected = new Set();

async function ask({ key, model, prompt, images }) {
  const strict = { ...SUMMARY_SCHEMA, additionalProperties: false };
  const productShape = !shapeRejected.has(model);
  const send = (withFallbacks) =>
    fetch(CLAUDE_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        ...(withFallbacks ? { "anthropic-beta": CLAUDE_FALLBACK_BETA } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        ...(withFallbacks ? { fallbacks: "default" } : {}),
        system: PRODUCT_SYSTEM,
        messages: [{ role: "user", content: images.length ? [...images, { type: "text", text: prompt }] : prompt }],
        output_config: { effort: CLAUDE_TEXT_EFFORT, format: { type: "json_schema", schema: strict } },
      }),
    });
  const scrub = (t) => String(t).split(key).join("[key]");
  const started = Date.now();
  let res = await send(productShape);
  let calls = 1;
  let shape = productShape;
  if (!res.ok && productShape && res.status === 400) {
    const body = await res.text().catch(() => "");
    if (/fallback/i.test(body)) {
      // The product's exact request was refused for this model; say so in the results and ask without the fallback.
      shapeRejected.add(model);
      shape = false;
      res = await send(false);
      calls++;
    } else {
      return { calls, latencyMs: Date.now() - started, error: scrub(`HTTP 400: ${body.slice(0, 300)}`), productShape: shape };
    }
  }
  const latencyMs = Date.now() - started;
  if (!res.ok) return { calls, latencyMs, error: scrub(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`), productShape: shape };
  const body = await res.json();
  const usage = body.usage ?? {};
  const out = { calls, latencyMs, inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0, servedBy: body.model, stopReason: body.stop_reason, productShape: shape };
  if (body.stop_reason === "refusal") return { ...out, error: `refusal${body.stop_details?.category ? ` (${body.stop_details.category})` : ""}` };
  const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  try {
    const value = JSON.parse(text);
    return { ...out, summary: typeof value.summary === "string" ? value.summary : "" };
  } catch {
    return { ...out, error: scrub(`not JSON: ${text.slice(0, 200)}`) };
  }
}

// ---------- commands

async function render() {
  const require = createRequire(path.join(os.homedir(), "code", "stitch-playwright", "package.json"));
  const { chromium } = require("playwright-core");
  const raw = JSON.parse(readFileSync(path.join(fixtureDir, "canvas.json"), "utf8"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const s of raw.screens) {
      const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(fixtureDir, s.file)).href);
      const out = path.join(fixtureDir, s.file.replace(/\.html$/, ".png"));
      await page.screenshot({ path: out });
      await page.close();
      console.log(`rendered ${path.relative(here, out)} (${s.w}×${s.h})`);
    }
  } finally {
    await browser.close();
  }
}

function describePlan(fixture, p) {
  const by = (k) => fixture.sources.filter((s) => s.kind === k).length;
  const long = fixture.sources.filter((s) => s.kind === "text" && s.words > LONG_NOTE_WORDS).length;
  console.log(`fixture: ${by("text")} notes (${long} over ${LONG_NOTE_WORDS} words), ${by("group")} groups, ${by("area")} areas, ${fixture.screens.length} screens`);
  const count = (f) => p.calls.filter(f).length;
  console.log(`plan: ${p.calls.length} calls — text ${count((c) => !c.vision && c.tier === "cheap")} cheap + ${count((c) => c.tier === "mid")} mid, vision ${count((c) => c.vision)} cheap`);
  console.log(`worst case (every vision call re-asked on mid, one shape retry per model): ${p.worst} calls; cap ${CALL_CAP}`);
}

async function run() {
  const fixture = buildFixture();
  const missing = fixture.screens.filter((s) => !existsSync(path.join(fixtureDir, s.png)));
  if (missing.length) throw new Error(`screens not rendered (${missing.map((s) => s.png).join(", ")}); run \`node bench.mjs render\` first`);
  const resolved = await resolveKey();
  if (!resolved) {
    console.error("No text-model key is configured: ISOCAN_TEXT_API_KEY is unset and there is no keys.json under ISOCAN_KEYS_HOME, ISOCAN_HOME or ~/.isocan. Nothing was called.");
    process.exit(2);
  }
  const tiers = TIERS[resolved.provider];
  if (!tiers) {
    console.error(`The configured provider is ${resolved.provider}; the bench names tiers for anthropic only. Nothing was called.`);
    process.exit(2);
  }
  const p = plan(fixture, tiers);
  describePlan(fixture, p);
  if (p.worst > CALL_CAP) {
    console.error(`The plan could make ${p.worst} calls, over the cap of ${CALL_CAP}. Nothing was called.`);
    process.exit(2);
  }
  console.log(`key: ${resolved.source}, provider ${resolved.provider} (the key itself is not shown)`);
  const results = [];
  let made = 0;
  const one = async (c, tier) => {
    const t = tiers[tier];
    const prompt = semanticZoomPrompt(c.source, { vision: c.vision });
    const images = c.vision ? imagesFor(c.source) : [];
    const r = await ask({ key: resolved.key, model: t.model, prompt, images });
    made += r.calls;
    const words = r.summary !== undefined ? wordCount(r.summary) : 0;
    const row = {
      sourceId: c.source.id,
      kind: c.source.kind,
      title: c.source.title,
      sourceWords: c.source.words,
      model: t.model,
      tier,
      vision: c.vision,
      images: images.length,
      promptVersion: SEMANTIC_ZOOM_PROMPT_VERSION,
      summary: r.summary ?? null,
      words,
      latencyMs: r.latencyMs,
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      costUsd: +(((r.inputTokens ?? 0) * t.in + (r.outputTokens ?? 0) * t.out) / 1e6).toFixed(6),
      servedBy: r.servedBy ?? null,
      productShape: r.productShape,
      answerRule: r.summary !== undefined ? checkSummary(r.summary) : ["no answer"],
      overTarget: words > SUMMARY_TARGET_WORDS,
      ...(r.error ? { error: r.error } : {}),
    };
    results.push(row);
    console.log(`${String(made).padStart(3)} ${row.sourceId} ${row.kind.padEnd(6)} ${t.model}${c.vision ? " +vision" : ""} ${row.error ? `ERROR ${row.error}` : `${words}w ${row.latencyMs}ms`}`);
    return row;
  };
  for (const c of p.calls) {
    const row = await one(c, c.tier);
    if (c.vision && (row.error || row.answerRule.length)) await one(c, "mid");
  }
  const total = results.reduce((s, r) => s + r.costUsd, 0);
  writeFileSync(resultsFile, JSON.stringify({ ranAt: new Date().toISOString(), promptVersion: SEMANTIC_ZOOM_PROMPT_VERSION, calls: made, costUsd: +total.toFixed(6), results }, null, 2) + "\n");
  console.log(`\n${made} calls, $${total.toFixed(4)} — written to ${path.relative(process.cwd(), resultsFile)}`);
}

function table() {
  const { results, calls, costUsd } = JSON.parse(readFileSync(resultsFile, "utf8"));
  const rows = ["| source | kind | src words | model | vis | words | ms | in/out tok | $ | rule | summary |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const r of results) {
    const short = r.model.replace("claude-", "").replace("-5-5", "");
    rows.push(`| ${r.sourceId} ${r.title} | ${r.kind} | ${r.sourceWords} | ${short} | ${r.vision ? "yes" : ""} | ${r.words} | ${r.latencyMs} | ${r.inputTokens}/${r.outputTokens} | ${r.costUsd.toFixed(5)} | ${r.answerRule.length ? r.answerRule.join(", ") : "ok"} | ${(r.summary ?? r.error ?? "").replace(/\|/g, "\\|")} |`);
  }
  console.log(rows.join("\n"));
  console.log(`\n${calls} calls, $${costUsd.toFixed(4)}`);
}

const command = process.argv[2] ?? "plan";
if (command === "render") await render();
else if (command === "plan") {
  const fixture = buildFixture();
  describePlan(fixture, plan(fixture, TIERS.anthropic));
  if (process.argv.includes("--prompts")) for (const s of [...fixture.sources, ...fixture.screens]) console.log(`\n=== ${s.id}\n${semanticZoomPrompt(s)}`);
} else if (command === "run") await run();
else if (command === "table") table();
else {
  console.error(`unknown command ${command}: render | plan | run | table`);
  process.exit(1);
}
