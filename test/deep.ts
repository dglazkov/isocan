import { withoutComments } from "./source.ts";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **The deep lane: the tests that spawn real processes per case.**
 *
 * `npm test` ran everything, and everything is 5,218 tests of which most of the
 * CPU is spent starting processes — a file that spawns
 * `packages/cli/bin/isocan.js`, or `scripts/canvas-board.mjs`, or `npx`, once
 * per case, each spawn a Node start, a daemon knock and a real HTTP round trip.
 * Measured on the full run of 13 September: 531 files, 5,218 tests, 185s of
 * wall clock over 2,153s of CPU. The files below are most of that CPU. They
 * are also, not by coincidence, where every flake this repo has chased lived.
 *
 * **The seconds below moved once for a reason worth keeping.** Until 13
 * September `test/canvas-board.test.ts` was 238s — the whole wall clock of a
 * run, in one file — and the lane was built around it. It was not the board:
 * `eslint .` had no `ignores`, so it walked `.claude/worktrees/`, twenty other
 * checkouts of this repository, 6,056 files. One line in `eslint.config.js`
 * took the lint from 50s to 1.5s, that file from 238s to 73s, and the whole
 * deep run from 246s to 185s. A long pole is worth asking about before it is
 * worth planning around.
 *
 * So they are their own lane. `npm test` runs the fast one; `npm run test:deep`
 * runs everything, and **CI always runs everything** — `ISOCAN_REQUIRE_DEEP`
 * is the anti-skip switch, declared with the others in `scripts/switches.mjs`
 * and set by `npm run test:ci`, which is the command both workflows run:
 * locally the lane skips and says so, on the run that decides a release a skip
 * is a failure. A fast lane CI also took would be a gate with a hole in it.
 *
 * **How this list was chosen, so it can be argued with:** a file is deep when
 * it walks the CLI — spawns a real child process against the binary or the
 * board script — AND cost ten seconds or more in that run. Both halves matter.
 * `agent-help`, `browse` and `managed` walk it too and finish in seconds; they
 * are the guards most worth keeping in the fast lane. And `home-link`,
 * `daemon` and `cloud-desk` are slow for a different reason, in-process
 * daemons and an emulator, which is work the fast lane should still do: it is
 * cheaper per second and it is where the product's own races live.
 *
 * **Both halves of that rule are now guarded, which is the change of 13
 * September.** `FAST_SPAWNERS` below is the other side of the list: every file
 * that walks the CLI and is deliberately *not* deep, with what it cost and
 * why. `walksBinary` reads a file's source and decides the walking half for
 * itself, and `test/deeplist.test.ts` fails when the reading and the lists
 * disagree — a walker in neither list, a walker in both, a name for a file
 * that is gone, a fast entry that grew past the ten-second line. Before this,
 * the guards only ran one way: everything named deep had to deserve it, and a
 * fast file that grew a daemon could stay quiet forever. Silence is no longer
 * a lane.
 *
 * **It caught three the first time it ran, and one of them is in the paragraph
 * above.** That paragraph used to offer `dispatch` as the example of a cheap
 * walker, "spawns the binary too and finishes in a second". `dispatch` is 77
 * seconds — the second most expensive file in the repository — and `pass` is
 * 52 and `acp` is 28, and all three sat in the fast lane while a comment said
 * the opposite. `migration` went the other way: recorded at 11s, measured at
 * 9.4, so it leaves. The lists here are the corrected ones; the prose was
 * wrong for a week and nothing could tell.
 *
 * **The honest limit that remains:** the ten-second half is not in the source,
 * so no guard can read it. The seconds below are evidence from one run, not
 * budgets, and a file that doubles will not move itself. `npm run test:deep`
 * prints each file's time, so the answer is in the run that already has to
 * happen — but somebody still has to look.
 *
 * **The first version of this list was wrong**, and worth recording: it was
 * built by matching test-file BASENAMES against a run's output, so
 * `packages/cli/test/board.test.ts` was handed `test/canvas-board.test.ts`'s
 * 95 seconds and the real long pole was not in the lane at all. The fast lane
 * saved a third of the CPU and nine seconds of wall clock. Rebuilt from exact
 * paths, and re-measured whole on 13 September after the lint walk was fixed;
 * every file kept its lane, and `dispatch` is the long pole now.
 */
export interface DeepFile {
  /** Path from the repo root, as vitest names it. */
  file: string;
  /** Seconds in the 13 Sep full run — the evidence, not a budget. */
  secs: number;
}

