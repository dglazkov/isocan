// Fact 2: does Exact's resident agent session (scripts/agent-session.mjs open) survive a rebuild of the dev loop?
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const APP = process.argv[2], PORT = Number(process.argv[3] ?? 47821), OUT = process.argv[4];
const { open } = await import(`${process.env.EXACT ?? "../exact"}/scripts/agent-session.mjs`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const loop = spawn("/bin/sh", [`${APP}/exact.mjs`, "web", "--port", String(PORT)], { cwd: APP, stdio: ["ignore", "pipe", "pipe"], detached: true });
let loopSaid = ""; loop.stdout.on("data", (d) => (loopSaid += d)); loop.stderr.on("data", (d) => (loopSaid += d));
const base = `http://127.0.0.1:${PORT}/`;
const file = `${APP}/app.contract`, original = readFileSync(file, "utf8");
let s;
try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(base)).ok) break; } catch {} await sleep(250); }
  log("dev loop up at", base);
  let t = Date.now();
  s = await open({ host: "web", app: APP, url: base, size: [390, 844], seed: 1, locale: "en-US", timeZone: "UTC", epoch: "2026-01-01" });
  log(`session opened in ${Date.now() - t} ms (boot ${s.boot})`);
  const text = async () => JSON.stringify(await s.tree());
  t = Date.now(); await s.clock("data"); await s.clock("settle"); await s.screenshot(`${OUT}/before.png`); log(`warm screenshot op: ${Date.now() - t} ms`);
  const times = [];
  for (let i = 0; i < 3; i++) { t = Date.now(); await s.screenshot(`${OUT}/warm-${i}.png`); times.push(Date.now() - t); }
  log(`warm screenshot ops: ${times.join(", ")} ms`);
  log("heading before:", (await text()).includes("Acme Market Two") ? "edited" : "original");
  writeFileSync(file, original.replace('"Acme Market"', '"Acme Market Two"'));
  const saved = Date.now(); log("saved a source change (heading text) mid-session");
  let outcome = "no change seen in 60 s";
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try {
      const tree = await text();
      if (tree.includes("Acme Market Two")) { outcome = `session alive; new text after ${Date.now() - saved} ms`; break; }
    } catch (e) { outcome = `session broke after ${Date.now() - saved} ms: ${String(e.message).split("\n")[0]}`; break; }
  }
  log("after rebuild:", outcome);
  try { t = Date.now(); await s.clock("settle"); await s.screenshot(`${OUT}/after.png`); log(`screenshot after rebuild: ok in ${Date.now() - t} ms`); }
  catch (e) { log("screenshot after rebuild FAILED:", String(e.message).split("\n")[0]); }
} finally {
  writeFileSync(file, original);
  try { await s?.close(); } catch {}
  try { process.kill(-loop.pid, "SIGTERM"); } catch {}
  log("loop said (tail):", loopSaid.trim().split("\n").slice(-4).join(" | "));
}
process.exit(0);
