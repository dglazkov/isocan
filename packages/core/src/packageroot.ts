import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **Where this copy of isocan is, asked once and answered the same way from
 * every copy** (`docs/projects/first-minute/design.md`, change 1).
 *
 * Six files used to count directories up from their own source — `myRoot()` in
 * the CLI, `root` in the server's build stamp, the web app's `dist`, the
 * daemon bin the API spawns — and every one of them was right only because
 * the file it was written in never moved. The release CLI is now bundled into
 * `packages/cli/dist`, so `import.meta.url` inside it is a chunk's and not the
 * source's, and `../../..` means something different for every module folded
 * into it. Counting directories cannot survive that; asking the filesystem
 * can.
 *
 * So: walk up from wherever the caller is until a `package.json` says its name
 * is `isocan`. That is true in a checkout, in the bundle, in `npm i -g`'s
 * tree, and under `~/.isocan/current/node_modules/isocan` — four layouts, one
 * answer, and no file has to know how deep it sits.
 *
 * **Not exported from `@isocan/core`'s index**, and the subpath is the reason:
 * the index is bundled for browsers (`scripts/release.mjs`,
 * RELEASE_BROWSER_BUNDLES) where a `node:fs` import anywhere in the closure
 * fails the build. Reach it as `@isocan/core/packageroot`.
 */
let cached: string | null = null;

/** How far up to look before giving up — a checkout is 3 deep, an install 4. */
const CEILING = 12;

/**
 * **This copy's root**, cached, since every command asks and the answer
 * cannot change while a process runs. `from` exists so a caller in another
 * tree can ask about that one; the default is this module's own location,
 * which in the bundle is the bundle's.
 */
export function packageRoot(from: string = import.meta.url): string {
  if (cached) return cached;
  let dir = from.startsWith("file:") ? path.dirname(fileURLToPath(from)) : path.resolve(from);
  for (let up = 0; up < CEILING; up++) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if ((JSON.parse(readFileSync(manifest, "utf8")) as { name?: string }).name === "isocan") {
          cached = dir;
          return cached;
        }
      } catch {
        // A package.json we cannot parse is not ours; keep walking rather than
        // failing a CLI start over somebody else's broken manifest.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `cannot find the isocan package root above ${from} — no package.json named "isocan" within ${CEILING} directories`,
  );
}

/** A file inside this copy: `packagePath("packages/web/dist", "index.html")`. */
export function packagePath(...parts: string[]): string {
  return path.join(packageRoot(), ...parts);
}

/** Where a checkout keeps its bin, for a tree whose manifest will not parse. */
const SOURCE_BIN = "packages/cli/bin/isocan.js";

/**
 * **The executable a copy of isocan declares**, for the two places that spawn
 * one — the API starting a daemon, and `restart` reaching an older install.
 *
 * Read from that copy's own manifest rather than written down here, because
 * the answer differs by copy: a checkout's bin is the tsx launcher
 * `packages/cli/bin/isocan.js`, and the release branch's is the bundle
 * `packages/cli/dist/isocan.mjs`. Spawning the wrong one is the failure this
 * prevents — a bundled install has no `bin/isocan.js` at all.
 *
 * The fallback is the checkout's, for a tree whose manifest cannot be read;
 * an ENOENT from the spawn is a better error than one from here.
 */
export function packageBin(root: string = packageRoot()): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const declared = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.isocan;
    if (declared) return path.join(root, declared);
  } catch {
    // Fall through: an unreadable manifest is not worth failing a spawn over.
  }
  return path.join(root, SOURCE_BIN);
}
