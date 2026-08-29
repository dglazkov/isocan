#!/usr/bin/env node
/**
 * Deterministic graders for a screen.
 *
 * Stage 2 of docs/projects/evals/plan.md, and the argument there is the whole design of this
 * file: most eval work reaches for a model's opinion because its outputs are
 * prose, and ours are not. A screen has a contrast ratio, a DOM, an image with
 * a real aspect ratio, and controls that either have accessible names or do
 * not. Every check here is reproducible, costs nothing per run, and can never
 * drift — which means it is a point of quality no judge ever has to argue
 * about.
 *
 * It grades FILES, not canvases, and gets at a canvas through `isocan get`.
 * That keeps it honest in two ways: it needs no badge and no API, and it
 * measures the artifact somebody would actually receive.
 *
 *   node scripts/grade.mjs --file test/fixtures/deliberately-bad.html
 *   node scripts/grade.mjs --project prj_VXBXnkxp4C
 *   node scripts/grade.mjs --project prj_VXBXnkxp4C --json
 *
 * What it deliberately does NOT do: score taste. The slop rules in
 * @isocan/core are written for a reader with judgement, and only a handful are
 * greppable. Those few are checked here; the rest are Stage 4's problem, and
 * pretending otherwise would put a number on something this file cannot see.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
/** Temp path → the canvas title to report it under. */
const titles = new Map();
/**
 * **Where Chrome is, which is not one place.**
 *
 * This was a single macOS path, and the consequence was the lesson arriving a
 * third time. `release.yml` has run `--selftest` on every commit for weeks
 * under a comment reading "Chrome is on the GitHub runner already" — true, at
 * `/usr/bin/google-chrome`. The spawn ENOENT'd every single time, and
 * `continue-on-error` turned it into a green checkmark. The graders that exist
 * to stop us believing a silent zero were themselves a silent zero, in the one
 * place we pointed at when we said they were checked.
 *
 * `CHROME_PATH` first so a machine can always answer for itself; then the
 * ordinary places on both platforms. `chromeOrDie` says what it looked for
 * rather than throwing a bare ENOENT, because the whole failure above was
 * somebody reading an error that did not name its own cause.
 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/google/chrome/chrome",
].filter(Boolean);

function chromeOrDie() {
  // An env var that is SET and wrong is a mistake, not a hint: falling
  // through to whatever else is on the machine would grade with a browser
  // nobody asked for and say nothing, which is the shape of the bug this
  // whole block exists to close.
  for (const name of ["CHROME_PATH", "CHROME_BIN"]) {
    const asked = process.env[name];
    if (asked && !existsSync(asked)) throw new Error(`${name} is set to ${asked} — nothing there`);
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "no Chrome found — set CHROME_PATH. Looked in:\n  " + CHROME_CANDIDATES.join("\n  "),
  );
}
const WIDTHS = [390, 768, 1440];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the static half: things visible in the source ----

/** Colour literals where a custom property could be. Not every literal is a
 *  fault — an alpha mask is a real use — so this counts rather than judges. */
function colourLiterals(text) {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  const fn = [...css.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)].map((m) => m[0]);
  const vars = (css.match(/var\(--/g) ?? []).length;
  return { literals: hex.length + fn.length, tokens: vars };
}

/** The few tells that are a string match rather than a judgement call. The
 *  rest of SLOP_RULES needs a reader; see the header. */
const GREPPABLE = [
  { name: "Lorem or invented content", re: /\blorem ipsum\b|\bJohn Doe\b|\bCompany Name\b/i },
  { name: "Generic call to action", re: />\s*(get started|learn more|click here|discover)\s*</i },
  { name: "Marketing adjectives instead of facts", re: /\b(seamless|revolutioni[sz]e|unlock|elevate|effortless|cutting-edge)\b/i },
  { name: "Emoji as section markers", re: /^\s*<h[1-6][^>]*>\s*\p{Extended_Pictographic}/mu },
];
const slopHits = (text) => GREPPABLE.filter((r) => r.re.test(text)).map((r) => r.name);

// ---- the rendered half ----

