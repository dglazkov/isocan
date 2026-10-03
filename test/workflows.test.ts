import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withoutComments } from "./source.ts";

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
 *
 * **And an unsharded one cannot finish.** Until 27 Sep 2026 these cases read
 * `release.yml` by name, so when that file split four ways on 13 September
 * and `pr.yml` did not, nothing here could notice: `pr.yml` went on running
 * the whole of `test:ci` on one runner under a 20-minute timeout, last passed
 * at 19m43s, and was cancelled at the timeout after that. So the workflows
 * are found by reading the directory, the way the checkout case above finds
 * them, and every one that runs `test:ci` is held to the same shape.
 */
describe("the sharded gate covers the whole suite", () => {
  /** A workflow runs the gate if any of its steps invokes `npm run test:ci`.
   * Comments are left out, so a file that only talks about the command is not
   * mistaken for one that runs it. */
  const runsGate = files.filter((f) =>
    read(f)
      .split("\n")
      .some((line) => !/^\s*#/.test(line) && /npm run test:ci\b/.test(line)),
  );

  it("finds them at all — a search over nothing always passes", () => {
    // Both are named rather than counted, so the day one of them stops being
    // found is a failure here and not a quiet shrink of the list below.
    expect(runsGate).toEqual(expect.arrayContaining(["pr.yml", "release.yml"]));
  });

  describe.each(runsGate)("%s", (workflow) => {
    const text = read(workflow);

    it("is sharded at all — otherwise the cases below say nothing", () => {
      expect(
        text,
        `${workflow} runs \`npm run test:ci\` whole, on one runner. Shard it the way release.yml does: ` +
          "a `matrix: { shard: [1, 2, 3, 4] }` and `npm run test:ci -- --shard=${{ matrix.shard }}/4`.",
      ).toMatch(/--shard=\$\{\{ matrix\.shard \}\}\/\d+/);
    });

    it("runs as many shards as the command says there are", () => {
      const denominator = Number(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/.exec(text)?.[1]);
      const matrix = /shard: \[([^\]]+)\]/.exec(text)?.[1] ?? "";
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
      expect(text).toMatch(/npm run test:ci -- --shard=/);
    });

    it("lets every shard finish when one fails", () => {
      // One red shard hiding the other three is a report of one failure where
      // there may be four.
      expect(text).toMatch(/fail-fast: false/);
    });
  });

  it("moves the refs only after every shard and every check", () => {
    // `needs` is the whole gate now. Without it the publish job races the
    // suite and `green` means nothing at all.
    expect(read("release.yml")).toMatch(/needs: \[suite, checks\]/);
  });

  it("advances green after the gate but before setting up publication's toolchain", () => {
    const publish = read("release.yml").split("  publish:")[1]!;
    expect(publish).toMatch(/needs: \[suite, checks\]/);
    const green = publish.indexOf("- name: Advance `green`");
    const setup = publish.indexOf("- uses: actions/setup-node@");
    expect(green).toBeGreaterThan(-1);
    expect(setup).toBeGreaterThan(green);
    expect(publish).not.toMatch(/uses:.*suite-setup|uses:.*setup-java|uses:.*setup-gcloud/);
    expect(publish).toContain("npm ci --ignore-scripts");
    expect(publish.indexOf("npm run release")).toBeGreaterThan(setup);
    expect(publish).toContain('${GITHUB_SHA}:refs/heads/green');
    expect(publish).not.toMatch(/git push[^\n]*--force/);
  });

  it("lets verification overlap across commits and serializes only publishers", () => {
    const workflow = read("release.yml").split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
    const [verification, publish] = workflow.split("  publish:");
    expect(verification).not.toMatch(/concurrency:/);
    expect(publish).toMatch(/needs: \[suite, checks\]/);
    expect(publish).toContain("if: github.ref == 'refs/heads/main'");
    expect(publish).toMatch(/concurrency:\s+group: release\s+cancel-in-progress: false\s+queue: max/);
  });

  it("checks fresh source ordering under the publish lock before either ref can move", () => {
    const publish = read("release.yml").split("  publish:")[1]!;
    const order = publish.indexOf('bash scripts/release-order.sh "$GITHUB_SHA" >> "$GITHUB_OUTPUT"');
    expect(order).toBeGreaterThan(-1);
    expect(publish.indexOf("- name: Advance `green`")).toBeGreaterThan(order);
    expect(publish).toMatch(/name: Advance `green`[^\n]*\n\s+if: steps.order.outputs.promote == 'true'/);
    expect(publish).toMatch(/uses: actions\/setup-node@[^\n]*\n\s+if: steps.order.outputs.publish == 'true'/);
    expect(publish).toMatch(/run: npm ci --ignore-scripts\n\s+if: steps.order.outputs.publish == 'true'/);
    expect(publish).toMatch(/name: Build and publish the release branch\n\s+if: steps.order.outputs.publish == 'true'/);
  });

  it("keeps a profile from every shard, including failures", () => {
    for (const workflow of runsGate) {
      const text = read(workflow);
      expect(text).toMatch(/name: Keep test timings\s+if: always\(\)/);
      expect(text).toContain("name: test-profile-${{ matrix.shard }}");
      expect(text).toContain("path: .isocan/test-profile.json");
      expect(text).toContain("include-hidden-files: true");
    }
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

  it("is what the CLI bundle's esbuild target reads", () => {
    const release = withoutComments(readFileSync(`${root}/scripts/release.mjs`, "utf8"));
    expect(release).not.toMatch(/target:\s*["']node\d+["']/);
    expect(release).toMatch(/\.nvmrc/);
    expect(release).toMatch(/target:\s*`node\$\{nodeMajor\}`/);
  });
});

/**
 * **Renovate's lanes, held to what AGENTS.md says they are.**
 *
 * Three details that each look like tidying and each break something: the
 * fixtures' `package.json`s are inputs to the design-lint tests, so bumping
 * them changes what the tests test; `.nvmrc` and the Dockerfile must move in
 * ONE pull request or the major check above fails it; and `config:recommended`
 * carries presets that quietly peel packages out into their own PRs
 * (react, vitest, commander were the first three), which is how one lane
 * becomes nine.
 */
describe("renovate.json keeps its lanes", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const config = JSON.parse(readFileSync(`${root}/renovate.json`, "utf8"));

  it("leaves the test fixtures alone", () => {
    expect(config.ignorePaths).toContain("test/fixtures/**");
  });

  it("moves .nvmrc and the image's Node together", () => {
    const node = config.packageRules.find((r: { groupSlug?: string }) => r.groupSlug === "node");
    expect(node?.matchManagers).toEqual(expect.arrayContaining(["nvm", "dockerfile"]));
    expect(node?.separateMajorMinor).toBe(false);
    expect(node?.automerge).toBe(false);
  });

  it("turns off the presets that split a lane", () => {
    expect(config.ignorePresets).toEqual(
      expect.arrayContaining(["group:monorepos", "group:recommended", "workarounds:groupings"]),
    );
  });

  it("merges by itself only what is not a major", () => {
    const auto = config.packageRules.filter((r: { automerge?: boolean }) => r.automerge);
    for (const rule of auto) expect(rule.matchUpdateTypes ?? []).not.toContain("major");
  });

  it("routes vulnerability alerts into the daily patch-minor lane so transitive lockfile advisories do not wait for Monday", () => {
    expect(config.vulnerabilityAlerts?.enabled).toBe(true);
    expect(config.vulnerabilityAlerts?.groupSlug).toBe("patch-minor");
    expect(config.vulnerabilityAlerts?.automerge).toBe(true);
  });
});

/**
 * **The web app is built once per job, not twice** (cleanup phase 4, DC-5,
 * 27 Sep 2026).
 *
 * The root `prepare` (scripts/prepare.mjs) builds `packages/web/dist` on any
 * install that finds none, which on a fresh runner is every `npm ci`. Three
 * workflows then ran `npm run build` themselves, where it can be seen — the
 * right place for it — and so built the app twice a run. A job that builds
 * the app itself installs with `--ignore-scripts`, as the Dockerfile has
 * since it was written, and for the reason it gives.
 */
describe("the web app is built once per job", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));

  it("is built by prepare on an ordinary install — the premise of the rule below", () => {
    expect(withoutComments(readFileSync(`${root}/scripts/prepare.mjs`, "utf8"))).toMatch(/["']run["'],\s*["']build["']/);
  });

  it("and prepare installs nothing — the install that runs it already did", () => {
    // It ran `npm install --workspaces` for git installs from `main`, which
    // resolve the root's dependencies only; those installs stopped (#47), and
    // in a checkout it was the same install twice (DC-5).
    expect(withoutComments(readFileSync(`${root}/scripts/prepare.mjs`, "utf8"))).not.toMatch(/["']install["']/);
  });

  it("a workflow that runs `npm run build` itself installs with --ignore-scripts", () => {
    const building = files.filter((f) => /^\s*-?\s*run:\s*npm run build\s*$/m.test(read(f)));
    expect(building.length, "no workflow builds the app — a search over nothing always passes").toBeGreaterThan(0);
    const twice = building.filter((f) => /npm ci\b(?![^\n]*--ignore-scripts)/.test(read(f)));
    expect(twice, "these build the web app in `prepare` and again in their own step").toEqual([]);
  });
});

/**
 * **A persona run regenerates the page it made stale, and that page merges
 * with it** (cleanup phase 5, TR-3, 27 Sep 2026).
 *
 * `test/decisions.test.ts` holds `docs/decisions.md` to its generator, and
 * one of the generator's inputs is `docs/reviews/lessons.md` — which is inside
 * the directory a persona run writes and then merges by itself. A night that
 * added a lesson would have landed on `main` with the page one lesson behind:
 * red by morning, from a merge nobody made. So the run rebuilds the page
 * before it commits, and the self-merge admits exactly `docs/reviews/` and
 * that one derived page — a page computed from the reviews is no more a
 * person's judgement than the reviews are.
 *
 * The scope is read out of the workflow and RUN through the same `grep` it
 * uses, rather than restated here: a copy of the pattern would agree with
 * itself and say nothing about the file.
 */
describe("the persona run's self-merge", () => {
  const workflow = read("persona.yml");
  const code = workflow.replace(/^\s*#.*$/gm, "");

  it("rebuilds docs/decisions.md after the personas write and before the commit", () => {
    const took = code.indexOf("scripts/persona-run.mjs");
    const rebuilt = code.indexOf("node scripts/decisions.mjs");
    const committed = code.indexOf("git commit");
    expect(took, "the persona step is gone — this case measures nothing").toBeGreaterThan(-1);
    expect(rebuilt, "the run never regenerates docs/decisions.md").toBeGreaterThan(took);
    expect(committed, "the regeneration comes after the commit, or there is no commit").toBeGreaterThan(rebuilt);
    expect(code, "the regenerated page is not committed with the reviews").toMatch(/git add docs\/reviews docs\/decisions\.md\s*$/m);
  });

  /** The scope the merge step declares, and whether it admits a diff — run
   * through bash and `grep -E`, which is what the workflow runs. */
  const scope = /^\s*SCOPE='([^']+)'\s*$/m.exec(code)?.[1];
  const admits = (paths: string[]): boolean =>
    spawnSync("bash", ["-c", 'printf "%s\\n" "$CHANGED" | grep -Eqv "$SCOPE"'], {
      env: { ...process.env, CHANGED: paths.join("\n"), SCOPE: scope ?? "" },
    }).status !== 0;

  it("declares its scope once, and the merge decision reads it", () => {
    expect(scope, "persona.yml declares no SCOPE for the self-merge").toBeTruthy();
    expect(code).toMatch(/grep -Eqv "\$SCOPE"/);
  });

  it("admits exactly docs/reviews/ and docs/decisions.md", () => {
    expect(admits(["docs/reviews/2026-09-27-acme.md"])).toBe(true);
    expect(admits(["docs/reviews/2026-09-27-acme.md", "docs/reviews/lessons.md", "docs/decisions.md"])).toBe(true);
    expect(admits(["docs/decisions.md"])).toBe(true);
    // And nothing that merely looks like them.
    expect(admits(["docs/reviews/acme.md", "scripts/persona-run.mjs"])).toBe(false);
    expect(admits(["docs/decisions.md.bak"])).toBe(false);
    expect(admits(["docs/decisionsXmd"])).toBe(false);
    expect(admits(["docs/projects/acme/decisions.md"])).toBe(false);
    expect(admits([".agents/personas/acme.md"])).toBe(false);
  });
});

/**
 * **The practice page keeps the night shift's bounds** (practice phase 0,
 * 2 Oct 2026; AGENTS.md, "The night shift's pull requests").
 *
 * It is the grades case: one dated page a night in its own directory. So it
 * touches only `practice/` branches and `docs/practice/`, merges its own PR
 * only after the suite has run on the branch — a PR opened with GITHUB_TOKEN
 * runs no `pr.yml`, so nothing else will have — and drains its older PRs with
 * the shared drain. The scope is run through the same `grep` the workflow
 * runs, as the persona case above does.
 */
describe("the practice run", () => {
  const workflow = read("practice.yml");
  const code = workflow.replace(/^\s*#.*$/gm, "");

  it("writes the page, then commits only docs/practice on a practice/ branch", () => {
    expect(code.indexOf("node scripts/practice.mjs")).toBeGreaterThan(-1);
    expect(code).toMatch(/git checkout -b "practice\/\$DAY"/);
    expect(code).toMatch(/^\s*git add docs\/practice\s*$/m);
    expect(code.match(/git add/g)).toHaveLength(1);
  });

  it("merges itself only after the suite passes on the branch", () => {
    const suite = code.indexOf("if npm test; then");
    const merge = code.indexOf("gh pr merge");
    expect(suite, "the merge step runs no suite").toBeGreaterThan(-1);
    expect(merge).toBeGreaterThan(suite);
  });

  it("drains only its own older PRs, after its own merge", () => {
    expect(code).toMatch(/node scripts\/lib\/drain\.mjs practice\/ docs\/practice\/ --except "practice\/\$DAY"/);
    expect(code.indexOf("scripts/lib/drain.mjs")).toBeGreaterThan(code.indexOf("gh pr merge"));
    // Never another workflow's branches.
    for (const other of ["grades/", "changelog/", "personas/", "loop/", "renovate/"]) expect(code).not.toContain(other);
  });

  const scope = /^\s*SCOPE='([^']+)'\s*$/m.exec(code)?.[1];
  const admits = (paths: string[]): boolean =>
    spawnSync("bash", ["-c", 'printf "%s\\n" "$CHANGED" | grep -Eqv "$SCOPE"'], {
      env: { ...process.env, CHANGED: paths.join("\n"), SCOPE: scope ?? "" },
    }).status !== 0;

  it("admits exactly docs/practice/", () => {
    expect(scope, "practice.yml declares no SCOPE for the self-merge").toBeTruthy();
    expect(code).toMatch(/grep -Eqv "\$SCOPE"/);
    expect(admits(["docs/practice/2026-10-02.md"])).toBe(true);
    expect(admits(["docs/practice/2026-10-02.md", "docs/practice/README.md"])).toBe(true);
    expect(admits(["docs/practice/2026-10-02.md", "scripts/practice.mjs"])).toBe(false);
    expect(admits(["docs/practicex/acme.md"])).toBe(false);
    expect(admits(["docs/grades/2026-10-02.md"])).toBe(false);
  });
});