export const DEEP: readonly DeepFile[] = [
  { file: "packages/cli/test/design-system.test.ts", secs: 17.5 },
  { file: "packages/cli/test/design-decision.test.ts", secs: 10.4 },
  { file: "packages/cli/test/design-review.test.ts", secs: 13.5 },
  { file: "test/questionnaire-cli.test.ts", secs: 11.1 },
  { file: "packages/cli/test/beside.test.ts", secs: 17.3 },
  { file: "test/canvas-board.test.ts", secs: 73 },
  { file: "packages/cli/test/dispatch.test.ts", secs: 77 },
  { file: "packages/cli/test/rc.test.ts", secs: 66 },
  { file: "packages/cli/test/direct.test.ts", secs: 63 },
  { file: "packages/cli/test/prune.test.ts", secs: 63 },
  { file: "packages/cli/test/session-identity.test.ts", secs: 64 },
  { file: "packages/cli/test/shelf.test.ts", secs: 59 },
  { file: "packages/cli/test/pass.test.ts", secs: 56 },
  { file: "packages/cli/test/share.test.ts", secs: 55 },
  { file: "packages/cli/test/space.test.ts", secs: 51 },
  { file: "packages/cli/test/home.test.ts", secs: 51 },
  { file: "packages/cli/test/wait.test.ts", secs: 44 },
  { file: "packages/cli/test/ground.test.ts", secs: 46 },
  { file: "packages/cli/test/one-hour.test.ts", secs: 29 },
  { file: "packages/cli/test/park.test.ts", secs: 31 },
  { file: "packages/modules/design-competition/test/bout.test.ts", secs: 24 },
  { file: "packages/cli/test/acp.test.ts", secs: 25 },
  { file: "packages/cli/test/setup-npx.test.ts", secs: 39 },
  { file: "packages/cli/test/binding.test.ts", secs: 24 },
  { file: "packages/cli/test/restart.test.ts", secs: 31 },
  { file: "packages/cli/test/identity.test.ts", secs: 23 },
  { file: "packages/cli/test/daemon-takeover.test.ts", secs: 22 },
  { file: "packages/cli/test/dualface.test.ts", secs: 20 },
  { file: "packages/cli/test/group.test.ts", secs: 21 },
  { file: "packages/cli/test/export.test.ts", secs: 17 },
  { file: "packages/cli/test/personal-context.test.ts", secs: 17 },
  { file: "packages/cli/test/context-pin.test.ts", secs: 23 },
  { file: "packages/modules/anatomy/test/cli.test.ts", secs: 19 },
  { file: "packages/cli/test/area.test.ts", secs: 19 },
  { file: "packages/cli/test/wait-cursor.test.ts", secs: 18 },
  { file: "packages/cli/test/operator.test.ts", secs: 19 },
  { file: "packages/cli/test/upgrade-notice.test.ts", secs: 17 },
  { file: "packages/cli/test/place.test.ts", secs: 15 },
  { file: "packages/cli/test/deckexport.test.ts", secs: 15 },
  { file: "packages/cli/test/agent-key.test.ts", secs: 22 },
  { file: "packages/cli/test/claiming.test.ts", secs: 12 },
  { file: "packages/cli/test/desk.test.ts", secs: 11 },
  { file: "packages/cli/test/documents.test.ts", secs: 11 },
  { file: "packages/cli/test/sprint.test.ts", secs: 10 },
  // 15 Sep: it was 7.5s and in the fast lane while the phase 0 proof was the
  // whole file. Phase 1's `bench join` case added 4.2s of its own — three
  // canvases, an enrolment and two joins against the real binary — and 12.9s
  // is past the line the rule states, so it moves rather than the rule
  // bending for it. Phase 3's case added another 9.4s: a walk with no
  // personal canvas, two verbs enrolling, and a withdrawal from two canvases
  // that must leave the row standing.
  { file: "packages/cli/test/bench.test.ts", secs: 22.3 },
  { file: "packages/cli/test/board.test.ts", secs: 42.6 },
  // 23 Sep: five cases, one daemon, ~25 spawns — a text node restyled,
  // re-worded and fitted over the real binary on both canvas modes.
  { file: "packages/cli/test/text-refit.test.ts", secs: 21.7 },
  // 24 Sep: four cases, one daemon, ~20 spawns — the web's "Use as the
  // design system" op held equal to `design use` and `design set` over the
  // real binary.
  { file: "packages/web/test/designuse.test.ts", secs: 19.8 },
  // 24 Sep: two cases, one daemon, ~12 spawns — the chip's ✅/❌ ops held
  // equal to `docket answer` over the real binary (#206 D7).
  { file: "packages/web/test/docket.test.ts", secs: 10.3 },
  { file: "packages/voice-agent/test/voice-harness.test.ts", secs: 61 },
];

