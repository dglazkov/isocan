#!/usr/bin/env node
/**
 * **A git merge driver for files nobody writes by hand.**
 *
 *   node scripts/mergegen.mjs <path-in-repo> <%A>
 *
 * `docs/ROADMAP.md` is derived from front matter. It is also the single most
 * conflicted file in this repository: 157 of the 512 commits in the fortnight
 * to 13 September touched it, and every rebase across any of them stopped on
 * a merge conflict in a file whose contents are a pure function of other
 * files. `docs/projects/README.md` (77), `docs/changelog/README.md` (38) and
 * `docs/reviews/README.md` (28) are the same shape. Three hundred touches of
 * hand-resolving a derivation.
 *
 * A generated file has no "theirs" worth merging. The right answer at a
 * conflict is not a resolution at all — it is to run the generator again. So
 * that is what this does, and `.gitattributes` points the four of them here.
 *
 * **It never fails a merge.** Mid-rebase the tree can be in a state a
 * generator refuses — a doc half-applied, a front matter key from a commit
 * not yet replayed. Exiting non-zero there would turn a conflict this exists
 * to remove into a stopped rebase, so on any trouble it keeps what git
 * already put in `%A` and exits 0. The generated file is verified on every
 * push anyway (`release.yml` runs "The roadmap is current"), which is the
 * backstop that makes leniency here safe.
 *
 * Registered per clone rather than committed, because a merge driver lives in
 * `.git/config` by design — `scripts/prepare.mjs` installs it on every
 * `npm install`, and `test/mergegen.test.ts` checks the two halves agree about
 * which files are generated.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * The generated files, and the command that produces each. A file here is a
 * file no human edits; if that ever stops being true for one of them, it must
 * leave this list first, because the driver will overwrite hand edits without
 * asking on the next conflict.
 *
 * **Whole, not partly.** The driver copies the regenerated file over git's
 * merge result, so listing a file its generator only PARTLY rewrites does not
 * merely risk overwriting an edit — it discards the incoming side of every
 * merge, silently, exit 0, with nothing in `git status` to notice.
 * `docs/projects/README.md` (hand-written since the status column moved into
 * each project's front matter) and `docs/reviews/README.md` were both listed
 * here and neither is written by the generator named beside it. They ate the
 * same projects-index row twice on 15 Sep 2026. Both are gone from this list;
 * they conflict honestly now, which is the lesser cost.
 */
export const GENERATED = {
  "docs/ROADMAP.md": ["scripts/roadmap.mjs"],
};

export function regenerate(target) {
  const generator = GENERATED[target];
  if (!generator) return false;
  execFileSync(process.execPath, generator.map((part) => path.join(repo, part)), {
    cwd: repo,
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 60_000,
  });
  return true;
}

if (process.argv[1] && process.argv[1].endsWith("mergegen.mjs")) {
  const [target, ours] = process.argv.slice(2);
  try {
    if (target && ours && regenerate(target) && existsSync(path.join(repo, target))) {
      copyFileSync(path.join(repo, target), ours);
    }
  } catch {
    // Keep what git staged. A generated file that is briefly stale is a CI
    // step; a rebase that stops dead is somebody's afternoon.
  }
  process.exit(0);
}
