import { describe, expect, it } from "vitest";
import { planUpgrade, type Install } from "../src/upgrade.ts";

/**
 * `isocan upgrade` has to say which copy it means. Run from some other project,
 * "this is a checkout" is a riddle — whose? where? — and the answer is often
 * surprising: an `npm link`ed CLI resolves through the symlink into a repo on
 * the far side of the disk.
 */

const spec = "github:dglazkov/isocan#release";
const checkout: Install = { kind: "checkout", root: "/Users/me/code/isocan" };
const clean = { dirty: false, branch: "main", hasUpstream: true };

describe("planning an upgrade", () => {
  it("pulls a clean checkout that tracks something, naming it", () => {
    const plan = planUpgrade(checkout, clean, spec);
    expect(plan.action).toBe("pull");
    expect(plan.message).toContain(checkout.root);
    expect(plan.message).toContain("main");
  });

  it("refuses a checkout with uncommitted work — that is someone's desk", () => {
    const plan = planUpgrade(checkout, { ...clean, dirty: true }, spec);
    expect(plan.action).toBe("none");
    expect(plan.message).toContain(checkout.root);
    expect(plan.message).toContain("uncommitted");
  });

  it("refuses a branch that tracks nothing rather than guessing a remote", () => {
    const plan = planUpgrade(checkout, { ...clean, hasUpstream: false, branch: "spike" }, spec);
    expect(plan.action).toBe("none");
    expect(plan.message).toContain("spike");
    expect(plan.message).toContain("tracks nothing");
  });

  it("tells npx it is already newest, and how to stop being temporary", () => {
    const npx: Install = { kind: "npx", root: "/Users/me/.npm/_npx/abc/node_modules/isocan" };
    const plan = planUpgrade(npx, null, spec);
    expect(plan.action).toBe("none");
    expect(plan.message).toContain(npx.root);
    expect(plan.message).toContain(`npm i -g ${spec}`);
  });

  /**
   * Auto-upgrade phase 3 moved the global install off `npm i -g`. It no longer
   * overwrites itself in place; it adopts — installed once into `builds/<sha>`
   * with PATH repointed at `current` — and the copy npm made stays where npm
   * made it, so `npm uninstall -g` still knows about it.
   */
  it("adopts a global install rather than overwriting it in place", () => {
    const global: Install = { kind: "global", root: "/usr/local/lib/node_modules/isocan" };
    const plan = planUpgrade(global, null, spec);
    expect(plan.action).toBe("swap");
    expect(plan.message).toContain(global.root);
    expect(plan.message).toContain("PATH");
  });

  it("swaps a managed install, and promises nothing running changes until it works", () => {
    const managed: Install = { kind: "managed", root: "/home/me/.isocan/builds/a1b2c3d/node_modules/isocan" };
    const plan = planUpgrade(managed, null, spec);
    expect(plan.action).toBe("swap");
    expect(plan.message).toContain("aside");
  });
});