/**
 * **The walkers that stay in the fast lane, and why each one is cheap.**
 *
 * Every one of these spawns the CLI, so the rule's first half is satisfied and
 * only the ten-second line keeps it here. Written out rather than left to
 * silence: a guard that only checks the deep list can tell you nothing about a
 * file that grew, and this is the list that makes the question answerable in
 * both directions. An entry that passes ten seconds fails
 * `test/deeplist.test.ts` and has to be moved or argued with.
 *
 * They are worth keeping fast for their own sake, too. These are the guards
 * that catch a broken verb in the ordinary run — `agent-help` is the surface's
 * own check, `setup` is the first thing a new person does, `browse` and
 * `rehome` are one command each. A fast lane with no walk in it would be a
 * lane that cannot tell you the binary starts.
 */
export interface FastSpawner {
  /** Path from the repo root. */
  file: string;
  /** Seconds in the same 13 Sep run — under ten, and the guard enforces it. */
  secs: number;
  /** Why it is cheap, in a phrase. */
  why: string;
}

export const FAST_SPAWNERS: readonly FastSpawner[] = [
  { file: "test/design-partner-tools.test.ts", secs: 2.118, why: "one actual stdio MCP child calls the CLI and owned Chrome; remaining boundary checks stay in process" },
  { file: "packages/cli/test/design-craft.test.ts", secs: 6.7, why: "one actual CLI packet/export/check/reconcile walk on a shared synthetic daemon; measured 15 September" },
  { file: "packages/cli/test/design-request.test.ts", secs: 9.8, why: "one real-home lifecycle and exact-reference walk; measured 14 September, near the ten-second line" },
  { file: "packages/cli/test/migration.test.ts", secs: 9.8, why: "left the deep lane on the measurement that built this list — recorded at 11s, measured at 9.4" },
  { file: "packages/cli/test/correspondence.test.ts", secs: 9.9, why: "two cases, two walks — and the closest file to the line, so the one to watch" },
  { file: "packages/cli/test/grid.test.ts", secs: 9.4, why: "a single case that walks once" },
  { file: "packages/cli/test/tools.test.ts", secs: 7.7, why: "three cases sharing one daemon" },
  { file: "packages/cli/test/panels.test.ts", secs: 9.3, why: "three cases, the tools file's shape; 18 September, and NOT measured on the run that built this list — it is 16.4s on the machine where tools.test.ts is 13.6s, scaled by that anchor to the 7.7 recorded there. The closest file to the line after correspondence, so it is one to re-measure rather than trust" },
  { file: "packages/web/test/choose.test.ts", secs: 5.4, why: "two cases on one daemon, nine spawns: the item menu's \"Choose this variation\" held equal to `isocan choose`, and one undo of it" },
  { file: "test/ratchetroot.test.ts", secs: 1.5, why: "spawns the binary four times over temp directories — no daemon, no canvas, just files on disk" },
  { file: "packages/cli/test/setup.test.ts", secs: 7.8, why: "five cases, and the first thing a new person runs — worth keeping in the ordinary run" },
  { file: "packages/cli/test/rehome.test.ts", secs: 7.3, why: "eight cases, one command each" },
  { file: "packages/cli/test/runtimemodules.test.ts", secs: 6.0, why: "three cases" },
  { file: "packages/cli/test/heatmap.test.ts", secs: 5.9, why: "a single case" },
  { file: "packages/cli/test/ended.test.ts", secs: 5.3, why: "a single case" },
  { file: "packages/cli/test/operator-revoke.test.ts", secs: 4.0, why: "two cases" },
  { file: "packages/cli/test/second-device.test.ts", secs: 3.7, why: "a single case" },
  { file: "packages/cli/test/managed.test.ts", secs: 6.0, why: "21 cases and under four seconds, because only the two that need a server spawn one" },
  { file: "packages/cli/test/operator-end.test.ts", secs: 3.0, why: "a single case" },
  { file: "packages/cli/test/browse.test.ts", secs: 2.1, why: "two cases, one command each" },
  { file: "packages/cli/test/agent-help.test.ts", secs: 1.6, why: "four cases; the guard that a verb reached the agent guide, and the one this file's header has always held up as the cheap walk" },
  { file: "test/roadmap.test.ts", secs: 1.7, why: "spawns `doc status` three times, not once per document — deliberately, and it says so" },
  { file: "test/deeplist.test.ts", secs: 0.2, why: "the guard itself: it spawns `git ls-files` to enumerate, and its own cases quote the strings it looks for — it caught itself on the first run, which is how sheep's `rings.test.ts` announced itself too" },
  { file: "packages/cli/test/harnesses.test.ts", secs: 0.3, why: "does not walk at all: it asserts an adapter's command IS the string \"npx\", and the reading below sees the word" },
  { file: "packages/voice-agent/test/voice-model.test.ts", secs: 9.8, why: "nineteen cases over one daemon, and the closest file to the line: only the model verbs it cannot drive from the page walk the CLI at all" },
  { file: "test/cli-bundle.test.ts", secs: 4.4, why: "one esbuild build shared by both cases, then five spawns of the bundle that touch no daemon and no canvas — measured 18 September" },
];

