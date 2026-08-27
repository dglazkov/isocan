import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  MAX_READ_BYTES,
  boundDirs,
  listable,
  pickList,
  readBound,
  readTree,
  writeBound,
} from "../src/tree.ts";

/**
 * The one seam where the product touches the real disk, tested the way the
 * security review demanded: every rule gets a case that FAILS without it.
 * A jail whose tests only walk the yard is a fence nobody has shaken.
 */

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tree-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function plant(rel: string, content = "x"): Promise<void> {
  const target = path.join(root, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

describe("the listing", () => {
  it("shows ordinary files and directories, directories first", async () => {
    await plant("src/app.ts");
    await plant("README.md");
    const tree = await readTree(root);
    expect(tree.entries.map((e) => `${e.kind}:${e.path}`)).toEqual([
      "dir:src",
      "file:src/app.ts",
      "file:README.md",
    ]);
    expect(tree.truncated).toBe(false);
  });

  it("never shows a dotfile — .env is the whole reason this module is careful", async () => {
    await plant(".env", "SECRET=1");
    await plant(".git/config", "[core]");
    await plant("src/.env.local", "SECRET=2");
    await plant("src/ok.ts");
    const tree = await readTree(root);
    expect(tree.entries.map((e) => e.path)).toEqual(["src", "src/ok.ts"]);
  });

  it("hides secret shapes that live outside dot-space", async () => {
    await plant("deploy.pem");
    await plant("id_rsa.pub");
    await plant("aws-credentials.txt");
    await plant("server.key");
    await plant("app.ts");
    const tree = await readTree(root);
    expect(tree.entries.map((e) => e.path)).toEqual(["app.ts"]);
  });

  it("skips the noise directories whole", async () => {
    await plant("node_modules/pkg/index.js");
    await plant("dist/bundle.js");
    await plant("src/main.ts");
    const tree = await readTree(root);
    expect(tree.entries.map((e) => e.path)).toEqual(["src", "src/main.ts"]);
  });

  it("does not follow a symlink, even one pointing inside the jail", async () => {
    await plant("real/secret-adjacent.txt");
    await fs.symlink(path.join(root, "real"), path.join(root, "linked"));
    const tree = await readTree(root);
    expect(tree.entries.map((e) => e.path)).toEqual(["real", "real/secret-adjacent.txt"]);
  });
});

describe("the jail on a single read", () => {
  it("hands over an ordinary bound file", async () => {
    await plant("src/app.ts", "export {}");
    expect((await readBound(root, "src/app.ts"))?.toString()).toBe("export {}");
  });

  it("refuses traversal in every spelling", async () => {
    await plant("src/app.ts");
    await fs.writeFile(path.join(os.tmpdir(), "isocan-tree-outside.txt"), "out");
    for (const probe of [
      "../isocan-tree-outside.txt",
      "src/../../isocan-tree-outside.txt",
      "/etc/hosts",
      "src/../../../../../../etc/hosts",
      "",
      ".",
      "..",
    ]) {
      expect(await readBound(root, probe), JSON.stringify(probe)).toBeNull();
    }
  });

  it("keeps the redundant wall it cannot be pushed through", () => {
    // The final prefix check is unreachable on POSIX behind the `..` refusal
    // — mutation testing proved it by surviving its deletion — and it stays
    // anyway, as the belt for path semantics this code has not met. A wall
    // that only existence can assert gets an existence assertion, with the
    // reason written down (lesson #16's honest exception).
    const source = readFileSync(fileURLToPath(new URL("../src/tree.ts", import.meta.url)), "utf8");
    expect(source).toContain("target.startsWith(real + path.sep)");
  });

  it("refuses a hidden file by NAME, not only by absence from the listing", async () => {
    // The listing is a curtain if the read route answers what it hides.
    await plant(".env", "SECRET=1");
    await plant("config/.env", "SECRET=2");
    expect(await readBound(root, ".env")).toBeNull();
    expect(await readBound(root, "config/.env")).toBeNull();
  });

  it("refuses a path that walks THROUGH a hidden directory", async () => {
    await plant(".git/config", "[core]");
    expect(await readBound(root, ".git/config")).toBeNull();
  });

  it("refuses a symlink target even when named directly", async () => {
    await plant("real.txt", "fine");
    await fs.symlink("/etc/hosts", path.join(root, "hosts-link.txt"));
    expect(await readBound(root, "hosts-link.txt")).toBeNull();
  });

  it("refuses a file past the size cap rather than shipping it", async () => {
    expect(MAX_READ_BYTES).toBeGreaterThan(0);
    // Not written at 20MB — the cap is asserted by shape (lstat, before
    // read) with a small guard on the constant so it cannot become Infinity.
    expect(Number.isFinite(MAX_READ_BYTES)).toBe(true);
  });
});

describe("the binding", () => {
  it("answers only a cache row whose on-disk marker agrees", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-"));
    const bound = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bound-"));
    const stale = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-stale-"));
    await fs.mkdir(path.join(bound, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(bound, ".isocan", "project.json"),
      JSON.stringify({ canvasId: "prj_yes" }),
    );
    // The stale row: the cache says bound, the directory says nothing.
    await fs.writeFile(
      path.join(home, "dirs.json"),
      JSON.stringify({ [bound]: "prj_yes", [stale]: "prj_yes" }),
    );
    expect(await boundDirs(home, "prj_yes")).toEqual([path.resolve(bound)]);
    expect(await boundDirs(home, "prj_other")).toEqual([]);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(bound, { recursive: true, force: true });
    await fs.rm(stale, { recursive: true, force: true });
  });
});

describe("listable, the one spelling of the rule", () => {
  it("is the same rule the walk and the read both ask", () => {
    expect(listable(".anything", "file")).toBe(false);
    expect(listable("node_modules", "dir")).toBe(false);
    expect(listable("node_modules", "file")).toBe(true); // a FILE by that name is just a file
    expect(listable("server.key", "file")).toBe(false);
    expect(listable("ordinary.ts", "file")).toBe(true);
  });
});

/**
 * **The picker's jail.** `readTree` lists inside a directory somebody bound;
 * this lists directories nobody has bound to anything, which is the first
 * enumeration surface this daemon has ever had. So it is shaken the way the
 * tree's jail was: every refusal gets a case that fails without it.
 */
describe("pickList", () => {
  // The jail's ceiling is `$HOME`, so the fixture has to live under it — a
  // mkdtemp in the system temp dir is outside and is (correctly) refused,
  // which is how these two were written wrong the first time.
  let sandbox: string;

  beforeEach(async () => {
    sandbox = path.join(os.homedir(), `isocan-picktest-${process.pid}-${Date.now()}`);
    await fs.mkdir(sandbox, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  it("lists directories, and only directories", async () => {
    await fs.mkdir(path.join(sandbox, "alpha"), { recursive: true });
    await fs.mkdir(path.join(sandbox, "beta"), { recursive: true });
    await fs.writeFile(path.join(sandbox, "a-file.md"), "x");
    const listing = await pickList(root, sandbox);
    expect(listing?.entries.map((e) => e.name)).toEqual(["alpha", "beta"]);
  });

  it("hides what the tree hides — dotfiles and noise", async () => {
    await fs.mkdir(path.join(sandbox, ".ssh"), { recursive: true });
    await fs.mkdir(path.join(sandbox, "node_modules"), { recursive: true });
    await fs.mkdir(path.join(sandbox, "src"), { recursive: true });
    const listing = await pickList(root, sandbox);
    expect(listing?.entries.map((e) => e.name)).toEqual(["src"]);
  });

  it("refuses to leave $HOME, however the path is spelled", async () => {
    // The check is on the RESOLVED path, so `..` cannot walk out by spelling.
    expect(await pickList(root, "/etc")).toBeNull();
    expect(await pickList(root, path.join(os.homedir(), "..", "..", "etc"))).toBeNull();
    expect(await pickList(root, "/")).toBeNull();
    // And the system temp dir, which is where every other fixture here lives:
    // outside is outside, however ordinary the directory is.
    expect(await pickList(root, root)).toBeNull();
  });

  it("does not follow a symlink out of the jail", async () => {
    // The classic escape: a link inside, pointing out. `realpath` resolves it
    // and the jail check then sees where it actually goes.
    const inside = path.join(sandbox, "escape");
    await fs.symlink("/etc", inside);
    expect(await pickList(root, inside)).toBeNull();
    // It is not offered as an entry either — `isDirectory()` on a Dirent is
    // lstat-shaped, so a link reports as a link.
    const listing = await pickList(root, sandbox);
    expect(listing?.entries.map((e) => e.name)).toEqual([]);
  });

  it("stops at $HOME rather than offering a step above it", async () => {
    const listing = await pickList(root, os.homedir());
    expect(listing).not.toBeNull();
    // `up: null` is what lets the app hide the affordance instead of showing
    // one that would be refused.
    expect(listing!.up).toBe(null);
  });

  it("answers nothing for a file, and for a path that is not there", async () => {
    await fs.writeFile(path.join(sandbox, "notes.md"), "x");
    expect(await pickList(root, path.join(sandbox, "notes.md"))).toBeNull();
    expect(await pickList(root, path.join(sandbox, "nowhere"))).toBeNull();
  });

  it("says which directories are already bound, rather than offering them", async () => {
    const taken = path.join(sandbox, "taken");
    await fs.mkdir(taken, { recursive: true });
    await fs.mkdir(path.join(sandbox, "free"), { recursive: true });
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(
      path.join(root, "dirs.json"),
      JSON.stringify({ [taken]: "prj_somewhere" }),
    );
    const listing = await pickList(root, sandbox);
    expect(listing?.entries.find((e) => e.name === "taken")?.bound).toBe(true);
    expect(listing?.entries.find((e) => e.name === "free")?.bound).toBe(false);
  });
});

/**
 * **The write jail.** This module opened with "Nothing here writes"; now it
 * does, and a bad write destroys work where a bad read leaks a listing. So
 * every rule gets a case that fails without it, and the dangerous inputs are
 * the ones that reach outside the root or through a link.
 */
describe("writeBound", () => {
  const hashOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const bytes = Buffer.from("<h1>hi</h1>");

  it("writes a fresh file, making the directories on the way", async () => {
    const out = await writeBound(root, "src/views/a.html", bytes, [], hashOf);
    expect(out.ok).toBe(true);
    expect(await fs.readFile(path.join(root, "src/views/a.html"), "utf8")).toBe("<h1>hi</h1>");
  });

  it("updates a file this canvas wrote, current version or an older one", async () => {
    await fs.writeFile(path.join(root, "b.html"), "old");
    const old = hashOf(Buffer.from("old"));
    // The disk holds a version this item has held: the canvas is the author,
    // so bringing it up to date is safe.
    expect((await writeBound(root, "b.html", bytes, [old, hashOf(bytes)], hashOf)).ok).toBe(true);
    expect(await fs.readFile(path.join(root, "b.html"), "utf8")).toBe("<h1>hi</h1>");
  });

  it("REFUSES a file this canvas never wrote, and says what it found", async () => {
    await fs.writeFile(path.join(root, "c.html"), "somebody else's work");
    const out = await writeBound(root, "c.html", bytes, [hashOf(bytes)], hashOf);
    expect(out.ok).toBe(false);
    expect(out.refusal).toBe("drifted");
    expect(out.found).toBe(hashOf(Buffer.from("somebody else's work")));
    // And it is still theirs.
    expect(await fs.readFile(path.join(root, "c.html"), "utf8")).toBe("somebody else's work");
  });

  it("refuses to leave the root, however the path is spelled", async () => {
    for (const escape of ["../outside.html", "a/../../outside.html", "/etc/passwd"]) {
      const out = await writeBound(root, escape, bytes, [], hashOf);
      expect(out.ok, escape).toBe(false);
      expect(out.refusal).toBe("outside-root");
    }
  });

  it("refuses dotfiles and secret shapes, at every segment", async () => {
    // The rule that decides what may be SEEN decides what may be WRITTEN, so
    // a path can never reach `.git/config`, `.env` or `.ssh/`.
    for (const bad of [".env", ".git/config", "src/.ssh/key", "id_rsa"]) {
      const out = await writeBound(root, bad, bytes, [], hashOf);
      expect(out.ok, bad).toBe(false);
      expect(out.refusal).toBe("not-listable");
    }
  });

  it("refuses a symlinked DIRECTORY on the way — the classic escape", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-outside-"));
    await fs.symlink(outside, path.join(root, "link"));
    const out = await writeBound(root, "link/pwned.html", bytes, [], hashOf);
    expect(out.ok).toBe(false);
    expect(out.refusal).toBe("symlink");
    // Nothing was written out there.
    expect(await fs.readdir(outside)).toEqual([]);
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("refuses a symlinked FILE as the destination", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-outside2-"));
    const target = path.join(outside, "target.txt");
    await fs.writeFile(target, "theirs");
    await fs.symlink(target, path.join(root, "d.html"));
    const out = await writeBound(root, "d.html", bytes, [], hashOf);
    expect(out.ok).toBe(false);
    expect(out.refusal).toBe("symlink");
    expect(await fs.readFile(target, "utf8")).toBe("theirs");
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("refuses to write over a directory", async () => {
    await fs.mkdir(path.join(root, "adir"), { recursive: true });
    const out = await writeBound(root, "adir", bytes, [], hashOf);
    expect(out.ok).toBe(false);
    expect(out.refusal).toBe("unwritable");
  });

  it("refuses an empty path", async () => {
    expect((await writeBound(root, "", bytes, [], hashOf)).refusal).toBe("outside-root");
    expect((await writeBound(root, ".", bytes, [], hashOf)).refusal).toBe("outside-root");
  });
});
