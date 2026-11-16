// Fact 1: which live-frame door loads inside isocan's two ancestors (the app origin, and the content origin an HTML
// item is framed on)? Three frames in one HTML item on a scratch canvas: the dev loop plain, a bridge proxy that
// rewrites frame-ancestors, and Tamber's canvas gateway (paired read client, TLS door). A real headless Chrome loads
// the item full screen; the frame tree, the console and each response's CSP say what happened.
import { spawn, execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { writeFileSync } from "node:fs";
import { browser, throughTheDoor, until } from "../../../../scripts/lib/browser.mjs";
const [APP, OUT, ISO, CANVAS] = process.argv.slice(2);
const P = 47841, Q = 47842, R = 47843, HOME = "http://127.0.0.1:4443", CONTENT = "http://127.0.0.1:4444";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const loop = spawn("/bin/sh", [`${APP}/exact.mjs`, "web", "--port", String(P), "--remote", `127.0.0.1:${R}`], { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true });
let said = ""; loop.stdout.on("data", (d) => (said += d)); loop.stderr.on("data", (d) => (said += d));
const loopUrl = `http://127.0.0.1:${P}`;
const tls = (url, body, token) => new Promise((res, rej) => {
  const u = new URL(url); const data = JSON.stringify(body);
  const req = https.request({ host: u.hostname, port: u.port, path: u.pathname, method: "POST", rejectUnauthorized: false,
    headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...(token ? { "x-exact-tamber-token": token } : {}) } },
    (r) => { let t = ""; r.on("data", (c) => (t += c)); r.on("end", () => res({ status: r.statusCode, body: t ? JSON.parse(t) : null })); });
  req.on("error", rej); req.end(data);
});
// Door 2: a bridge proxy, as Exact Design's element bridge does — the dev page on a loopback port of our own, its
// frame-ancestors rewritten to name isocan's two origins. Everything else passes through, the loop's Host kept.
const proxy = http.createServer((req, res) => {
  const up = http.request({ host: "127.0.0.1", port: P, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${P}` } }, (r) => {
    const headers = { ...r.headers };
    if (headers["content-security-policy"]) headers["content-security-policy"] = String(headers["content-security-policy"]).replace(/frame-ancestors[^;,]*/i, `frame-ancestors 'self' ${HOME} ${CONTENT}`);
    res.writeHead(r.statusCode ?? 502, headers); r.pipe(res);
  });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(Q, "127.0.0.1");
let b;
try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(loopUrl)).ok) break; } catch {} await sleep(250); }
  const plainCsp = (await fetch(loopUrl)).headers.get("content-security-policy");
  log(`dev loop ${loopUrl} CSP: ${plainCsp}`);
  log(`proxy http://127.0.0.1:${Q} CSP: ${(await fetch(`http://127.0.0.1:${Q}/`)).headers.get("content-security-policy")}`);
  const token = (await (await fetch(`${loopUrl}/__tamber/token`)).json()).token;
  const pc = await (await fetch(`${loopUrl}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify({ method: "pair-code", scope: "read", name: "isocan" }) })).json();
  log(`pair-code: ${JSON.stringify(pc.ok?.remote ?? pc.error)}`);
  const door = pc.ok.remote.find((d) => d.fingerprint && !d.relay).origin;
  const paired = await tls(`${door}/__tamber/pair`, { code: pc.ok.code });
  log(`paired over ${door}: ${paired.status} ${paired.body?.ok ? `client ${paired.body.ok.client}, scope ${paired.body.ok.scope}` : JSON.stringify(paired.body)}`);
  const canvas = await tls(`${door}/__tamber`, { method: "canvas" }, paired.body.ok.token);
  log(`canvas: ${canvas.status} url ${canvas.body?.ok?.url}`);
  const gateway = `${canvas.body.ok.url}#g=${canvas.body.ok.grant}`;
  const html = `<!doctype html><meta charset="utf-8"><title>Live frame doors</title><style>body{margin:0;display:flex;gap:8px;font:12px system-ui}div{display:grid}iframe{width:260px;height:560px;border:1px solid #888}</style>
<div>plain<iframe name="plain" src="${loopUrl}/"></iframe></div>
<div>proxy<iframe name="proxy" src="http://127.0.0.1:${Q}/"></iframe></div>
<div>gateway<iframe name="gateway" src="${gateway}"></iframe></div>`;
  const MODE = process.env.DOORS_MODE ?? "item";
  let itemId = null;
  if (MODE === "item") {
    writeFileSync(`${OUT}/doors.html`, html);
    const added = JSON.parse(execFileSync(ISO, ["--canvas", CANVAS, "--json", "add", `${OUT}/doors.html`], { encoding: "utf8" }));
    itemId = added.itemId ?? added.id ?? added.items?.[0]?.itemId;
    log(`html item ${itemId}`);
  }
  b = await browser({ args: ["--ignore-certificate-errors"] });
  const consoleLines = [];
  await b.send("Log.enable");
  b.on("Log.entryAdded", (p) => consoleLines.push(`[log ${p.entry.source}] ${p.entry.text}`));
  b.on("Runtime.consoleAPICalled", (p) => consoleLines.push(`[console] ${p.args.map((a) => a.value ?? a.description).join(" ")}`));
  await b.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  b.on("Target.attachedToTarget", async (p, _sid) => {
    consoleLines.push(`[attached ${p.targetInfo.type}] ${p.targetInfo.url}`);
    try { await b.send("Log.enable", {}, p.sessionId); await b.send("Runtime.enable", {}, p.sessionId); } catch {}
  });
  await b.send("Page.navigate", { url: `${HOME}/` });
  await throughTheDoor(b, HOME, "Door Probe");
  await b.send("Page.navigate", { url: itemId ? `${HOME}/p/${CANVAS}/i/${itemId}` : `${HOME}/p/${CANVAS}` });
  await sleep(4000);
  if (!itemId) {
    // A module renderer draws in the app document: put the three frames there, one ancestor (the app origin).
    await b.ev(`(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;z-index:99999;display:flex;gap:8px;background:white"; d.innerHTML = ${JSON.stringify(html.replace(/^[\s\S]*?<\/style>/, ""))}; document.body.appendChild(d); return true; })()`);
  }
  await sleep(7000);
  const tree = await b.send("Page.getFrameTree");
  const walk = (n, depth = 0, out = []) => { out.push(`${"  ".repeat(depth)}${n.frame.name || "(main)"} ${n.frame.url}${n.frame.unreachableUrl ? ` unreachable=${n.frame.unreachableUrl}` : ""} origin=${n.frame.securityOrigin}`); for (const c of n.childFrames ?? []) walk(c, depth + 1, out); return out; };
  const frames = walk(tree.frameTree);
  log("frame tree:\n" + frames.join("\n"));
  log("console:\n" + consoleLines.filter((l) => /frame|ancestor|Refused|attached|CSP|Content Security/i.test(l)).join("\n"));
  const shot = await b.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/doors.png`, Buffer.from(shot.data, "base64"));
} finally {
  try { await b?.close(); } catch {}
  proxy.close();
  try { process.kill(-loop.pid, "SIGTERM"); } catch {}
  log("loop said:", said.split("\n").filter((l) => /remote|canvas|fingerprint|tls|https/i.test(l)).slice(0, 6).join(" | "));
}
process.exit(0);
