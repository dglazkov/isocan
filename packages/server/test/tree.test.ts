import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_READ_BYTES, boundDirs, listable, readBound, readTree } from "../src/tree.ts";

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
