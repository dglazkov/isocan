import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The repo is the package: `npx github:dglazkov/isocan#release` and
 * `npm i -g github:dglazkov/isocan#release` install this tree directly, no
 * registry involved (#42). Everything that makes that work was learned the
 * hard way — this file remembers it.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (rel: string) =>
  JSON.parse(await fs.readFile(path.join(repo, rel), "utf8"));

describe("installable straight from git", () => {
  it("the root package is the CLI: a bin, and the deps a git install must resolve", async () => {
    const pkg = await readJson("package.json");
    expect(pkg.bin?.isocan).toBe("packages/cli/bin/isocan.js");
    // A git install resolves the ROOT package's dependencies only, so what
    // the CLI needs at runtime has to be listed here too.
    const cli = await readJson("packages/cli/package.json");
    const server = await readJson("packages/server/package.json");
    for (const dep of Object.keys({ ...cli.dependencies, ...server.dependencies })) {
      if (dep.startsWith("@isocan/")) continue; // resolved by path, see below
      expect(pkg.dependencies, `${dep} is missing from the root package`).toHaveProperty(dep);
    }
  });

  it("keeps the cloud backing's 43 MiB out of the CLI install, in both directions", async () => {
    // The two-way guard, and the direction that matters is the SECOND one.
    // The test above says "what a workspace needs at runtime must be in the
    // root manifest too", and @google-cloud/firestore and @google-cloud/storage
    // are the first dependencies that must NOT be — 156 packages and ~43 MiB
    // onto every `npm i -g github:dglazkov/isocan#release`, for a daemon that
    // runs FileStore and never loads a line of it. So they live in a fourth
    // workspace nobody installs, `daemon.ts` reaches it by dynamic import, and
    // both halves of that arrangement are asserted here rather than tolerated
    // as an exception.
    const pkg = await readJson("package.json");
    const cloudstore = await readJson("packages/cloudstore/package.json");
    const cloudDeps = Object.keys(cloudstore.dependencies ?? {}).filter((dep) =>
      dep.startsWith("@google-cloud/"),
    );
    expect(cloudDeps.sort()).toEqual(["@google-cloud/firestore", "@google-cloud/storage"]);

    for (const manifest of ["package.json", "packages/cli/package.json", "packages/server/package.json"]) {
      const declared = Object.keys({
        ...(await readJson(manifest)).dependencies,
        ...(await readJson(manifest)).devDependencies,
      });
      for (const dep of declared) {
        expect(dep.startsWith("@google-cloud/"), `${manifest} hoists ${dep}`).toBe(false);
      }
    }
    // And nothing an installed CLI can resolve names the cloud workspace: the
    // loader maps two packages by path, and this is not one of them.
    expect(Object.keys(pkg.dependencies)).not.toContain("@isocan/cloudstore");
    const loader = await fs.readFile(
      path.join(repo, "packages/cli/bin/workspace-loader.mjs"),
      "utf8",
    );
    expect(loader).not.toContain("@isocan/cloudstore");
  });

  it("never depends on its own workspaces — link deps break every reinstall", async () => {
    // `"@isocan/core": "file:packages/core"` reads as harmless and installs
    // fine ONCE. Reinstalling over it leaves npm rebuilding a link whose
    // target it just deleted: "Cannot destructure property 'package' of
    // 'node.target'". bin/workspace-loader.mjs resolves them by path instead.
    const pkg = await readJson("package.json");
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(declared.filter((name) => name.startsWith("@isocan/"))).toEqual([]);

    const loader = await fs.readFile(
      path.join(repo, "packages/cli/bin/workspace-loader.mjs"),
      "utf8",
    );
    for (const name of ["@isocan/core", "@isocan/server"]) expect(loader).toContain(name);
  });

  it("hands out an install spec with the branch on it — the bare repo installs nothing", async () => {
    // `npm i -g github:dglazkov/isocan` (no branch) leaves an EMPTY directory
    // and a dangling `isocan` on the PATH: npm's git installer sees `prepare`
    // (or `workspaces`, or `build`) on main, runs a nested install inside its
    // staging clone, and that install inherits the outer `-g`. Every spec we
    // print, run, or document therefore ends in #release.
    //
    // Phase 8 moved the constant into `@isocan/core`: the command Scene 5
    // hands a person is `npx <spec> setup <address>#<pass>`, printed by the
    // CLI's `isocan pass` AND by the web app's "Work from your terminal…"
    // dialog, so the spec and the address are now one string with one builder
    // (`setupCommand`). The assertion moved with it — and grew a forcing
    // function, because a second copy in `packages/web/src` is exactly the
    // branchless spec this test exists to prevent and is the one place the
    // doc sweep below could never see.
    const address = await fs.readFile(path.join(repo, "packages/core/src/address.ts"), "utf8");
    expect(address).toContain('const INSTALL_SPEC = "github:dglazkov/isocan#release"');
    const strays: string[] = [];
    for (const file of await sourceFiles(path.join(repo, "packages"))) {
      if (file.endsWith(path.join("core", "src", "address.ts"))) continue; // the definition
      const text = await fs.readFile(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (line.includes("github:dglazkov/isocan")) {
          strays.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      strays,
      `import INSTALL_SPEC/setupCommand from @isocan/core instead:\n${strays.join("\n")}`,
    ).toEqual([]);

    for (const doc of ["README.md", ".agents/skills/isocan-collab/SKILL.md"]) {
      const text = await fs.readFile(path.join(repo, doc), "utf8");
      const specs = text.match(/github:dglazkov\/isocan[^\s`.,)]*/g) ?? [];
      expect(specs.length, `${doc} should say how to install`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec, `${doc} names a branchless install spec`).toContain("#release");
      }
    }
  });

  it("the release branch's manifest keeps none of the keys npm would 'prepare'", async () => {
    // pacote/lib/git.js: `workspaces` or any of these scripts and npm decides
    // the package must be built before use — which is where the empty install
    // comes from. main needs `prepare` and `workspaces`; the branch we hand
    // out must have shed both, and that is scripts/release.mjs's one job.
    const { releaseManifest, PREPARATION_KEYS } = await import("../scripts/release.mjs");
    const pkg = await readJson("package.json");
    const released: Record<string, any> = releaseManifest(pkg, "abc1234");
    for (const key of PREPARATION_KEYS) {
      const [outer, inner] = key.split(".");
      const value = inner ? released[outer!]?.[inner] : released[outer!];
      expect(value, `${key} survived into the release manifest`).toBeUndefined();
    }
    // What an install DOES need: the bin it links, and the deps it resolves.
    expect(released.bin).toEqual(pkg.bin);
    expect(released.dependencies).toEqual(pkg.dependencies);
    expect(released["//"]).toContain("abc1234");
  });

  it("releases from CI on every commit, with the history a push needs", async () => {
    // Nobody remembers to release by hand, and an unreleased commit is one
    // nobody can install. Two things the workflow cannot get wrong: full
    // history (the release commit names two parents by sha, and a shallow
    // clone cannot push what it does not have), and one concurrency group
    // (the branch is pushed, never forced — two runs racing would leave the
    // second non-fast-forward).
    const workflow = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toMatch(/group:\s*release/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(workflow).toContain("npm run release");
  });

  it("ships the built web app, which .gitignore would otherwise drop", async () => {
    // Two ways the app reaches a daemon, and .npmignore is load-bearing for
    // both: `prepare` builds packages/web/dist in a checkout, `npm run
    // release` commits it onto the release branch — and either way dist is
    // gitignored, so without an .npmignore to override those rules pack-time
    // would drop it and the daemon would serve an empty page.
    const pkg = await readJson("package.json");
    expect(pkg.scripts.prepare).toContain("prepare.mjs");
    const npmignore = await fs.readFile(path.join(repo, ".npmignore"), "utf8");
    expect(npmignore).not.toMatch(/^\s*dist\s*$/m);
    const gitignore = await fs.readFile(path.join(repo, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^dist$/m); // on main it stays an artifact
  });
});

/** Every `.ts`/`.tsx` under the workspaces' `src` directories — the same walk
 * `core/test/address.test.ts` uses for its own forcing function, and for the
 * same reason: a rule that only holds where somebody remembered to look is not
 * a rule. */
async function sourceFiles(packages: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };
  for (const pkg of await fs.readdir(packages)) {
    const src = path.join(packages, pkg, "src");
    if (await fs.stat(src).then((s) => s.isDirectory(), () => false)) await walk(src);
  }
  return found;
}

/**
 * **What the release branch must NOT carry.**
 *
 * Adding `.github/workflows/grade.yml` rejected both of the release job's
 * pushes — the release branch AND `green` — with "refusing to allow a GitHub
 * App to create or update workflow … without `workflows` permission". That is
 * a platform rule with no `permissions:` key that grants it, so the fix is not
 * to ask for more: the release tree simply does not carry `.github/`.
 *
 * Which is right on its own terms. An install is a package, and nobody
 * installing isocan needs our CI — a fork of the release branch would inherit
 * a nightly grader and a changelog job aimed at somebody else's repository.
 */
describe("the release branch is a package, not a copy of the repo", () => {
  it("does not ship .github — the CI belongs to this repo, not to installs", async () => {
    const script = await fs.readFile(path.join(repo, "scripts/release.mjs"), "utf8");
    expect(script).toMatch(/git\("rm", "-r", "--cached", "--ignore-unmatch", "-q", "\.github"/);
  });

  it("the release job asks for no permission that cannot exist", async () => {
    // `workflows` is a PAT scope. Writing it here is a workflow that fails to
    // parse; asking for `actions: write` instead is a scope that looks like
    // the fix and is not, which is the more expensive mistake.
    const yml = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    const block = yml.slice(yml.indexOf("permissions:"), yml.indexOf("jobs:"));
    const asked = [...block.matchAll(/^\s{2}([a-z-]+):\s*(write|read)/gm)].map((m) => m[1]);
    expect(asked).toEqual(["contents"]);
  });

  it("green's failure names the workflow case instead of guessing at ordering", async () => {
    // It guessed, once, and was confidently wrong: the push was rejected for
    // the permission above and the step printed "an out-of-order or re-run
    // build" — as a WARNING, leaving the step green.
    const yml = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    expect(yml).toContain("git push origin ${GITHUB_SHA}:green");
    expect(yml).toMatch(/grep -q "workflow" \/tmp\/green\.err/);
  });
});
