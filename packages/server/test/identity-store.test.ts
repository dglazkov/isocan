import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { adoptIdentity, readBadge, writeBadge, type StoredBadge } from "../src/badge-store.ts";

let home: string;
const priya = { id: "usr_priya", name: "Priya" };
const badge: StoredBadge = { badgeId: "bdg_acme", secret: "synthetic-acme-secret", at: "2026-01-01" };
beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-store-")); });
afterEach(async () => { await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

it("merges adoption and badges in either order, preserving private fields and permissions", async () => {
  const file = path.join(home, "identity.json");
  await fs.writeFile(file, JSON.stringify({ privatePreference: "acme", auth: { "https://old.example": badge } }), { mode: 0o640 });
  await fs.chmod(file, 0o640);
  await Promise.all([
    writeBadge(home, "https://first.example/", badge),
    adoptIdentity(home, priya),
    writeBadge(home, "https://last.example", badge),
  ]);
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  expect(saved).toMatchObject({ ...priya, privatePreference: "acme" });
  expect(Object.keys(saved.auth).sort()).toEqual(["https://first.example", "https://last.example", "https://old.example"]);
  expect((await fs.stat(file)).mode & 0o777).toBe(0o640);
  expect((await readBadge(home, "https://first.example"))?.badgeId).toBe(badge.badgeId);

  await Promise.all([
    adoptIdentity(home, { ...priya, name: "Priya Updated" }),
    writeBadge(home, "https://next.example", badge),
  ]);
  const updated = JSON.parse(await fs.readFile(file, "utf8"));
  expect(updated.name).toBe("Priya Updated");
  expect(updated.auth["https://next.example"].badgeId).toBe(badge.badgeId);
  expect(updated.privatePreference).toBe("acme");
});

it("creates a private credential file and leaves a different held person unchanged", async () => {
  const file = path.join(home, "identity.json");
  await writeBadge(home, "https://acme.example", badge);
  expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  expect(await adoptIdentity(home, priya)).toEqual({ actor: priya, adopted: true });
  const before = await fs.readFile(file, "utf8");
  expect(await adoptIdentity(home, { id: "usr_jordan", name: "Jordan" })).toEqual({ actor: priya, adopted: false });
  expect(await fs.readFile(file, "utf8")).toBe(before);
});

it("does not invent a name for an admission-only identity", async () => {
  expect(await adoptIdentity(home, { id: "usr_acme", name: "" })).toEqual({ actor: { id: "usr_acme", name: "" }, adopted: false });
  await expect(fs.stat(path.join(home, "identity.json"))).rejects.toMatchObject({ code: "ENOENT" });
});
