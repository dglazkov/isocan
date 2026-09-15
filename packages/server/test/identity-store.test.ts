import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeIdentity } from "../../api/src/identity.ts";
import os from "node:os";
import path from "node:path";
import { adoptIdentity, readBadge, writeBadge, type StoredBadge } from "../src/badge-store.ts";

let home: string;
const priya = { id: "usr_priya", name: "Priya" };
const badge: StoredBadge = { badgeId: "bdg_acme", secret: "synthetic-acme-secret", at: "2026-01-01" };
beforeEach(async () => { home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-store-"))); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

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


function writer(directory: string, action: Record<string, unknown>) {
  const child = spawn(process.execPath, ["--import", "tsx", "--import", fileURLToPath(new URL("./identity-write-hook.mjs", import.meta.url)),
    fileURLToPath(new URL("./identity-write-child.mjs", import.meta.url)), directory, JSON.stringify(action)], {
    env: { ...process.env, ISOCAN_HOME: directory }, stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const messages: Array<{ type: string; result?: unknown }> = [];
  const waiters = new Map<string, (message: { type: string; result?: unknown }) => void>();
  let stderr = "";
  child.stderr!.on("data", (data) => { stderr += data; });
  child.on("message", (message: { type: string; result?: unknown }) => {
    messages.push(message);
    waiters.get(message.type)?.(message);
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Identity child ${code}: ${stderr}`)));
  });
  return {
    child, messages, done,
    wait(type: string) {
      const existing = messages.find((message) => message.type === type);
      return existing ? Promise.resolve(existing) : new Promise<{ type: string; result?: unknown }>((resolve) => { waiters.set(type, resolve); });
    },
    release() { if (child.connected) child.send({ type: "continue" }); },
  };
}

async function stopWriter(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await exited;
}

it("serializes physical-home aliases across processes and chooses the rename ID after adoption", async () => {
  const physical = path.join(home, "physical");
  const alias = path.join(home, "alias");
  await fs.mkdir(physical);
  await fs.symlink(physical, alias, "dir");
  const file = path.join(physical, "identity.json");
  await fs.writeFile(file, JSON.stringify({ privatePreference: { theme: "acme" }, auth: { "https://old.example": badge } }), { mode: 0o640 });
  await fs.chmod(file, 0o640);
  const first = writer(physical, { kind: "adopt", actor: priya });
  let second: ReturnType<typeof writer> | undefined;
  try {
    await first.wait("identity-write-read");
    second = writer(alias, { kind: "rename", name: "Priya Updated" });
    await second.wait("identity-lock-contended");
    expect(second.messages.some((message) => message.type === "identity-write-read")).toBe(false);
    first.release();
    await first.done;
    await second.wait("identity-write-read");
    second.release();
    expect((await second.wait("result")).result).toEqual({ ...priya, name: "Priya Updated" });
    await second.done;
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved).toMatchObject({ ...priya, name: "Priya Updated", privatePreference: { theme: "acme" }, auth: { "https://old.example": badge } });
    expect((await fs.stat(file)).mode & 0o777).toBe(0o640);
    const fresh = await writeIdentity(alias, "New Person", true);
    expect(fresh.id).not.toBe(priya.id);
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toMatchObject({ ...fresh, auth: saved.auth, privatePreference: saved.privatePreference });
  } finally {
    first.release(); second?.release();
    await stopWriter(first.child);
    if (second) await stopWriter(second.child);
  }
});

it.each(["{broken", "null", "[]", '{"auth":[]}', '{"id":3}', '{"name":{}}'])("refuses unsupported existing bytes %s without replacement", async (raw) => {
  const file = path.join(home, "identity.json");
  await fs.writeFile(file, raw);
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toThrow();
  await expect(writeIdentity(home, "Acme")).rejects.toThrow();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  await expect(fs.stat(path.join(home, ".identity-write.lock"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("refuses non-ENOENT reads and preserves bytes, then releases its own failed update", async () => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify({ ...priya, privatePreference: "acme" });
  await fs.writeFile(file, raw);
  const read = fs.readFile.bind(fs);
  const spy = vi.spyOn(fs, "readFile").mockImplementation((...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === file) return Promise.reject(Object.assign(new Error("synthetic read refusal"), { code: "EACCES" }));
    return read(...args);
  });
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toMatchObject({ code: "EACCES" });
  spy.mockRestore();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  await writeBadge(home, "https://acme.example", badge);
  expect(await readBadge(home, "https://acme.example")).toEqual(badge);
});

it.each([null, { pid: 99999999, nonce: "synthetic-foreign-owner" }])("does not steal an incomplete or foreign lock (%j)", async (owner) => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify(priya);
  await fs.writeFile(file, raw);
  const lock = path.join(home, ".identity-write.lock");
  await fs.mkdir(lock);
  if (owner) await fs.writeFile(path.join(lock, "owner.json"), JSON.stringify(owner));
  // Advance only the contention deadline; the filesystem refusal is real.
  vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(5000);
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toThrow(lock);
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  expect((await fs.stat(lock)).isDirectory()).toBe(true);
  expect(await fs.readdir(lock)).toEqual(owner ? ["owner.json"] : []);
  if (owner) expect(JSON.parse(await fs.readFile(path.join(lock, "owner.json"), "utf8"))).toEqual(owner);
});

it("does not remove a replacement owner when a failed read releases the lock", async () => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify(priya);
  await fs.writeFile(file, raw);
  const ownerFile = path.join(home, ".identity-write.lock", "owner.json");
  const foreign = JSON.stringify({ pid: 99999999, nonce: "replacement" });
  const read = fs.readFile.bind(fs);
  const spy = vi.spyOn(fs, "readFile").mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === file) {
      await fs.writeFile(ownerFile, foreign);
      throw Object.assign(new Error("synthetic read refusal"), { code: "EACCES" });
    }
    return read(...args);
  });
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toThrow("ownership changed");
  spy.mockRestore();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  expect(await fs.readFile(ownerFile, "utf8")).toBe(foreign);
});

it("cleans up its newly claimed lock if owner recording fails, without changing identity", async () => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify(priya);
  await fs.writeFile(file, raw);
  const open = fs.open.bind(fs);
  const spy = vi.spyOn(fs, "open").mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args);
    if (String(args[0]).endsWith("/.identity-write.lock/owner.json")) {
      vi.spyOn(handle, "writeFile").mockRejectedValue(Object.assign(new Error("synthetic owner write failure"), { code: "ENOSPC" }));
    }
    return handle;
  });
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toMatchObject({ code: "ENOSPC" });
  spy.mockRestore();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  await expect(fs.stat(path.join(home, ".identity-write.lock"))).rejects.toMatchObject({ code: "ENOENT" });
  await writeIdentity(home, "Priya Updated");
  expect(JSON.parse(await fs.readFile(file, "utf8"))).toMatchObject({ ...priya, name: "Priya Updated" });
});

it("refuses a failed atomic replacement without losing identity or leaving its lock", async () => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify({ ...priya, auth: { "https://old.example": badge } });
  await fs.writeFile(file, raw);
  const rename = fs.rename.bind(fs);
  const spy = vi.spyOn(fs, "rename").mockImplementation((...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]) === file) return Promise.reject(Object.assign(new Error("synthetic replacement refusal"), { code: "EACCES" }));
    return rename(...args);
  });
  await expect(writeIdentity(home, "Priya Updated")).rejects.toMatchObject({ code: "EACCES" });
  spy.mockRestore();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  await expect(fs.stat(path.join(home, ".identity-write.lock"))).rejects.toMatchObject({ code: "ENOENT" });
  await writeBadge(home, "https://acme.example", badge);
  expect(JSON.parse(await fs.readFile(file, "utf8"))).toMatchObject({ ...priya, auth: { "https://old.example": badge, "https://acme.example": badge } });
});

it("preserves a foreign owner that appears during failed owner creation", async () => {
  const file = path.join(home, "identity.json");
  const raw = JSON.stringify(priya);
  await fs.writeFile(file, raw);
  const ownerFile = path.join(home, ".identity-write.lock", "owner.json");
  const foreign = JSON.stringify({ pid: 99999999, nonce: "foreign-created-record" });
  const open = fs.open.bind(fs);
  const spy = vi.spyOn(fs, "open").mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    if (String(args[0]) === ownerFile) {
      await fs.writeFile(ownerFile, foreign);
    }
    return open(...args);
  });
  await expect(writeBadge(home, "https://acme.example", badge)).rejects.toThrow();
  spy.mockRestore();
  expect(await fs.readFile(file, "utf8")).toBe(raw);
  expect(await fs.readFile(ownerFile, "utf8")).toBe(foreign);
});
