import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { paths } from "@isocan/server";
import type { UpgradeVerdict } from "@isocan/core";
import {
  applySwap,
  autoUpgrade,
  currentSha,
  flipTo,
  lastRefusal,
  listBuilds,
  upgradePolicy,
  withUpgradeLock,
} from "../src/managed.ts";
import type { Install } from "../src/upgrade.ts";
import { makeBuild } from "./builds.ts";

/**
 * **Auto-upgrade phase 4: what a machine does when nobody is watching.**
 *
 * Phase 3's mechanism had one caller and it was a person. Everything here is
 * about the decision in front of it — who may apply an upgrade, when they may
 * stop, and what is reported afterwards — and it is all reachable without a
 * network because `applySwap` takes the fetch as a seam and the builds are
 * fixtures.
 */

let home: string;
const spec = "github:dglazkov/isocan#release";

const installOf = (kind: Install["kind"]): Install => ({ kind, root: `/somewhere/${kind}` });

const verdictOf = (over: Partial<UpgradeVerdict> = {}): UpgradeVerdict => ({
  available: true,
  direction: "behind",
  home: "https://isocan.io",
  homeCommit: "bbbbbbb",
  homeBuiltAt: "2026-08-25T09:00:00.000Z",
  mine: "aaaaaaa",
  mineBuiltAt: "2026-08-12T09:00:00.000Z",
  why: "this copy is aaaaaaa; your home runs bbbbbbb",
  ...over,
});

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-auto-"));
  delete process.env.ISOCAN_NO_UPGRADE;
});

afterEach(async () => {
  delete process.env.ISOCAN_NO_UPGRADE;
  await fs.rm(home, { recursive: true, force: true });
});

async function config(values: Record<string, unknown>): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(paths.configFile(home), JSON.stringify(values));
}

describe("who may apply an upgrade", () => {
  /**
   * In notify mode, applying an upgrade takes four steps on an unattended
   * machine — the notice, the agent reporting it, a person approving, the
   * agent running the command — and that chain never completes on the machines
   * nobody watches. So the default turns on whether the copy is one that can
   * adopt itself.
   */
  it.each(["managed", "global"] as const)(
    "makes a %s install auto by default, and says why",
    async (kind) => {
      const policy = await upgradePolicy(home, kind);
      expect(policy.mode).toBe("auto");
      expect(policy.why).toContain(kind);
    },
  );

  /**
   * **The front door's install is a GLOBAL one**, so this is the case the
   * whole project was written for: `setup` runs `npm i -g`, and a machine that
   * came through the front door has to be able to close the gap on its own.
   * Journey Scene 0 says so outright — "after phase 4, `auto` closes the gap on
   * her machine before it grows" — and names the only two populations that
   * keep the notice: a checkout, and a machine where somebody chose `notify`.
   * The first version of this shipped with `global` on notify, which denied
   * the feature to everybody who had not already opted in by hand.
   */
  it("does not leave the front door's own install waiting to be asked", async () => {
    expect((await upgradePolicy(home, "global")).mode).toBe("auto");
  });

  it.each(["checkout", "npx", "local"] as const)(
    "leaves a %s install on notify — it is not a copy that can adopt itself",
    async (kind) => {
      const policy = await upgradePolicy(home, kind);
      expect(policy.mode).toBe("notify");
      expect(policy.why).toContain(kind);
    },
  );

  it("takes the mode from config.json when it names one", async () => {
    await config({ upgrade: "off" });
    expect((await upgradePolicy(home, "managed")).mode).toBe("off");
    await config({ upgrade: "auto" });
    expect((await upgradePolicy(home, "npx")).mode).toBe("auto");
  });

  it("ignores a mode config.json does not recognise rather than guessing", async () => {
    await config({ upgrade: "yes please" });
    expect((await upgradePolicy(home, "managed")).mode).toBe("auto"); // the default, not the typo
  });

  /**
   * The rule the project turns on, and the one control that is not a
   * preference: a working copy is never upgraded for anybody.
   */
  it("refuses auto on a checkout even when config.json asks for it", async () => {
    await config({ upgrade: "auto" });
    const policy = await upgradePolicy(home, "checkout");
    expect(policy.mode).toBe("notify");
    expect(policy.why).toContain("working copy");
  });

  it("lets one shell stop it, over anything the file says", async () => {
    await config({ upgrade: "auto" });
    process.env.ISOCAN_NO_UPGRADE = "1";
    const policy = await upgradePolicy(home, "managed");
    expect(policy.mode).toBe("off");
    expect(policy.why).toContain("ISOCAN_NO_UPGRADE");
  });

  it("reads ISOCAN_NO_UPGRADE=0 as not set — a variable that says no means no", async () => {
    process.env.ISOCAN_NO_UPGRADE = "0";
    expect((await upgradePolicy(home, "managed")).mode).toBe("auto");
  });

  it("carries a pin, and only a plausible one", async () => {
    await config({ upgradePin: "a1b2c3d" });
    const policy = await upgradePolicy(home, "managed");
    expect(policy.pin).toBe("a1b2c3d");
    expect(policy.why).toContain("a1b2c3d");
    await config({ upgradePin: "the good one" });
    expect((await upgradePolicy(home, "managed")).pin).toBeNull();
  });
});