/**
 * **Chrome picks the port, and tells us which one it picked.**
 *
 * It used to be `9500 + (pid % 400)`, which is a guess with two ways to be
 * wrong and no way to notice either. Two graders whose pids differ by exactly
 * 400 want one port; and a Chrome left behind by an aborted run still HOLDS
 * that port, so the next grader's `/json/list` answers with the OLD browser's
 * target and it drives somebody else's browser. Two graders sharing one page,
 * each navigating under the other, is a reading of whatever happened to be
 * loaded — which is exactly the shape of "reported one failure on a page built
 * to break seven".
 *
 * `--remote-debugging-port=0` makes Chrome bind a free port and write it to
 * `DevToolsActivePort` in the profile directory. The profile is a fresh
 * mkdtemp, so that file cannot be anybody else's, and reading it is a fact
 * rather than a guess. Waiting for it is a condition — the file exists or it
 * does not — and never a duration.
 */
async function devtoolsEndpoint(dir, proc) {
  const file = path.join(dir, "DevToolsActivePort");
  // Bounded so a Chrome that never starts fails rather than hangs; the bound
  // is a deadline on a CONDITION, which is the honest use of a clock — the
  // loop exits the moment the file appears, not when a timer says it should.
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (proc.exitCode !== null) throw new Error(`chrome exited (${proc.exitCode}) before it was ready`);
    try {
      const [port, wsPath] = readFileSync(file, "utf8").split("\n");
      if (port && wsPath) return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
    } catch {}
    if (Date.now() > deadline) throw new Error(`chrome did not write ${file} — no DevTools endpoint`);
    await sleep(50);
  }
}

async function browser() {
  const dir = mkdtempSync(path.join(tmpdir(), "grade-"));
  const proc = spawn(chromeOrDie(), ["--headless=new", "--remote-debugging-port=0",
    `--user-data-dir=${dir}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  // Ordinary resolution first, and the explicit path only as the fallback it
  // was meant to be. The hardcoded one alone fails in a git WORKTREE, whose
  // `node_modules` is the main checkout's and not `repo/node_modules` — so the
  // graders could not run there at all, which reads exactly like a flake to
  // whoever meets it.
  const { default: WebSocket } = await import("ws").catch(() =>
    import(path.join(repo, "node_modules/ws/index.js")),
  );
  let endpoint;
  try {
    endpoint = await devtoolsEndpoint(dir, proc);
  } catch (err) {
    proc.kill(); rmSync(dir, { recursive: true, force: true }); throw err;
  }
  // The browser endpoint, then a page target of our own — created rather than
  // discovered, so nothing depends on which targets happen to exist.
  const browserWs = new WebSocket(endpoint, { maxPayload: 1 << 28 });
  await new Promise((r, j) => { browserWs.once("open", r); browserWs.once("error", j); });
  let bid = 0; const bpending = new Map();
  browserWs.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && bpending.has(m.id)) { bpending.get(m.id)(m); bpending.delete(m.id); }
  });
  const bsend = (method, params = {}) => {
    const mid = ++bid; browserWs.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => bpending.set(mid, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))));
  };
  const { targetId } = await bsend("Target.createTarget", { url: "about:blank" });
  const { targetInfos } = await bsend("Target.getTargets");
  const mine = targetInfos.find((t) => t.targetId === targetId);
  if (!mine) throw new Error("chrome would not make a page target");
  const wsUrl = endpoint.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`);
  const ws = new WebSocket(wsUrl, { maxPayload: 1 << 28 });
  await new Promise((r, j) => { ws.once("open", r); ws.once("error", j); });
  let id = 0; const pending = new Map(); let errors = [];
  /** Callers waiting on a CDP EVENT rather than a reply — see `once`. */
  const waiters = new Map();
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails?.exception?.description ?? "").split("\n")[0]);
    const w = waiters.get(m.method);
    if (w) { waiters.delete(m.method); w(m.params); }
  });
  const send = (method, params = {}) => {
    const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res, rej) => pending.set(mid, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))));
  };
  await send("Page.enable"); await send("Runtime.enable");
  return {
    send,
    /**
     * **Arm a listener for one CDP event, BEFORE the thing that causes it.**
     *
     * The order is the whole point: arming after `Page.navigate` is a race
     * that a fast load wins, and the symptom of losing it is a wait that
     * never ends. So callers arm, then act, then await.
     */
    once: (method) => new Promise((res) => waiters.set(method, res)),
    ev: async (e) => {
      const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(`probe threw: ${d.exception?.description ?? d.text}`.split("\n")[0]);
      }
      return r.result?.value;
    },
    takeErrors: () => { const e = errors; errors = []; return e; },
    close: async () => {
      try { ws.close(); } catch {}
      proc.kill();
      await new Promise((r) => { proc.once("exit", r); setTimeout(r, 2000); });
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    },
  };
}

