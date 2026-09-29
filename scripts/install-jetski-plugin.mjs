#!/usr/bin/env node
/**
 * **Install the Jetski plugin** (`docs/projects/jetski/phases.md`, phase 2):
 * link `~/.gemini/config/plugins/isocan` to this checkout's `plugins/jetski`,
 * so pulling the repo updates the plugin and there is no second copy to age.
 *
 * It replaces only what it would have made — a symlink, or nothing. A real
 * directory there is somebody's copy, perhaps edited, and deleting it is a
 * choice: `--force` makes it. `--uninstall` removes the link, and only when
 * it points here.
 *
 * Jetski reads a plugin's manifest and `hooks.json` when the plugin loads,
 * so a new install — or a changed `hooks.json` — takes a Jetski restart.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where Jetski looks for a person's plugins, and the one this installs. */
export function defaultTarget() {
  return path.join(os.homedir(), ".gemini", "config", "plugins", "isocan");
}

function existing(target) {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}

function realOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** Whether the symlink at `target` leads to `source` — literally, or once both are resolved. */
function pointsAt(target, source) {
  if (path.resolve(path.dirname(target), fs.readlinkSync(target)) === source) return true;
  const real = realOrNull(target);
  return real !== null && real === realOrNull(source);
}

/** Link `target` to `sourceDir`. Returns what it did, in words. */
export function installJetskiPlugin({ sourceDir = path.join(repoRoot, "plugins", "jetski"), target = defaultTarget(), force = false } = {}) {
  const source = path.resolve(sourceDir);
  if (!fs.existsSync(path.join(source, "plugin.json"))) throw new Error(`${source} holds no plugin.json`);
  const at = existing(target);
  if (at?.isSymbolicLink()) {
    if (pointsAt(target, source)) return `already installed: ${target} → ${source}`;
    fs.unlinkSync(target);
  } else if (at) {
    if (!force) {
      throw new Error(
        `${target} is a real ${at.isDirectory() ? "directory" : "file"}, not a link this script made — ` +
          "move it aside, or re-run with --force to replace it",
      );
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // A junction needs no elevation on Windows; everywhere else a plain directory link.
  fs.symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
  return `installed: ${target} → ${source}`;
}

/** Remove the link, and only a link that points at `sourceDir`. */
export function uninstallJetskiPlugin({ sourceDir = path.join(repoRoot, "plugins", "jetski"), target = defaultTarget() } = {}) {
  const source = path.resolve(sourceDir);
  const at = existing(target);
  if (!at) return `nothing installed at ${target}`;
  if (!at.isSymbolicLink() || !pointsAt(target, source)) {
    throw new Error(`${target} is not a link to ${source}, so it is not this script's to remove`);
  }
  fs.unlinkSync(target);
  return `uninstalled: removed ${target}`;
}

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
