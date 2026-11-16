// Fact 3: does a held Tamber proposal (propose with hold, no accept) render on a running build or in a screenshot?
// Then, for contrast, does a scrub (write scope, written to no file) render, and does the design file stay unchanged?
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const APP = process.argv[2], PORT = Number(process.argv[3] ?? 47831), OUT = process.argv[4];
const { open } = await import(`${process.env.EXACT ?? "../exact"}/scripts/agent-session.mjs`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const digest = () => createHash("sha256").update(readFileSync(`${APP}/app.tamber`)).digest("hex").slice(0, 12);
const loop = spawn("/bin/sh", [`${APP}/exact.mjs`, "web", "--port", String(PORT)], { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true });
let said = ""; loop.stdout.on("data", (d) => (said += d)); loop.stderr.on("data", (d) => (said += d));
const base = `http://127.0.0.1:${PORT}`;
let s; const presence = new AbortController();
try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(base)).ok) break; } catch {} await sleep(250); }
  const token = (await (await fetch(`${base}/__tamber/token`)).json()).token;
  const wire = async (body) => { const r = await fetch(`${base}/__tamber`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  // Present, so a scrub is allowed: a subscription naming the client, held open.
  fetch(`${base}/__tamber/subscribe`, { method: "POST", headers: { "content-type": "application/json", "x-exact-tamber-token": token }, body: JSON.stringify({ client: "isocan-probe" }), signal: presence.signal }).catch(() => {});
  s = await open({ host: "web", app: APP, url: `${base}/`, size: [390, 844], seed: 1, locale: "en-US", timeZone: "UTC", epoch: "2026-01-01" });
  await s.clock("data"); await s.clock("settle");
  const hello = await wire({ method: "hello" });
  log(`hello: ${hello.body.ok.protocol}, builds ${hello.body.ok.builds.length}, design ${hello.body.ok.design}, app.tamber ${digest()}`);
  const files = hello.body.ok.files;
  await s.screenshot(`${OUT}/before.png`);
  const ops = [{ op: "set-token", name: "brand.ink", value: "light-dark(#d01010, #ff8080)" }];
  const held = await wire({ method: "propose", ops, files, hold: true, client: "isocan-probe" });
  log(`propose hold: ${held.status} proposal=${held.body.ok?.proposal} class=${held.body.ok?.class} changed=${JSON.stringify(held.body.ok?.changed)} error=${held.body.error?.message ?? ""}`);
  await sleep(2000); await s.clock("settle");
  await s.screenshot(`${OUT}/held.png`);
  const h2 = await wire({ method: "hello" });
  log(`after hold: app.tamber ${digest()}, builds' design ${JSON.stringify(h2.body.ok.builds.map((b) => b.design?.slice?.(0, 12) ?? b.design))}, pin ${JSON.stringify(h2.body.ok.builds.map((b) => b.pin))}`);
  // The documented preview request pins a mode axis, not a proposal: try it with the proposal's id to see what it says.
  const pv = await wire({ method: "preview", client: "isocan-probe", build: h2.body.ok.builds[0]?.id, proposal: held.body.ok?.proposal });
  log(`preview with a proposal id: ${pv.status} ${JSON.stringify(pv.body).slice(0, 200)}`);
  const scrub = await wire({ method: "scrub", client: "isocan-probe", ops, files });
  log(`scrub: ${scrub.status} ${JSON.stringify(scrub.body).slice(0, 160)}`);
  await sleep(1500); await s.clock("settle");
  await s.screenshot(`${OUT}/scrub.png`);
  log(`during scrub: app.tamber ${digest()}`);
  if (scrub.body.ok) { const c = await wire({ method: "scrub-cancel", client: "isocan-probe", scrub: scrub.body.ok.scrub }); log(`scrub-cancel: ${c.status}`); }
  await sleep(1500); await s.clock("settle");
  await s.screenshot(`${OUT}/after-cancel.png`);
  const d = await wire({ method: "drop", proposal: held.body.ok?.proposal, client: "isocan-probe" });
  log(`drop: ${d.status} ${JSON.stringify(d.body).slice(0, 100)}; app.tamber ${digest()}`);
} finally {
  presence.abort();
  try { await s?.close(); } catch {}
  try { process.kill(-loop.pid, "SIGTERM"); } catch {}
  log("loop said (tail):", said.trim().split("\n").slice(-6).join(" | "));
}
process.exit(0);