/** Runs in the page. Every number here is measured, never inferred. */
const PROBE = `(() => {
  const px = (c) => { const m = (c.match(/[\\d.]+/g) || []).map(Number); return m.length ? { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 } : null; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Walk up for the first opaque background — the way the eye does, not the
  // way the element declares.
  const behind = (el) => {
    for (let n = el; n; n = n.parentElement) { const bg = px(getComputedStyle(n).backgroundColor); if (bg && bg.a >= 0.95) return bg; }
    const body = px(getComputedStyle(document.body).backgroundColor);
    return body && body.a >= 0.95 ? body : { r: 255, g: 255, b: 255, a: 1 };
  };
  const contrast = [];
  for (const el of document.querySelectorAll("body *")) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const fg = px(cs.color); if (!fg) continue;
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const r = ratio(fg, behind(el));
    if (r < need) contrast.push({ text: text.slice(0, 40), ratio: +r.toFixed(2), need });
  }
  const stretched = [...document.querySelectorAll("img")].filter((img) => {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    const r = img.getBoundingClientRect(); if (!r.width || !r.height) return false;
    return Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) > 0.02;
  }).map((img) => ({ src: String(img.currentSrc || img.src).slice(-40), natural: img.naturalWidth + "x" + img.naturalHeight, rendered: Math.round(img.getBoundingClientRect().width) + "x" + Math.round(img.getBoundingClientRect().height) }));
  const named = (el) => (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title") ||
    (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent.trim()) ||
    (el.tagName === "IMG" && el.getAttribute("alt") !== null);
  const controls = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=button]")];
  /**
   * **WCAG 2.5.8's inline exception, which this grader did not know.**
   *
   * "Target Size (Minimum)" exempts a target that is *in a sentence, or whose
   * size is otherwise constrained by the line-height of non-target text*. A
   * link inside a paragraph is the case it was written for: padding it to 24px
   * would break the line rhythm of the prose around it, so enforcing the rule
   * there does not just fail to help, it asks for a worse page.
   *
   * The front door tripped this three times, on three ordinary prose links,
   * and every one was a false failure. **False failures are how a grader
   * becomes decoration** — the night shift's own list of ways this fails ends
   * with the graders drifting into it — so the rule learns the exception
   * rather than the page learning to live with a wrong number.
   *
   * Read mechanically and close to the spec's words: the control lays out
   * inline, and the element holding it has text of its own outside it. That is
   * "in a sentence" without needing to know what a sentence is.
   */
  const inSentence = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const parent = el.parentElement;
    if (!parent) return false;
    return (parent.textContent || "").trim().length > (el.textContent || "").trim().length;
  };
  const undersized = controls.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.height < 24 || r.width < 24) && !inSentence(el);
  });
  return {
    contrast,
    stretched,
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    nameless: controls.filter((el) => el.offsetParent !== null && !named(el)).length,
    smallTargets: undersized.length,
    // **Which ones.** A count is not actionable: "3 small targets" on a page
    // of six hundred lines sends somebody hunting, and this file exists to be
    // acted on. Named the way a person finds it — the tag, its classes, and
    // the words in it — rather than by a synthesised selector nobody can grep.
    smallTargetDetail: undersized
      .slice(0, 20)
      .map((el) => { const r = el.getBoundingClientRect(); return {
        where: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : ""),
        text: (el.textContent || "").trim().slice(0, 40),
        size: Math.round(r.width) + "×" + Math.round(r.height),
      }; }),
    imagesWithoutAlt: [...document.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === null).length,
  };
})()`;

/** The source as the browser sees it: the file plus any stylesheet it links
 *  relatively. A canvas item is self-contained and this is a no-op for it, but
 *  a page with a linked stylesheet would otherwise be reported as using no
 *  tokens at all — which is how this was found. */
function sourceWithLinkedCss(file) {
  const html = readFileSync(file, "utf8");
  let all = html;
  for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
    const href = m[1];
    if (/^[a-z]+:/i.test(href) || href.startsWith("//")) continue; // remote: not ours to grade
    try { all += "\n" + readFileSync(path.resolve(path.dirname(file), href), "utf8"); } catch {}
  }
  return all;
}

