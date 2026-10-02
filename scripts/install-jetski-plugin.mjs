#!/usr/bin/env node
/**
 * **Install the Jetski plugin from a checkout** (`docs/projects/jetski/phases.md`,
 * phase 2).
 *
 * The logic lives in `packages/cli/src/jetski-plugin.ts` and ships inside the
 * CLI as `isocan setup --jetski`, so an `npm i -g github:dglazkov/isocan#release`
 * install needs no clone of this repository. This script is the checkout
 * doorway to the same functions.
 */
import fs from "node:fs";
import { register as registerLoader } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();
registerLoader("../packages/cli/bin/workspace-loader.mjs", import.meta.url);

const { defaultTarget, installJetskiPlugin, uninstallJetskiPlugin } = await import("../packages/cli/src/jetski-plugin.ts");
export { defaultTarget, installJetskiPlugin, uninstallJetskiPlugin };

const invoked = (() => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invoked) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--target");
  const target = at >= 0 ? args[at + 1] : undefined;
  if (at >= 0 && !target) {
    console.error("--target needs a path");
    process.exit(1);
  }
  try {
    const options = target ? { target: path.resolve(target) } : {};
    if (args.includes("--uninstall")) {
      console.log(uninstallJetskiPlugin(options));
    } else {
      const said = installJetskiPlugin({ ...options, force: args.includes("--force") });
      console.log(said);
      console.log(
        said.startsWith("already installed")
          ? "Nothing to do. If hooks.json changed since Jetski started, restart Jetski: it reads that file once, at load."
          : "Restart Jetski to load it — and again after any change to hooks.json, which Jetski reads once, at load.",
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
