import { createRequire } from "node:module";
import path from "node:path";

/**
 * **Where this repo's `node_modules` actually is — asked, never assumed.**
 *
 * Two tests build a second copy of isocan on disk and borrow the repo's
 * dependencies by symlinking `node_modules` into it. Both computed that path
 * as `<the directory three levels above this file>/node_modules`, which is the
 * repo root in a plain checkout and **the wrong answer in a git worktree**: a
 * worktree's dependencies live in the main checkout, so the symlink points at
 * a directory that either does not exist or holds only the workspace links.
 *
 * The failure that produces is worth describing, because it cost a day of
 * being written off as flakiness. The copied CLI's launcher registers `tsx` to
 * import TypeScript directly; with no `tsx` reachable it exits 1 immediately,
 * and the test — which is waiting for that copy to answer on a port — reports
 * *"gave up after 3389ms waiting for the other copy of isocan to answer"*.
 * That reads exactly like a slow machine, and the honest instinct is to raise
 * the timeout. The timeout was never the problem; the process was dead before
 * the first probe.
 *
 * So the path is resolved rather than constructed. `tsx` is the package to ask
 * for because `tsx` is the one whose absence breaks the copy — resolving the
 * thing that actually has to be there means this helper cannot succeed while
 * the copy would fail.
 */
export function nodeModulesDir(): string {
  const require = createRequire(import.meta.url);
  let dir: string;
  try {
    dir = path.dirname(require.resolve("tsx/package.json"));
  } catch (err) {
    throw new Error(
      `cannot find tsx, which the copied CLI needs to start (${(err as Error).message}) — ` +
        "run `npm ci` at the repo root",
    );
  }
  // Up to the enclosing `node_modules`, rather than assuming `tsx` sits
  // directly inside one: npm may nest a package under another's own tree, and
  // a wrong answer here is a symlink that resolves to something plausible.
  while (path.basename(dir) !== "node_modules") {
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`no node_modules above ${require.resolve("tsx/package.json")}`);
    dir = up;
  }
  return dir;
}