async function gradeFile(b, file) {
  const source = sourceWithLinkedCss(file);
  const perWidth = {};
  let renders = true, pageErrors = [];
  for (const w of WIDTHS) {
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    /**
     * **Nothing here waits for a duration.**
     *
     * It used to be `navigate; sleep(1400); takeErrors(); sleep(600)`, and
     * `Page.navigate` resolves when navigation STARTS. So the two sleeps were
     * a bet that a page would be loaded and settled in 2 seconds — a bet that
     * a loaded CI runner loses, and loses SILENTLY: the probe runs against a
     * half-built document, finds fewer contrast failures than exist, and the
     * grader reports a page as healthier than it is. That is the dangerous
     * direction for an instrument, and it is what "one failure on a page built
     * to break seven" was.
     *
     * Three conditions replace it, and each is something the page itself
     * declares:
     *
     * 1. `Page.loadEventFired` — the document and its subresources are in.
     *    Armed BEFORE `navigate`, because a fast load would otherwise fire
     *    before anybody was listening.
     * 2. `document.fonts.ready` — text is laid out in the font it will be
     *    measured in. Contrast and target-size read from rendered text, so a
     *    fallback font is a different reading.
     * 3. Two animation frames — the browser has produced a paint with all of
     *    the above applied. One frame schedules; the second proves the first
     *    was served.
     *
     * The errors are cleared BEFORE the navigation rather than partway
     * through it. The old clear sat between the two sleeps, which dropped
     * whatever the page reported in its first 1.4 seconds — a page that threw
     * on load looked clean if it threw quickly enough.
     */
    b.takeErrors();
    const loaded = b.once("Page.loadEventFired");
    const nav = await b.send("Page.navigate", { url: `file://${path.resolve(file)}` });
    if (nav.errorText) throw new Error(`could not open ${file}: ${nav.errorText}`);
    await loaded;
    try {
      await b.ev(`(async () => {
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return true;
      })()`);
      const reading = await b.ev(PROBE);
      if (!reading || typeof reading !== "object" || !Array.isArray(reading.contrast)) {
        throw new Error(`probe returned ${reading === undefined ? "undefined" : typeof reading}, not a reading`);
      }
      perWidth[w] = reading;
    } catch (err) { renders = false; pageErrors.push(String(err.message).slice(0, 120)); }
    pageErrors.push(...b.takeErrors());
  }
  const at = (pick) => Object.fromEntries(Object.entries(perWidth).map(([w, r]) => [w, pick(r)]));
  const widest = perWidth[1440] ?? Object.values(perWidth)[0] ?? {};
  const { literals, tokens } = colourLiterals(source);
  return {
    file: titles.get(path.resolve(file)) ?? path.relative(repo, file),
    renders: renders && Object.keys(perWidth).length === WIDTHS.length,
    pageErrors: [...new Set(pageErrors)].slice(0, 3),
    contrastFailures: at((r) => (r?.contrast ?? []).length),
    // Ten, not three. Three was a taste of a list, and a page failing twelve
    // times showed the same heading style three times over — which reads as
    // "three problems" when it is one rule used twelve times.
    worstContrast: (widest.contrast ?? []).slice(0, 10),
    stretchedImages: (widest.stretched ?? []).length,
    stretchedDetail: widest.stretched ?? [],
    sidewaysAt: Object.entries(at((r) => r?.sideways)).filter(([, v]) => v).map(([w]) => +w),
    namelessControls: widest.nameless ?? 0,
    smallTargets: widest.smallTargets ?? 0,
    smallTargetDetail: widest.smallTargetDetail ?? [],
    imagesWithoutAlt: widest.imagesWithoutAlt ?? 0,
    colourLiterals: literals,
    colourTokens: tokens,
    slop: slopHits(source),
  };
}

/** Checks, as pass/fail. Deliberately NOT a weighted score: a single number
 *  invites tuning the number, and every one of these is independently
 *  actionable. */
function checks(g) {
  return {
    renders: g.renders,
    "no contrast failures": Object.values(g.contrastFailures).every((n) => n === 0),
    "no stretched images": g.stretchedImages === 0,
    "no sideways scroll": g.sidewaysAt.length === 0,
    "every control named": g.namelessControls === 0,
    "targets ≥ 24px": g.smallTargets === 0,
    "images have alt": g.imagesWithoutAlt === 0,
    "no greppable tells": g.slop.length === 0,
  };
}

// ---- entry ----

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const asJson = argv.includes("--json");
const cli = path.join(repo, "packages/cli/bin/isocan.js");

