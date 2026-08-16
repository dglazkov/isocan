import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Upgrading depends on how this copy got here, and the answer is never
 * obvious from where you are standing: `isocan` on your PATH may be a global
 * install, an npx cache directory, or — via `npm link` — a checkout on the
 * other side of the disk. So every message names the copy it is talking
 * about; "this is a checkout" from inside some other project is a riddle.
 */
export type InstallKind = "checkout" | "global" | "npx" | "local";

export interface Install {
  kind: InstallKind;
  /** The package root — the copy being upgraded. */
  root: string;
}

export async function whichInstall(root: string): Promise<Install> {
  if (await exists(path.join(root, ".git"))) return { kind: "checkout", root };
  if (root.includes(`${path.sep}_npx${path.sep}`)) return { kind: "npx", root };
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const globalRoot = spawnSync(npm, ["root", "-g"], { encoding: "utf8" }).stdout?.trim();
  if (globalRoot && path.resolve(root).startsWith(path.resolve(globalRoot))) {
    return { kind: "global", root };
  }
  return { kind: "local", root };
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
  /** "pull" a checkout, "fetch" from git for an install, or explain and stop. */
  action: "pull" | "fetch" | "none";
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
