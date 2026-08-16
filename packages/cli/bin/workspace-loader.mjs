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
const sources = new Map([
  ["@isocan/core", new URL("../../core/src/index.ts", import.meta.url).href],
  ["@isocan/server", new URL("../../server/src/index.ts", import.meta.url).href],
]);

export function resolve(specifier, context, next) {
  const url = sources.get(specifier);
  return url ? { url, shortCircuit: true } : next(specifier, context);
}
