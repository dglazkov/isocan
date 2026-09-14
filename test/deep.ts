/**
 * **The deep lane: the tests that spawn real processes per case.**
 *
 * `npm test` ran everything, and everything is 5,160 tests of which a third of
 * the CPU is spent starting processes — a file that spawns
 * `packages/cli/bin/isocan.js`, or `scripts/canvas-board.mjs`, or `npx`, once
 * per case, each spawn a Node start, a daemon knock and a real HTTP round trip.
 * Measured on the full run of 13 September: 519 files, 5,161 tests, 238s of
 * wall clock over 1,939s of CPU. The files below are 1,237s of that CPU, and
 * one of them — `test/canvas-board.test.ts`, 37 cases each blocking a worker on
 * `execFileSync` — is 236s on its own, which is the whole wall clock of a run.
 * They are also, not by coincidence, where every flake this repo has chased
 * lived.
 *
 * So they are their own lane. `npm test` runs the fast one; `npm run test:deep`
 * runs everything, and **CI always runs everything** — `ISOCAN_REQUIRE_DEEP`
 * is the anti-skip switch, the same shape as `ISOCAN_REQUIRE_EMULATOR` beside
 * it: locally the lane skips and says so, on the run that decides a release a
 * skip is a failure. A fast lane CI also took would be a gate with a hole in it.
 *
 * **How this list was chosen, so it can be argued with:** a file is deep when
 * it spawns real child processes per case AND cost ten seconds or more in that
 * run. Both halves matter. `agent-help`, `surface` and `dispatch` spawn the
 * binary too and finish in a second — they are the guards most worth keeping in
 * the fast lane. And `home-link`, `daemon` and `cloud-desk` are slow for a
 * different reason, in-process daemons and an emulator, which is work the fast
 * lane should still do: it is cheaper per second and it is where the product's
 * own races live.
 *
 * **The honest limit:** this is a list, and a list ages. A fast file that grows
 * a daemon will not add itself, and a deep file that gets quick will not leave.
 * The times below are evidence from one run, not budgets; `npm run test:deep`
 * prints each file's time, so the answer is in the run that already has to
 * happen. Nothing here watches for drift by itself.
 *
 * **The first version of this list was wrong**, and worth recording: it was
 * built by matching test-file BASENAMES against a run's output, so
 * `packages/cli/test/board.test.ts` was handed `test/canvas-board.test.ts`'s
 * 95 seconds and the real long pole was not in the lane at all. The fast lane
 * saved a third of the CPU and nine seconds of wall clock. Rebuilt from exact
 * paths.
 */
export interface DeepFile {
  /** Path from the repo root, as vitest names it. */
  file: string;
  /** Seconds in the 13 Sep full run — the evidence, not a budget. */
  secs: number;
}

export const DEEP: readonly DeepFile[] = [
  { file: "test/canvas-board.test.ts", secs: 236 },
  { file: "packages/cli/test/rc.test.ts", secs: 62 },
  { file: "packages/cli/test/direct.test.ts", secs: 58 },
  { file: "packages/cli/test/session-identity.test.ts", secs: 57 },
  { file: "packages/cli/test/share.test.ts", secs: 55 },
  { file: "packages/cli/test/rc-sheep-withdrawal.test.ts", secs: 52 },
  { file: "packages/cli/test/shelf.test.ts", secs: 51 },
  { file: "packages/cli/test/space.test.ts", secs: 48 },
  { file: "packages/cli/test/wait.test.ts", secs: 42 },
  { file: "packages/cli/test/home.test.ts", secs: 41 },
  { file: "packages/cli/test/ground.test.ts", secs: 38 },
  { file: "packages/cli/test/one-hour.test.ts", secs: 35 },
  { file: "packages/cli/test/park.test.ts", secs: 32 },
  { file: "packages/cli/test/setup-npx.test.ts", secs: 29 },
  { file: "packages/modules/design-competition/test/bout.test.ts", secs: 29 },
  { file: "packages/cli/test/restart.test.ts", secs: 28 },
  { file: "packages/cli/test/binding.test.ts", secs: 27 },
  { file: "packages/cli/test/rc-sheep.test.ts", secs: 25 },
  { file: "packages/cli/test/identity.test.ts", secs: 24 },
  { file: "packages/cli/test/group.test.ts", secs: 23 },
  { file: "packages/cli/test/daemon-takeover.test.ts", secs: 23 },
  { file: "packages/cli/test/area.test.ts", secs: 22 },
  { file: "packages/cli/test/personal-context.test.ts", secs: 19 },
  { file: "packages/cli/test/dualface.test.ts", secs: 18 },
  { file: "packages/cli/test/place.test.ts", secs: 18 },
  { file: "packages/cli/test/upgrade-notice.test.ts", secs: 18 },
  { file: "packages/cli/test/wait-cursor.test.ts", secs: 18 },
  { file: "packages/cli/test/export.test.ts", secs: 17 },
  { file: "packages/cli/test/operator.test.ts", secs: 17 },
  { file: "packages/cli/test/deckexport.test.ts", secs: 17 },
  { file: "packages/cli/test/sprint.test.ts", secs: 14 },
  { file: "packages/cli/test/desk.test.ts", secs: 12 },
  { file: "packages/cli/test/claiming.test.ts", secs: 12 },
  { file: "packages/cli/test/migration.test.ts", secs: 11 },
  { file: "packages/cli/test/documents.test.ts", secs: 11 },
];

/**
 * **Naming a file on the command line runs it, deep or not.**
 *
 * Without this, `npx vitest run packages/cli/test/pass.test.ts` on a deep file
 * printed a green "1 passed" for a file the exclusion had removed — a run that
 * did nothing, reported as a run that worked, which is the shape of failure
 * this repo has caught four times in a week. A filtered run is a person asking
 * for one thing by name; the lane has no business answering.
 */
export const filteredRun = (argv: readonly string[] = process.argv.slice(2)): boolean =>
  argv.some((arg) => !arg.startsWith("-") && (arg.endsWith(".test.ts") || arg.includes("/")));

/**
 * Is this run the deep one? `ISOCAN_DEEP` is what a person types
 * (`npm run test:deep`); `ISOCAN_REQUIRE_DEEP` is what CI sets, and it also
 * turns a skip into a failure — so setting it must include the lane, or the
 * anti-skip switch would be switching off the thing it protects.
 */
export const runningDeep = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env["ISOCAN_DEEP"] ?? env["ISOCAN_REQUIRE_DEEP"]) || filteredRun();

/** What `npm test` leaves out, and roughly what it buys — the sentence the
 *  fast lane prints, so a green run never quietly means "most of it passed". */
export function skippedLine(): string {
  const mins = Math.round(DEEP.reduce((a, d) => a + d.secs, 0) / 60);
  return (
    `deep lane not run: ${DEEP.length} files that spawn real processes ` +
    `(~${mins} minutes of CPU). Run them with \`npm run test:deep\`; CI always does.`
  );
}
