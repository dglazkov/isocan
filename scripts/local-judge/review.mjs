#!/usr/bin/env node
/**
 * **Review the drafted routes, one ask at a time** (local-judge phase 1).
 *
 *   node scripts/local-judge/review.mjs [--port 4460] [--dir <dir>]
 *
 * A page on 127.0.0.1 only, served by this process and published nowhere,
 * over `<isocan home>/local-judge/asks.json`. Each ask is shown with its
 * draft and where the draft came from; the person confirms it (Enter) or
 * picks another route (1–7), and the page moves to the next unreviewed ask.
 * Every answer is written to the file the moment it is given (atomically),
 * as `label`, `reviewedBy: "person"` and `reviewedAt` — closing the tab loses
 * nothing. ← → move without answering; `u` clears a row's review.
 *
 * The URL carries a one-run token the API requires, and the server answers
 * only a Host of 127.0.0.1 or localhost — a page elsewhere cannot read the
 * set through it. The ask's words are put on the page as text, never markup.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { register } from "tsx/esm/api";
import { ASKS_FILE, argOf, judgeDir, readJson, refuseInRepo, writeJsonAtomic } from "./lib.mjs";

const arg = argOf(process.argv.slice(2));
const dir = path.resolve(arg("--dir", judgeDir()));
refuseInRepo(dir);
const port = Number(arg("--port", "4460"));
register();
const { ROUTES, ROUTE_ABOUT, isRoute } = await import("@isocan/core/intent-route");

const file = path.join(dir, ASKS_FILE);
const token = randomBytes(16).toString("hex");
const load = () => {
  const asks = readJson(file, null);
  if (!asks) throw new Error(`no real set at ${file} — \`node scripts/local-judge/export.mjs\` then \`draft.mjs\` first`);
  return asks;
};
load();

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'">
<title>Route review</title>
<style>
:root { color-scheme: light dark; --bg:#fbfaf7; --fg:#1d1c1a; --muted:#6b675f; --line:#ddd8cc; --accent:#2f6f4f; }
@media (prefers-color-scheme: dark) { :root { --bg:#1a1918; --fg:#ece8df; --muted:#a39e93; --line:#3a3833; --accent:#7fc29b; } }
body { margin:0; padding:16px; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }
main { max-width:760px; margin:0 auto; }
h1 { font-size:17px; margin:0 0 4px; }
.muted { color:var(--muted); font-size:13px; }
progress { width:100%; height:8px; }
#ask { white-space:pre-wrap; word-break:break-word; border:1px solid var(--line); padding:12px; margin:12px 0; min-height:4em; border-radius:6px; }
ol { padding:0; list-style:none; margin:0; }
li { display:flex; gap:10px; padding:6px 8px; border:1px solid var(--line); border-radius:6px; margin:4px 0; cursor:pointer; }
li .k { font-weight:600; width:1.2em; }
li.draft { outline:2px dashed var(--accent); }
li.chosen { background:color-mix(in srgb, var(--accent) 22%, transparent); }
li small { color:var(--muted); display:block; }
kbd { border:1px solid var(--line); border-radius:3px; padding:0 4px; font-size:12px; }
</style></head>
<body><main>
<h1>Route review</h1>
<p class="muted">Confirm the dashed draft with <kbd>Enter</kbd>, or pick a route with <kbd>1</kbd>–<kbd>7</kbd>. <kbd>←</kbd> <kbd>→</kbd> move, <kbd>u</kbd> clears a review. Each answer is saved to the file as you give it.</p>
<progress id="bar" max="1" value="0"></progress>
<p id="status" class="muted" role="status"></p>
<div id="meta" class="muted"></div>
<div id="ask"></div>
<ol id="routes"></ol>
<p id="saved" class="muted" aria-live="polite"></p>
</main>
<script>
const TOKEN = new URLSearchParams(location.search).get("t");
const ROUTES = ${JSON.stringify(ROUTES)};
const ABOUT = ${JSON.stringify(ROUTE_ABOUT)};
let rows = [], at = 0;
const $ = (id) => document.getElementById(id);
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { "x-token": TOKEN, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function nextOpen(from) { for (let i = 0; i < rows.length; i++) { const j = (from + i) % rows.length; if (!rows[j].reviewedBy) return j; } return from; }
function render() {
  const done = rows.filter((r) => r.reviewedBy).length;
  $("bar").max = rows.length || 1; $("bar").value = done;
  $("status").textContent = rows.length ? \`\${done} of \${rows.length} reviewed — ask \${at + 1}\` : "No asks in the set.";
  const r = rows[at]; if (!r) return;
  $("meta").textContent = \`\${r.selected} selected · \${r.main ? "in the Chat" : "in a thread"} · draft from \${r.draft ? r.draft.source : "nobody"} · categoriseAsk says \${r.baseline}\${r.reviewedBy ? " · reviewed" : ""}\`;
  $("ask").textContent = r.body;
  const list = $("routes"); list.textContent = "";
  ROUTES.forEach((route, i) => {
    const li = document.createElement("li");
    if (r.draft && r.draft.route === route) li.classList.add("draft");
    if (r.label === route && r.reviewedBy) li.classList.add("chosen");
    const k = document.createElement("span"); k.className = "k"; k.textContent = String(i + 1);
    const d = document.createElement("div"); d.textContent = route;
    const s = document.createElement("small"); s.textContent = ABOUT[route]; d.appendChild(s);
    li.append(k, d); li.onclick = () => choose(route); list.appendChild(li);
  });
}
// The page moves on at once; the saves follow in order behind it, and a save
// that fails puts the row back and says so.
let saving = Promise.resolve();
function save(r, route, words) {
  const before = { label: r.label, reviewedBy: r.reviewedBy };
  Object.assign(r, route === null ? { label: null, reviewedBy: null } : { label: route, reviewedBy: "person" });
  saving = saving.then(async () => {
    Object.assign(r, await api("POST", "/label", { id: r.id, route }));
    $("saved").textContent = words;
  }).catch((e) => { Object.assign(r, before); $("saved").textContent = "Not saved: " + e.message; render(); });
}
function choose(route) {
  const i = at;
  save(rows[i], route, \`Saved: \${route}.\`);
  at = nextOpen(i);
  render();
}
function clear() {
  save(rows[at], null, "Review cleared.");
  render();
}
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
  const n = Number(e.key);
  if (n >= 1 && n <= ROUTES.length) { e.preventDefault(); choose(ROUTES[n - 1]); }
  else if (e.key === "Enter" && rows[at].draft) { e.preventDefault(); choose(rows[at].draft.route); }
  else if (e.key === "ArrowRight") { at = Math.min(rows.length - 1, at + 1); render(); }
  else if (e.key === "ArrowLeft") { at = Math.max(0, at - 1); render(); }
  else if (e.key === "u") clear();
});
api("GET", "/rows").then((r) => { rows = r; at = nextOpen(0); render(); }, (e) => { $("status").textContent = "Could not load the set: " + e.message; });
</script></body></html>`;

/** What the page may see of a row: no canvas id, no thread id. */
const view = (r) => ({ id: r.id, body: r.body, selected: r.selected, main: r.main, baseline: r.baseline, draft: r.draft, label: r.label, reviewedBy: r.reviewedBy });

