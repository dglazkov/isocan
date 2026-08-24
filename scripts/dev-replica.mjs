#!/usr/bin/env node
/**
 * A replica of a home, for working ON isocan.
 *
 * Two kinds of work in this repo need opposite daemons and always will.
 * Working on the **web app** needs a local home: `npm run dev` binds :4441,
 * serves the pages, and holds the canvases. Working on the **home** — sharing,
 * the door, the replica seam — needs a daemon that is a replica of a real
 * home, and a replica serves no pages at all (the one-origin rule; see
 * docs/design/offline-birth.md, which already accepts the split). That is
 * inherent. What was NOT inherent, until phase 7.5, was that reaching one cost
 * three exported environment variables, a scratch directory and a hand-started
 * daemon in its own terminal.
 *
 * So: one command, and everything it needs is its own.
 *
 *   npm run dev:replica                 # a replica of dev, on :4442
 *   npm run dev:replica -- ls           # any CLI command, against that replica
 *   ISOCAN_DEV_HOME=http://127.0.0.1:4441 npm run dev:replica    # some other home
 *
 * **Its own `ISOCAN_HOME`** (`.dev-replica/` in the checkout, gitignored) is
 * the load-bearing part, not tidiness. Pointing the machine's real `~/.isocan`
 * at a home would demote the developer's own daemon: it would stop serving
 * pages, and every canvas on this laptop would start forwarding its writes
 * somewhere else. The scratch home is self-defence, and it is why this script
 * exists rather than a line in the README telling people to run
 * `isocan home`.
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
 * `isocan.io` would turn `isocan serve` in this checkout into a replica of
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
  // The daemon this script starts is a replica because of THIS, and nothing
  // is written to any config file: a scratch daemon should not leave a
  // setting behind it. `isocan home <url>` is the durable way to say the same
  // thing, and it is what a person pointing their own machine at a home uses.
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
