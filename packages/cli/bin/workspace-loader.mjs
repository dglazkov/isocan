/**
 * Resolve `@isocan/*` to the sources sitting right next to us.
 *
 * The CLI imports its siblings by package name, which normally means
 * `node_modules/@isocan/…` links. In a checkout npm workspaces make those; in
 * an install from git they had to be declared as `file:` dependencies — and
 * those turn out to be a trap: reinstalling over an existing copy leaves npm
 * rebuilding a link whose target it has just deleted, and the whole install
 * dies with "Cannot destructure property 'package' of 'node.target'". Every
 * upgrade would have hit it.
 *
 * The packages travel together in one package, so their paths are known
 * without a resolver: same relative place in a checkout and in an install.
 * No links to declare, nothing for npm to rebuild, and `--ignore-scripts`
 * changes nothing.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sources = new Map([
  ["@isocan/api", new URL("../../api/src/index.ts", import.meta.url).href],
  ["@isocan/core", new URL("../../core/src/index.ts", import.meta.url).href],
  ["@isocan/server", new URL("../../server/src/index.ts", import.meta.url).href],
]);

/**
 * **Modules resolve the same way** (`docs/projects/modules/design.md`).
 *
 * `@isocan/<module>/<entry>` — the `cli` entry of the mind map, say — is a package under
 * `packages/modules/` whose entries are its `src/<entry>.ts` (or `.tsx`). The
 * CLI's own `./modulehost` export is the one non-module shape, resolved the
 * same way against `packages/cli`. Nothing here is declared as a dependency
 * for the reason the map above exists.
 */
const MODULE_ENTRY = /^@isocan\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/;

function moduleSource(specifier) {
  const m = MODULE_ENTRY.exec(specifier);
  if (!m) return undefined;
  const [, name, entry] = m;
  const roots = name === "cli" ? [`../src/${entry}`] : [`../../modules/${name}/src/${entry}`];
  for (const root of roots) {
    for (const ext of [".ts", ".tsx"]) {
      const url = new URL(`${root}${ext}`, import.meta.url);
      if (existsSync(fileURLToPath(url))) return url.href;
    }
  }
  return undefined;
}

export function resolve(specifier, context, next) {
  const url = sources.get(specifier) ?? moduleSource(specifier);
  return url ? { url, shortCircuit: true } : next(specifier, context);
}
