import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../.github/workflows", import.meta.url));
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const read = (f: string) => readFileSync(`${dir}/${f}`, "utf8");

/**
 * **A workflow that runs the suite must check out the history the suite
 * reads.**
 *
 * `actions/checkout` defaults to `fetch-depth: 1`, and the suite is not a
 * pure function of the working tree: `changelog-day.mjs` asks `git log` what
 * landed on a day, and `changelog.test.ts` drives it against the earliest
 * entry. On a depth-1 clone that day has no commits in view, so the generator
 * answers "nothing landed" where the test expects "already written".
 *
 * This is written down because of how it happened. `release.yml` has carried
 * `fetch-depth: 0` since it was written — for a completely unrelated reason,
 * stated beside it: it pushes a release commit naming two parents by sha, and
 * a shallow clone cannot push a history it does not have. When `pr.yml` was
 * added on 6 September it shared everything the two files have in common
 * through a composite action, deliberately, with a comment saying the drift
 * that matters is this file falling behind that one. **A checkout cannot live
 * in a composite action**, so it was the one step that could not be shared —
 * and the reason written next to it in `release.yml` was not the reason the
 * suite needs it, so copying it did not look necessary. The suite went red on
 * the first pull request that ran it.
 *
 * The general shape, and the reason this is a test rather than a third
 * comment: **two files kept in step by a comment are two files that will
 * drift.** The bit that is shared is shared; the bit that cannot be is
 * asserted.
 */
describe("every workflow that runs the suite", () => {
  /** A workflow runs the suite if it invokes vitest, directly or through the
   * npm script that does. Found rather than listed, so a third one added next
   * month is covered without anybody remembering this file. */
  const runsSuite = files.filter((f) => /vitest|npm (run )?test\b/.test(read(f)));

  it("finds them at all — a search over nothing always passes", () => {
    expect(runsSuite.length, "no workflow appears to run the suite").toBeGreaterThan(0);
  });

  it("checks out the whole history, because the suite reads it", () => {
    const shallow = runsSuite.filter((f) => !/fetch-depth:\s*0/.test(read(f)));
    expect(
      shallow,
      "these run the suite on a shallow checkout. `actions/checkout` defaults to depth 1, and " +
        "`changelog.test.ts` drives `changelog-day.mjs`, which asks git log what landed on a day — " +
        "a day a depth-1 clone cannot see. Add `with: { fetch-depth: 0 }` to the checkout.",
    ).toEqual([]);
  });
});

/**
 * **A sharded gate can leave a quarter of the suite unrun and still be green.**
 *
 * `release.yml` splits the suite four ways because it was 82% of a release
 * run. `vitest --shard=N/M` runs the Nth of M pieces, and the two numbers live
 * in two places: `M` in the command, `N` in the job matrix. Add a fifth shard
 * to the matrix and forget the denominator and shard 5 runs nothing while
 * shards 1–4 still cover everything — harmless. Take one AWAY and leave the
 * denominator at 4, and a quarter of the suite is never run by anybody, every
 * job passes, and `green` advances on a commit nothing tested.
 *
 * That is the same shape as every other hole this repo has found: not a
 * failure, an absence reported as a success. So the two numbers are checked
 * against each other.
 */
describe("the sharded gate covers the whole suite", () => {
  const release = read("release.yml");

  it("is sharded at all — otherwise the cases below say nothing", () => {
    expect(release).toMatch(/--shard=\$\{\{ matrix\.shard \}\}\/\d+/);
  });

  it("runs as many shards as the command says there are", () => {
    const denominator = Number(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/.exec(release)?.[1]);
    const matrix = /shard: \[([^\]]+)\]/.exec(release)?.[1] ?? "";
    const shards = matrix.split(",").map((one) => Number(one.trim()));
    expect(shards.length, `the matrix runs ${shards.length} shards of ${denominator}`).toBe(denominator);
    // And they are 1..M exactly: a duplicate would double-run one piece while
    // another went missing, which the count alone cannot see.
    expect([...shards].sort((a, b) => a - b)).toEqual(
      Array.from({ length: denominator }, (_, index) => index + 1),
    );
  });

  it("shards the command that sets the anti-skip switches, not bare vitest", () => {
    // `npm run test:ci` is what turns a skip into a failure. A shard that
    // called `vitest` directly would run a quarter of the suite AND let the
    // emulator, bundle and deep suites skip themselves inside it.
    expect(release).toMatch(/npm run test:ci -- --shard=/);
  });

  it("moves the refs only after every shard and every check", () => {
    // `needs` is the whole gate now. Without it the publish job races the
    // suite and `green` means nothing at all.
    expect(release).toMatch(/needs: \[suite, checks\]/);
    expect(release).toMatch(/fail-fast: false/);
  });
});

/**
 * **One Node, named once.**
 *
 * Until 22 Sep 2026 the suite ran on 24 (the shared setup action), five
 * nightly workflows on 22, the image on `node:24-slim`, and laptops on
 * whatever fnm last installed — one of them on 24.5.0, below the 24.15 that
 * jsdom 30 asks for. Nobody chose that spread; each file was right the day it
 * was written. `.nvmrc` is now the version, and fnm, nvm and `setup-node`
 * all read it. The Dockerfile cannot read it, so it is held to the same
 * major, which is the promise `node:24-slim` makes.
 */
describe("every Node comes from .nvmrc", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const nvmrc = readFileSync(`${root}/.nvmrc`, "utf8").trim();
  const action = readFileSync(`${root}/.github/actions/suite-setup/action.yml`, "utf8");
  const sources = [...files.map((f) => [f, read(f)] as const), ["actions/suite-setup", action] as const];

  it("names an exact version", () => {
    expect(nvmrc).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is what every setup-node step reads", () => {
    const setups = sources.filter(([, text]) => /actions\/setup-node@/.test(text));
    expect(setups.length, "no setup-node step found — a search over nothing always passes").toBeGreaterThan(0);
    const pinned = setups.filter(([, text]) => /node-version:/.test(text) || !/node-version-file: \.nvmrc/.test(text));
    expect(
      pinned.map(([name]) => name),
      "these choose their own Node. Use `node-version-file: .nvmrc` so CI runs what a laptop runs.",
    ).toEqual([]);
  });

  it("is the image's major too", () => {
    const docker = readFileSync(`${root}/Dockerfile`, "utf8");
    const majors = [...docker.matchAll(/^FROM node:(\d+)/gm)].map((m) => m[1]);
    expect(majors.length).toBeGreaterThan(0);
    expect(new Set(majors), `the Dockerfile's node images should be ${nvmrc.split(".")[0]}, the major in .nvmrc`).toEqual(
      new Set([nvmrc.split(".")[0]]),
    );
  });
});