/**
 * Source with its prose taken out, so that a file writing *about* a walk is
 * not read as taking one. Block comments go whole; of line comments only
 * those that are the whole line, so a `https://…` inside a string survives.
 *
 * Learned the way guards usually learn it: this file's guard caught itself on the first run, because its own header
 * named the function it was looking for. Three files here name the binary
 * only in their comments — `packages/server/test/build.test.ts`,
 * `packages/web/test/shot.test.ts` and `test/skills.test.ts` — and stripping
 * prose is what keeps them out. It does not save `test/deeplist.test.ts`,
 * whose cases quote those strings in code; that file is declared in
 * `FAST_SPAWNERS`, which is the honest answer rather than an exception.
 */
export const withoutProse = withoutComments;

/** The `./` imports of a file — a fixture beside it counts as part of it. */
export function siblingsOf(source: string): string[] {
  const found: string[] = [];
  for (const match of withoutProse(source).matchAll(/from "(\.\/[^"]+)"/g)) {
    const rel = match[1] ?? "";
    found.push(rel, rel.replace(/\.js$/, ".ts"));
  }
  return found;
}

/**
 * **Does this file walk the CLI?** Read from the source rather than declared,
 * so the lists above can be checked against something that is not themselves.
 *
 * Two halves, and both are needed. A *target* — the binary, the board script,
 * `npx` — because spawning `git` is not what makes these files expensive. And
 * a *spawn call*, because half the repository names `bin/isocan.js` in a
 * string it never runs (`packaging` asserts the `bin` field; `onpath` and
 * `upgrade` use `npx` as the name of an install kind). Either half alone gives
 * a list a third too long.
 *
 * `rc.test.ts` is why siblings count: it became three files over two fixture
 * modules when it was de-flaked, and reaches the binary through one of them.
 */
export function walksBinary(source: string, siblings: readonly string[] = []): boolean {
  const code = [withoutProse(source), ...siblings.map(withoutProse)].join("\n");
  // `CLI_BUNDLE` joins the binary and the board script on 18 Sep: the release
  // CLI is `packages/cli/dist/isocan.mjs` now, so a file that spawns THAT is
  // a walker exactly as much as one spawning `bin/isocan.js`, and naming only
  // the old path would have left `test/cli-bundle.test.ts` invisible
  // to this reading — the silence the lists exist to remove.
  const target = /bin\/isocan\.js|CLI_BUNDLE|dist\/isocan\.mjs|canvas-board\.mjs|\bnpx\b/.test(code);
  const spawns = /\b(spawn|spawnSync|execFile|execFileSync|execSync|fork)\s*\(/.test(code);
  // The native study exposes the real CLI through its explicit stdio MCP
  // process. All three facts are needed; generic SDK clients are not CLI walkers.
  const studyMcp = /design-partner-mcp\.mjs/.test(code) && /new\s+StdioClientTransport\s*\(/.test(code) && /callTool\s*\(\s*\{\s*name:\s*["']cli["']/.test(code);
  return target && spawns || studyMcp;
}

/** The lane a file is declared to be in, or `undefined` when it is in neither. */
export function declaredLane(file: string): "deep" | "fast" | undefined {
  if (DEEP.some((d) => d.file === file)) return "deep";
  if (FAST_SPAWNERS.some((f) => f.file === file)) return "fast";
  return undefined;
}

/** What each file declares and what its source says, so a guard can compare them. */
export function audit(root: string, files: readonly string[]) {
  const read = (file: string): string => {
    try {
      return readFileSync(path.join(root, file), "utf8");
    } catch {
      return "";
    }
  };
  return files.map((file) => {
    const source = read(file);
    const siblings = siblingsOf(source).map((rel) => read(path.join(path.dirname(file), rel)));
    return { file, declared: declaredLane(file), walks: walksBinary(source, siblings) };
  });
}

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
 * (`npm run test:deep`); `ISOCAN_REQUIRE_DEEP` is what `npm run test:ci` sets
 * from `scripts/switches.mjs`, and it also turns a skip into a failure — so
 * setting it must include the lane, or the anti-skip switch would be switching
 * off the thing it protects.
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
