#!/usr/bin/env node
/**
 * A scratch machine that has never been anywhere, for working ON isocan.
 *
 * Two of the three reasons this script used to give dissolved in phase 10.3:
 * pointing the real `~/.isocan` at a home no longer demotes the developer's
 * own daemon (the home is a property of the canvas now, and `isocan home` only
 * says where the NEXT one is born), and one daemon on :4441 can be the home of
 * the web app's canvases and a replica of dev at the same time. What survives
 * is the reason that was never about self-defence: **an isolated, disposable
 * state directory that starts from a known-empty machine** — its own
 * `ISOCAN_HOME` (`.dev-replica/` in the checkout, gitignored), a fresh badge
 * with no admissions, and therefore the join-by-pass flow exercised from zero
 * rather than from whatever your laptop happens to have accumulated. That is
 * what the line below is saying, and it is why the script is still worth
 * having.
 *
 *   npm run dev:replica                 # a scratch replica of dev, on :4442
 *   npm run dev:replica -- ls           # any CLI command, against that replica
 *   ISOCAN_DEV_HOME=http://127.0.0.1:4441 npm run dev:replica    # some other home
 *
 * Phase 10.5's docs/development.md owns the wider explanation of which daemon
 * to use for which kind of work; this header stays one paragraph.
 *
 * **It starts EMPTY, and that is not a bug.** Since phase 8 a replica
 * mirrors the canvases it was let into, not everything its home would show
 * it — so a scratch replica whose badge has been nowhere holds nothing, no
 * matter how many canvases are sitting at dev. Two ways to give it one:
 *
 *   npm run dev:replica -- setup <home>/p/<canvas>#<pass>   # the real gesture
 *   npm run dev:replica -- setup <home>/p/<canvas>          # link grant only
 *
 * The first is what a second machine actually does (mint the pass from a
 * session already on the canvas: `isocan pass`), and it is the flow worth
 * exercising when you are working on the home. The second works while the
 * canvas's link grant is on and hands over no identity. Either way the
 * canvas is asked for BY NAME — nothing here enumerates dev, and a replica
 * that shows an empty `list` has simply not been given anything yet.
 *
 * The address is deliberately not compiled into the CLI — a default of
 * `isocan.io` would have every canvas made in this checkout born at
 * production, and that flip belongs to phase 14's promotion gesture. It is
 * compiled into THIS script instead, where it is only ever the repo's own
 * habit.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

/** The repo's habit, overridable per run. Not a default anything ships with. */
const homeUrl = process.env.ISOCAN_DEV_HOME ?? "https://dev.isocan.io";
/** Not 4441: `npm run dev`'s local home lives there, and the whole point is
 * to be able to have both at once. */
const port = process.env.ISOCAN_DEV_REPLICA_PORT ?? "4442";
const isocanHome = process.env.ISOCAN_DEV_REPLICA_HOME ?? path.join(root, ".dev-replica");

const cli = path.join(root, "packages/cli/bin/isocan.js");
const args = process.argv.slice(2);
const env = {
  ...process.env,
  ISOCAN_HOME: isocanHome,
  ISOCAN_PORT: port,
  // The birth default for the scratch daemon, set here and written to no
  // config file: a scratch daemon should not leave a setting behind it.
  // Since phase 10.3 this says only "a canvas made here is made at dev" — it
  // demotes nothing — so what makes this daemon a replica of anything is the
  // `setup <address>#<pass>` below, which joins one canvas by name.
  // `isocan home <url>` is the durable way to say the same narrow thing.
  ISOCAN_HOME_URL: homeUrl,
};

if (args.length > 0) {
  // The other half of "no exports in your shell": any CLI command, run
  // against the scratch replica instead of the machine's own daemon.
  spawn(process.execPath, [cli, ...args], { stdio: "inherit", env }).on("exit", (code) =>
    process.exit(code ?? 0),
  );
} else {
  console.log(`isocan replica of ${homeUrl}`);
  console.log(`  port  ${port}`);
  console.log(`  home  ${isocanHome}  (its own — your ~/.isocan is untouched)`);
  console.log(`  drive it with: npm run dev:replica -- <command>`);
  // Said every time, because an empty replica looks broken and the fix is one
  // line. A replica carries what it was let into; this one has been let into
  // nothing yet.
  console.log(`  it holds nothing until you join a canvas:`);
  console.log(`    npm run dev:replica -- setup ${homeUrl}/p/<canvas>#<pass>\n`);
  spawn(process.execPath, [cli, "serve", "--foreground", "--force"], {
    stdio: "inherit",
    env,
  }).on("exit", (code) => process.exit(code ?? 0));
}