function report(graded) {
  let failed = 0;
  for (const g of graded) {
    const c = checks(g);
    failed += Object.values(c).filter((ok) => !ok).length;
    console.log(`\n${g.file}  —  ${Object.values(c).filter(Boolean).length}/${Object.keys(c).length} checks pass`);
    for (const [name, ok] of Object.entries(c)) console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
    if (g.pageErrors.length) console.log(`       errors: ${g.pageErrors.join(" | ")}`);
    console.log(`       contrast failures by width  ${Object.entries(g.contrastFailures).map(([w, n]) => `${w}:${n}`).join("  ")}`);
    for (const f of g.worstContrast) console.log(`         ${f.ratio} (needs ${f.need})  "${f.text}"`);
    for (const st of g.stretchedDetail) console.log(`         stretched ${st.src}  natural ${st.natural} rendered ${st.rendered}`);
    for (const t of g.smallTargetDetail) console.log(`         small target ${t.size}  ${t.where}  "${t.text}"`);
    if (g.slop.length) console.log(`       tells: ${g.slop.join(", ")}`);
    console.log(`       colour: ${g.colourLiterals} literals, ${g.colourTokens} token uses`);
  }
  console.log(`\n${graded.length} graded, ${failed} failing checks`);
  return failed;
}

/**
 * A test for the test. Every check must FAIL on the fixture; one that passes
 * there has stopped measuring and is quietly reporting a zero.
 *
 * This exists because the first version of this file did exactly that: the
 * probe carried a syntax error, `Runtime.evaluate` answers such a thing with
 * `exceptionDetails` rather than rejecting, every reading fell back to empty,
 * and a page with a stretched image scored 8/8. A grader that reports zeros
 * when it breaks is worse than no grader, because it is believed.
 */
if (argv.includes("--selftest")) {
  const b = await browser();
  let g;
  try { g = await gradeFile(b, path.join(repo, "test/fixtures/deliberately-bad.html")); } finally { await b.close(); }
  const c = checks(g);
  const silent = Object.entries(c).filter(([name, ok]) => name !== "renders" && ok).map(([name]) => name);
  for (const [name, ok] of Object.entries(c)) {
    console.log(`  ${name === "renders" ? (ok ? "ok    " : "FAIL  ") : ok ? "SILENT" : "fires "} ${name}`);
  }
  if (!c.renders) { console.error("\nthe fixture did not render — fix the fixture, not the grader"); process.exit(1); }
  if (silent.length) { console.error(`\n${silent.length} check(s) stayed silent on a page built to break them: ${silent.join(", ")}`); process.exit(1); }
  console.log(`\nall ${Object.keys(c).length - 1} checks fire`);
  process.exit(0);
}

let files = [];
let scratch = null;
const one = arg("--file");
const project = arg("--project");
if (one) files = [one];
else if (project) {
  // Through `isocan get`, so this needs no badge and grades the artifact
  // somebody would actually receive. Filename and mime live on the VERSION,
  // and the one that matters is the current one.
  const rows = JSON.parse(execFileSync("node", [cli, "--project", project, "ls", "--json"], { encoding: "utf8" }));
  const current = (item) =>
    (item.versions ?? []).find((v) => v.id === item.currentVersionId) ?? (item.versions ?? []).at(-1);
  const items = (rows.items ?? rows).filter((i) => current(i)?.mimeType === "text/html");
  scratch = mkdtempSync(path.join(tmpdir(), "graded-"));
  for (const item of items) {
    const out = path.join(scratch, `${item.id}.html`);
    execFileSync("node", [cli, "--project", project, "get", item.id, out], { stdio: "ignore" });
    files.push(out);
    titles.set(path.resolve(out), `${item.title} (${item.id})`);
  }
  if (files.length === 0) console.error(`${project}: no HTML items to grade`);
} else {
  console.error("usage: grade.mjs --file <path> | --project <id> | --selftest [--json]");
  process.exit(2);
}

const b = await browser();
const graded = [];
try { for (const f of files) graded.push(await gradeFile(b, f)); } finally { await b.close(); }
if (scratch) rmSync(scratch, { recursive: true, force: true });

// **The verdicts ride WITH the readings.** `--json` used to emit the raw
// measurements only, and every consumer therefore had to re-derive pass/fail
// from `contrastFailures` and `stretchedImages` by hand — which the nightly
// promptly got wrong, reporting "0 failing checks" on a page whose contrast
// failures it printed three lines further down. A grader whose machine-readable
// output omits its own conclusion is inviting exactly that.
if (asJson) console.log(JSON.stringify(graded.map((g) => ({ ...g, checks: checks(g) })), null, 2));
else report(graded);