const server = createServer(async (req, res) => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (host !== "127.0.0.1" && host !== "localhost") {
    res.writeHead(421).end("this page answers on 127.0.0.1 only");
    return;
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(type === "application/json" ? JSON.stringify(body) : body);
  };
  if (url.pathname === "/" && req.method === "GET") return send(200, page, "text/html; charset=utf-8");
  if (req.headers["x-token"] !== token) return send(403, { error: "not this run's page" });
  if (url.pathname === "/rows" && req.method === "GET") return send(200, load().rows.map(view));
  if (url.pathname === "/label" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { id, route } = JSON.parse(raw || "{}");
    if (route !== null && !isRoute(route)) return send(400, { error: `not a route: ${route}` });
    const asks = load();
    const row = asks.rows.find((r) => r.id === id);
    if (!row) return send(404, { error: "no such ask" });
    if (route === null) Object.assign(row, { label: null, reviewedBy: null, reviewedAt: null });
    else Object.assign(row, { label: route, reviewedBy: "person", reviewedAt: new Date().toISOString() });
    writeJsonAtomic(file, asks);
    return send(200, view(row));
  }
  send(404, { error: "no such route" });
});
server.listen(port, "127.0.0.1", () => {
  const rows = load().rows;
  console.log(`review ${rows.length} asks (${rows.filter((r) => r.reviewedBy === "person").length} reviewed) at http://127.0.0.1:${port}/?t=${token}`);
  console.log(`saving to ${file} — Ctrl-C stops the page; nothing is lost`);
});
