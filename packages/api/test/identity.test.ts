import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { retireStrandedIdentities } from "../src/identity.ts";

describe("retireStrandedIdentities", () => {
  const dirs: string[] = [];
  const origHome = process.env.HOME;

  afterEach(async () => {
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    for (const d of dirs.splice(0)) {
      await fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("does not retire the person's own home identity when HOME is a symlink (#304)", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-symlink-"));
    dirs.push(base);

    const realHome = path.join(base, "real-home");
    const symlinkHome = path.join(base, "link-home");
    const projectDir = path.join(realHome, "workspace", "project");
    await fs.mkdir(path.join(realHome, ".isocan"), { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    await fs.symlink(realHome, symlinkHome);

    const homeIdentityPath = path.join(realHome, ".isocan", "identity.json");
    await fs.writeFile(
      homeIdentityPath,
      JSON.stringify({ id: "usr_person", name: "Person", createdAt: new Date().toISOString() }),
    );

    process.env.HOME = symlinkHome;
    const symlinkIsocanHome = path.join(symlinkHome, ".isocan");

    // Walk up from realpath cwd while HOME and home are symlink paths
    await retireStrandedIdentities(projectDir, symlinkIsocanHome);

    const exists = await fs
      .access(homeIdentityPath)
      .then(() => true)
      .catch(() => false);
    const retiredExists = await fs
      .access(`${homeIdentityPath}.retired`)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
    expect(retiredExists).toBe(false);
  });

  it("retires a genuine directory identity inside a project checkout", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-stranded-"));
    dirs.push(base);

    const realHome = path.join(base, "home");
    const projectDir = path.join(realHome, "workspace", "repo");
    await fs.mkdir(path.join(realHome, ".isocan"), { recursive: true });
    await fs.mkdir(path.join(projectDir, ".isocan"), { recursive: true });

    const homeIdentityPath = path.join(realHome, ".isocan", "identity.json");
    await fs.writeFile(
      homeIdentityPath,
      JSON.stringify({ id: "usr_person", name: "Person", createdAt: new Date().toISOString() }),
    );

    const strandedPath = path.join(projectDir, ".isocan", "identity.json");
    await fs.writeFile(
      strandedPath,
      JSON.stringify({ id: "usr_kenny", name: "Kenny", createdAt: new Date().toISOString() }),
    );

    process.env.HOME = realHome;
    await retireStrandedIdentities(projectDir, path.join(realHome, ".isocan"));

    const homeExists = await fs
      .access(homeIdentityPath)
      .then(() => true)
      .catch(() => false);
    const strandedExists = await fs
      .access(strandedPath)
      .then(() => true)
      .catch(() => false);
    const retiredExists = await fs
      .access(`${strandedPath}.retired`)
      .then(() => true)
      .catch(() => false);

    expect(homeExists).toBe(true);
    expect(strandedExists).toBe(false);
    expect(retiredExists).toBe(true);
  });
});
