import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_PERSONA_BYTES, PERSONA_NAME, readPersonas, writePersona } from "../src/personas.ts";

/**
 * **The persona jail, shaken the way the tree's was.**
 *
 * This route reads and WRITES somebody's disk, and it deliberately does not
 * reuse `readBound`/`writeBound`: that jail refuses every dotted name — which
 * is what keeps `.ssh` and `.env` out of a listing — and personas live under
 * `.agents/`. Rather than loosen the general rule for one feature, this one is
 * narrower: a fixed directory, and a name that cannot express a path at all.
 *
 * Every refusal below gets a case that fails without it.
 */
let root: string;
const persona = (name: string) => `---\nname: ${name}\ndescription: A lens.\ntools: Read\n---\nLook closely.\n`;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personas-"));
  await fs.mkdir(path.join(root, ".agents", "personas"), { recursive: true });
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("reading", () => {
  it("lists what is there, parsed, with the file verbatim beside it", async () => {
    await fs.writeFile(path.join(root, ".agents/personas/percy.md"), persona("percy"));
    const found = await readPersonas(root);
    expect(found).toHaveLength(1);
    expect(found[0]!.persona.name).toBe("percy");
    expect(found[0]!.file).toBe(".agents/personas/percy.md");
    // The raw text rides along so an editor shows what IS there rather than a
    // re-rendering of what we understood from it.
    expect(found[0]!.text).toContain("Look closely.");
  });

  it("a README beside them is a README, not a broken persona", async () => {
    await fs.writeFile(path.join(root, ".agents/personas/README.md"), "# Notes\n");
    await fs.writeFile(path.join(root, ".agents/personas/percy.md"), persona("percy"));
    expect((await readPersonas(root)).map((p) => p.persona.name)).toEqual(["percy"]);
  });

  it("does not follow a symlink dropped into the directory", async () => {
    // Nothing legitimate links INTO here — the doorway points the other way,
    // `.claude/agents` → `.agents/personas`. A link here is somebody trying to
    // read a file the route was never meant to reach.
    const secret = path.join(root, "secret.md");
    await fs.writeFile(secret, persona("secret"));
    await fs.symlink(secret, path.join(root, ".agents/personas/sneak.md"));
    expect(await readPersonas(root)).toEqual([]);
  });

  it("answers nothing, not an error, when there is no such directory", async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bare-"));
    try {
      expect(await readPersonas(bare)).toEqual([]);
    } finally {
      await fs.rm(bare, { recursive: true, force: true });
    }
  });
});

describe("writing", () => {
  it("writes one, and it reads back", async () => {
    const out = await writePersona(root, "darren", persona("darren"));
    expect(out).toEqual({ ok: true, file: ".agents/personas/darren.md" });
    expect((await readPersonas(root))[0]!.persona.name).toBe("darren");
  });

  it("creates the directory on the way", async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bare-"));
    try {
      expect((await writePersona(bare, "percy", persona("percy"))).ok).toBe(true);
    } finally {
      await fs.rm(bare, { recursive: true, force: true });
    }
  });

  it("REFUSES a name that is a path, in every spelling", async () => {
    // The jail is that the name cannot express a path at all — there is no
    // traversal to catch, because there is nothing to traverse with.
    for (const bad of ["../escape", "a/b", "..", ".hidden", "/etc/passwd", "Percy", "a".repeat(80), "", "p..p"]) {
      const out = await writePersona(root, bad, persona("x"));
      expect(out, `"${bad}" must be refused`).toMatchObject({ ok: false, refusal: "bad-name" });
    }
    // And nothing escaped onto the disk while trying.
    const outside = await fs.readdir(path.dirname(root));
    expect(outside.includes("escape")).toBe(false);
  });

  it("accepts the names a person would actually pick", () => {
    for (const good of ["percy", "darren-tokens", "a11y", "qa-tester"]) {
      expect(PERSONA_NAME.test(good), good).toBe(true);
    }
  });

  it("REFUSES a file with no front matter, before writing it", async () => {
    /**
     * The worst shape a save can have: it succeeds, and the thing vanishes.
     * A file without front matter parses to null, so the next listing would
     * skip it — saved, gone, and no error anywhere.
     */
    const out = await writePersona(root, "percy", "just some prose\n");
    expect(out).toMatchObject({ ok: false, refusal: "not-a-persona" });
    expect(await readPersonas(root)).toEqual([]);
    // Nothing was written, not even a partial file.
    expect(await fs.readdir(path.join(root, ".agents/personas"))).toEqual([]);
  });

  it("REFUSES to write through a symlink", async () => {
    const target = path.join(root, "elsewhere.md");
    await fs.writeFile(target, "original\n");
    await fs.symlink(target, path.join(root, ".agents/personas/percy.md"));
    expect(await writePersona(root, "percy", persona("percy"))).toMatchObject({
      ok: false,
      refusal: "symlink",
    });
    // The classic escape: the link's TARGET must be untouched.
    expect(await fs.readFile(target, "utf8")).toBe("original\n");
  });

  it("REFUSES something far larger than a persona", async () => {
    const huge = `---\nname: p\ndescription: d\n---\n${"x".repeat(MAX_PERSONA_BYTES)}`;
    expect(await writePersona(root, "p", huge)).toMatchObject({ ok: false, refusal: "too-big" });
  });

  it("overwrites an ordinary file it wrote before", async () => {
    await writePersona(root, "percy", persona("percy"));
    const next = persona("percy").replace("Look closely.", "Look twice.");
    expect((await writePersona(root, "percy", next)).ok).toBe(true);
    expect((await readPersonas(root))[0]!.text).toContain("Look twice.");
  });
});