describe("one upgrade at a time", () => {
  it("lets the second caller alone rather than racing it", async () => {
    let inner: unknown = "not run";
    const outer = withUpgradeLock(home, async () => {
      inner = await withUpgradeLock(home, async () => "ran anyway");
      return "held";
    });
    expect(await outer).toBe("held");
    expect(inner).toBeNull();
  });

  /** A lock whose owner is gone is not a lock. Without this, one process
   * killed at the wrong moment stops a machine upgrading forever — and
   * nothing would report it. */
  it("takes over a lock left by a process that no longer exists", async () => {
    const lock = path.join(paths.buildsDir(home), ".lock");
    await fs.mkdir(lock, { recursive: true });
    await fs.writeFile(path.join(lock, "pid"), "999999");
    expect(await withUpgradeLock(home, async () => "took it")).toBe("took it");
  });

  it("releases the lock even when the work throws", async () => {
    await expect(
      withUpgradeLock(home, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await withUpgradeLock(home, async () => "free")).toBe("free");
  });
});

describe("applying it", () => {
  /** The seam: an `npm install` that writes a fixture into the staging prefix. */
  const installing = (sha: string, options: { broken?: boolean } = {}) =>
    async (_c: string, args: string[]) => {
      await makeBuild(args[args.indexOf("--prefix") + 1]!, sha, options);
      return { status: 0, stdout: "", stderr: "" };
    };

  it("fetches, proves and flips, and reports what moved", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");
    const swapped = await applySwap({
      home,
      spec,
      want: "bbbbbbb",
      run: installing("bbbbbbb"),
    });
    expect(swapped).toMatchObject({ ok: true, step: "done", from: "aaaaaaa", to: "bbbbbbb" });
    expect(await currentSha(home)).toBe("bbbbbbb");
  });

  it("leaves current where it was when the candidate will not start", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");
    const swapped = await applySwap({
      home,
      spec,
      want: "bbbbbbb",
      run: installing("bbbbbbb", { broken: true }),
    });
    expect(swapped).toMatchObject({ ok: false, step: "smoke" });
    expect(swapped.why).toContain("still on aaaaaaa");
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  it("says so and does nothing when the wanted build is already current", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");
    const swapped = await applySwap({ home, spec, want: "aaaaaaa", run: installing("aaaaaaa") });
    expect(swapped.step).toBe("current");
  });

  /**
   * A rollback followed by a step forward should cost nothing: the tree was
   * smoke-tested when it landed, and re-downloading it to arrive at a
   * directory that already exists is waste that only shows on a metered
   * connection.
   */
  it("does not fetch a build it already has on disk", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb");
    await flipTo(home, "aaaaaaa");
    let fetched = false;
    const swapped = await applySwap({
      home,
      spec,
      want: "bbbbbbb",
      run: async () => {
        fetched = true;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    expect(fetched).toBe(false);
    expect(swapped).toMatchObject({ ok: true, step: "done", to: "bbbbbbb" });
  });
});

describe("the unattended decision", () => {
  const managed = installOf("managed");
  const ready = async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb");
    await flipTo(home, "aaaaaaa");
  };

  it("upgrades, and says what moved and that this process did not", async () => {
    await ready();
    const said = await autoUpgrade({
      home,
      install: managed,
      health: { upgrade: verdictOf() },
      spec,
    });
    expect(said).toContain("upgraded to bbbbbbb from aaaaaaa");
    // The precise claim: no flip moves a running process.
    expect(said).toContain("still running the old build");
    expect(said).toContain("agent-guide");
    expect(await currentSha(home)).toBe("bbbbbbb");
  });

  it("does nothing at all when there is no verdict — never a cheerful no-op", async () => {
    await ready();
    expect(await autoUpgrade({ home, install: managed, health: null, spec })).toBeNull();
    expect(
      await autoUpgrade({
        home,
        install: managed,
        health: { upgrade: verdictOf({ available: false }) },
        spec,
      }),
    ).toBeNull();
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  /** A home running the older build is a notice, never a downgrade. */
  it("does not follow a home that is behind its own CLI", async () => {
    await ready();
    const said = await autoUpgrade({
      home,
      install: managed,
      health: { upgrade: verdictOf({ direction: "ahead" }) },
      spec,
    });
    expect(said).toBeNull();
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  it.each([
    ["off", { upgrade: "off" }],
    ["notify", { upgrade: "notify" }],
    ["a pin", { upgradePin: "aaaaaaa" }],
  ])("holds across a home that has moved: %s", async (_label, values) => {
    await ready();
    await config(values);
    expect(
      await autoUpgrade({ home, install: managed, health: { upgrade: verdictOf() }, spec }),
    ).toBeNull();
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  it("holds across a home that has moved: ISOCAN_NO_UPGRADE=1", async () => {
    await ready();
    process.env.ISOCAN_NO_UPGRADE = "1";
    expect(
      await autoUpgrade({ home, install: managed, health: { upgrade: verdictOf() }, spec }),
    ).toBeNull();
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  it("never touches a checkout, whatever config.json says", async () => {
    await ready();
    await config({ upgrade: "auto" });
    expect(
      await autoUpgrade({
        home,
        install: installOf("checkout"),
        health: { upgrade: verdictOf() },
        spec,
      }),
    ).toBeNull();
    expect(await currentSha(home)).toBe("aaaaaaa");
  });

  /**
   * Without the marker, a build that cannot start is re-fetched and re-tested
   * at every park — half a minute and tens of megabytes, forever, on a machine
   * nobody is watching.
   */
  it("remembers a build that failed, and tries the next one immediately", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb", { broken: true });
    await flipTo(home, "aaaaaaa");

    const first = await autoUpgrade({
      home,
      install: managed,
      health: { upgrade: verdictOf() },
      spec,
    });
    expect(first).toContain("could not upgrade to bbbbbbb");
    expect(await currentSha(home)).toBe("aaaaaaa");

    // Same verdict again: silent, and nothing re-run.
    expect(
      await autoUpgrade({ home, install: managed, health: { upgrade: verdictOf() }, spec }),
    ).toBeNull();

    // A NEW build the home has cut is tried at once.
    await makeBuild(paths.buildDir(home, "ccccccc"), "ccccccc");
    const next = await autoUpgrade({
      home,
      install: managed,
      health: { upgrade: verdictOf({ homeCommit: "ccccccc" }) },
      spec,
    });
    expect(next).toContain("upgraded to ccccccc");
    expect(await currentSha(home)).toBe("ccccccc");
    // …and the record of the failure is gone, so a later re-cut of bbbbbbb
    // would be tried again.
    expect(await lastRefusal(home)).toBeNull();
  });

  /** Journey Scene 2: a refused build is always reported. Reported once into a
   * transcript nobody kept is a machine that silently stopped upgrading. */
  it("keeps the refusal where status can read it back", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb", { broken: true });
    await flipTo(home, "aaaaaaa");
    await autoUpgrade({ home, install: managed, health: { upgrade: verdictOf() }, spec });
    const refusal = await lastRefusal(home);
    expect(refusal?.sha).toBe("bbbbbbb");
    expect(refusal?.why).toContain("did not start cleanly");
    expect(Number.isNaN(Date.parse(refusal!.at))).toBe(false);
  });

  it("keeps the failed tree rather than deleting evidence", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb", { broken: true });
    await flipTo(home, "aaaaaaa");
    await autoUpgrade({ home, install: managed, health: { upgrade: verdictOf() }, spec });
    expect((await listBuilds(home)).map((b) => b.sha).sort()).toEqual(["aaaaaaa", "bbbbbbb"]);
  });
});
