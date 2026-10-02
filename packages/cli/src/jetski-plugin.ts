import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packagePath } from "@isocan/core/packageroot";

/**
 * **Install the Jetski plugin from whichever copy of isocan is running**
 * (`docs/projects/jetski/phases.md`, phase 2).
 *
 * Links `~/.gemini/config/plugins/isocan` to this copy's `plugins/jetski` — in
 * a `#release` install (`INSTALL_SPEC`) or in a checkout — so
 * upgrading the CLI updates the plugin in place and nobody needs a clone of
 * the repository just to run the plugin.
 *
 * It replaces only what it would have made: a symlink, or nothing. A real
 * directory there is somebody's copy, perhaps edited, and deleting it is a
 * choice (`force: true`). `uninstallJetskiPlugin` removes the link only when
 * it points at `sourceDir`.
 */

/** Where Jetski looks for the isocan plugin (`ISOCAN_JETSKI_PLUGIN_DIR` overrides for tests). */
export function defaultTarget(env: NodeJS.ProcessEnv = process.env): string {
  const override = env["ISOCAN_JETSKI_PLUGIN_DIR"]?.trim();
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".gemini", "config", "plugins", "isocan");
}

function existing(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}

function realOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** Whether the symlink at `target` leads to `source` — literally, or once both are resolved. */
function pointsAt(target: string, source: string): boolean {
  if (path.resolve(path.dirname(target), fs.readlinkSync(target)) === source) return true;
  const real = realOrNull(target);
  return real !== null && real === realOrNull(source);
}

/** Link `target` to `sourceDir`. Returns what it did, in words. */
export function installJetskiPlugin({
  sourceDir = packagePath("plugins", "jetski"),
  target = defaultTarget(),
  force = false,
}: {
  sourceDir?: string;
  target?: string;
  force?: boolean;
} = {}): string {
  const source = path.resolve(sourceDir);
  if (!fs.existsSync(path.join(source, "plugin.json"))) throw new Error(`${source} holds no plugin.json`);
  const at = existing(target);
  if (at?.isSymbolicLink()) {
    if (pointsAt(target, source)) return `already installed: ${target} → ${source}`;
    fs.unlinkSync(target);
  } else if (at) {
    if (!force) {
      throw new Error(
        `${target} is a real ${at.isDirectory() ? "directory" : "file"}, not a link isocan made — ` +
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
export function uninstallJetskiPlugin({
  sourceDir = packagePath("plugins", "jetski"),
  target = defaultTarget(),
}: {
  sourceDir?: string;
  target?: string;
} = {}): string {
  const source = path.resolve(sourceDir);
  const at = existing(target);
  if (!at) return `nothing installed at ${target}`;
  if (!at.isSymbolicLink() || !pointsAt(target, source)) {
    throw new Error(`${target} is not a link to ${source}, so it is not this script's to remove`);
  }
  fs.unlinkSync(target);
  return `uninstalled: removed ${target}`;
}
