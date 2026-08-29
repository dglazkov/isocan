import { promises as fs, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { paths } from "@isocan/server";

/**
 * Upgrading depends on how this copy got here, and the answer is never
 * obvious from where you are standing: `isocan` on your PATH may be a global
 * install, an npx cache directory, or — via `npm link` — a checkout on the
 * other side of the disk. So every message names the copy it is talking
 * about; "this is a checkout" from inside some other project is a riddle.
 */
export type InstallKind = "managed" | "checkout" | "global" | "npx" | "local";

export interface Install {
  kind: InstallKind;
  /** The package root — the copy being upgraded. */
  root: string;
}

export async function whichInstall(
  root: string,
  home: string = paths.isocanHome(),
): Promise<Install> {
  /**
   * **Managed goes first** (auto-upgrade phase 3), and not only for tidiness:
   * a build tree is `builds/<sha>/node_modules/isocan`, which every later test
   * here would classify as `local` — the kind whose upgrade is `npm i -g`,
   * which is the one thing a managed install must never do to itself.
   */
  const inside = path.relative(resolved(paths.buildsDir(home)), resolved(root));
  if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) {
    return { kind: "managed", root };
  }
  if (await exists(path.join(root, ".git"))) return { kind: "checkout", root };
  if (root.includes(`${path.sep}_npx${path.sep}`)) return { kind: "npx", root };
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const globalRoot = spawnSync(npm, ["root", "-g"], { encoding: "utf8" }).stdout?.trim();
  /**
   * **Both sides through their symlinks first.** `root` arrives already
   * resolved — node realpaths a module's path on its way to loading it, and
   * `isocan` on PATH is a symlink — while `npm root -g` prints the prefix as
   * configured, unresolved. On macOS that is the difference between
   * `/private/tmp/…` and `/tmp/…`, and comparing the two literally answered
   * "local" about a plainly global install, whose upgrade path is `npm i -g`:
   * the one thing that must not happen to a copy this machinery is supposed to
   * be adopting. Measured, not reasoned — it is how the first run of auto-
   * upgrade phase 3's proof overwrote the install it was meant to adopt.
   */
  if (globalRoot && resolved(root).startsWith(resolved(globalRoot))) {
    return { kind: "global", root };
  }
  return { kind: "local", root };
}

/** `realpath`, falling back to `resolve` for a path that does not exist yet.
 * Shared with `managed.ts`, which compares the same kind of pair. */
export function resolved(target: string): string {
  try {
    return realpathSync(path.resolve(target));
  } catch {
    return path.resolve(target);
  }
}

/** What a checkout can be told about itself before touching it. */
export interface CheckoutState {
  dirty: boolean;
  branch: string;
  hasUpstream: boolean;
}

export function checkoutState(root: string): CheckoutState {
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  return {
    dirty: (git("status", "--porcelain").stdout ?? "").trim().length > 0,
    branch: (git("rev-parse", "--abbrev-ref", "HEAD").stdout ?? "").trim(),
    hasUpstream: git("rev-parse", "--abbrev-ref", "@{u}").status === 0,
  };
}

export interface UpgradePlan {
  /**
   * "pull" a checkout, "swap" a build in the managed root, "fetch" with
   * `npm i -g` for an install this machinery does not own, or explain and
   * stop.
   */
  action: "pull" | "swap" | "fetch" | "none";
  message: string;
}

/**
 * The decision, kept free of side effects so the awkward cases are testable:
 * a checkout is only pulled when it is clean and tracking something, because
 * an upgrade that stashes your work or invents a merge is not an upgrade.
 */
export function planUpgrade(
  install: Install,
  state: CheckoutState | null,
  spec: string,
): UpgradePlan {
  if (install.kind === "checkout") {
    if (!state) return { action: "none", message: `checkout at ${install.root}` };
    if (state.dirty) {
      return {
        action: "none",
        message:
          `the checkout at ${install.root} has uncommitted changes — this is your working copy, ` +
          "so pull it yourself; `isocan restart` afterwards runs what you built",
      };
    }
    if (!state.hasUpstream) {
      return {
        action: "none",
        message:
          `the checkout at ${install.root} is on "${state.branch}", which tracks nothing — ` +
          "nothing to pull; `isocan restart` runs what is there",
      };
    }
    return { action: "pull", message: `pulling ${install.root} (${state.branch})…` };
  }
  /**
   * **A managed install swaps; a global install adopts, which is the same
   * swap** (auto-upgrade phase 3). The global copy is left exactly where npm
   * put it — what moves is the `isocan` link on PATH, onto `current`, after
   * which every upgrade is a symlink flip and this branch never has to think
   * about the global tree again.
   */
  if (install.kind === "managed") {
    return {
      action: "swap",
      message: `installing aside — nothing that is running changes until the new build answers for itself`,
    };
  }
  if (install.kind === "global") {
    return {
      action: "swap",
      message:
        `adopting the global install at ${install.root} — the copy stays where npm put it; ` +
        "what moves is `isocan` on your PATH, onto a build root that can be rolled back",
    };
  }
  if (install.kind === "npx") {
    return {
      action: "none",
      message:
        `this ran from an npx cache (${install.root}), which re-resolves the branch every run — ` +
        `it is already the newest build. For a lasting one: npm i -g ${spec}`,
    };
  }
  return { action: "fetch", message: `fetching the newest build into ${install.root}…` };
}

async function exists(target: string): Promise<boolean> {
  return fs.stat(target).then(() => true, () => false);
}
