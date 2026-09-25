import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import judgeCli, { gitRootOf } from "../src/cli.ts";
import { fixtureProblems, shapeOf, type Pair } from "../src/core.ts";
import { CANVAS, PERSON, SyntheticCanvas, acmeCanvas } from "./synthetic.ts";

/**
 * **`isocan judge corpus` against canvases held in memory.**
 *
 * The host is the CLI's, faked: `ctx.client` answers the four reads the verb
 * makes — the canvases, the archived and live log, a blob — from synthetic
 * canvases, and the verb's own resolution picks among them. What this holds:
 * the terminal and `--json` carry counts and never a request, a title or a
 * canvas name; `--out` writes the labelled set and its shape; a directory
 * inside a git work tree is refused before anything is written; an agent
 * session is refused, because its keeps are not a person's labels.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const SECOND = "prj_acme_two";

function harness(opts: { actor?: Actor; harness?: string | null } = {}) {
  const canvases = new Map<string, { title: string; canvas: SyntheticCanvas }>([
    [CANVAS, { title: "Acme Desks", canvas: acmeCanvas() }],
    [SECOND, { title: "Acme Empty", canvas: new SyntheticCanvas() }],
  ]);
  const program = new Command().exitOverride().option("--json").option("--canvas <ref>");
  const errors: string[] = [];
  const logs: string[] = [];
  const json: unknown[] = [];
  const archivedUpTo = 12;
  const ctx = {
    json: false,
    harness: opts.harness ?? null,
    get actor(): Actor {
      if (!(opts.actor ?? PERSON)) throw new Error("no identity");
      return opts.actor ?? PERSON;
    },
    client: {
      listCanvases: async () => [...canvases].map(([id, c]) => ({ id, title: c.title })),
      // The log arrives in two halves, as after `isocan gc`: the archive, then the live tail.
      getArchivedLog: async (id: string) => canvases.get(id)!.canvas.entries.filter((e) => e.seq <= archivedUpTo),
      getLog: async (id: string) => canvases.get(id)!.canvas.entries.filter((e) => e.seq > archivedUpTo - 3),
      downloadBlob: async (id: string, hash: string) => Buffer.from(canvases.get(id)!.canvas.readText(hash), "utf8"),
    },
  } as Record<string, unknown>;
  const host = {
    program,
    run: (fn: (...args: any[]) => Promise<void>) => async (...args: any[]) => {
      try {
        await fn(...args);
      } catch (error) {
        errors.push((error as Error).message);
      }
    },
    ctxOf: async (cmd: Command) => {
      ctx.json = Boolean(cmd.optsWithGlobals().json);
      return ctx;
    },
    resolveCanvas: async (c: { canvasRef?: string }) => {
      const ref = c.canvasRef ?? CANVAS;
      const hit = [...canvases].find(([id, v]) => id === ref || v.title.toLowerCase().startsWith(ref.toLowerCase()));
      if (!hit) throw new Error(`no canvas "${ref}"`);
      return { id: hit[0], title: hit[1].title };
    },
    printJson: (v: unknown) => json.push(v),
    truncate: (t: string) => t,
  } as unknown as CliHost;
  judgeCli.register(host);
  const run = async (...args: string[]) => {
    await program.parseAsync(["node", "isocan", ...args]);
    return { errors, logs, json };
  };
  return { run, logs, errors, json };
}

let log: ReturnType<typeof vi.spyOn>;
let printed: string[];
beforeEach(() => {
  printed = [];
  log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void printed.push(args.join(" ")));
});
afterEach(() => log.mockRestore());

const outDir = () => path.join(mkdtempSync(path.join(tmpdir(), "acme-judge-")), "corpus");
const REAL_STRINGS = ["An Acme app for booking a desk", "Acme List", "Acme Detail", "itm_acme_list", "grp_acme_desks"];

describe("isocan judge corpus", () => {
  it("prints the count on the day, and no request or screen title", async () => {
    const h = harness();
    const { errors } = await h.run("judge", "corpus");
    expect(errors).toEqual([]);
    const text = printed.join("\n");
    expect(text).toMatch(/1 canvas read as Acme Person: 12 rows drawn · 4 labelled \(2 kept, 2 taken out\) · 8 none · \d+ held out/);
    expect(text).toContain("not in the corpus: 1 without need");
    expect(text).toContain("1 in flows that were undone");
    expect(text).toContain("nothing written");
    for (const s of REAL_STRINGS) expect(text).not.toContain(s);
  });

  it("reads the canvases it is named, or --all, each once", async () => {
    const h = harness();
    await h.run("--json", "judge", "corpus", "Acme Desks", CANVAS, SECOND);
    const one = h.json[0] as { canvases: Array<{ id: string; counts: { rows: number } }> };
    expect(one.canvases.map((c) => c.id)).toEqual([CANVAS, SECOND]);
    expect(one.canvases[1]!.counts.rows).toBe(0);
    await h.run("--json", "judge", "corpus", "--all");
    expect((h.json[1] as { counts: { rows: number } }).counts.rows).toBe(12);
  });

  it("--json carries counts and ids, never a string anybody typed", async () => {
    const h = harness();
    await h.run("--json", "judge", "corpus");
    const text = JSON.stringify(h.json);
    expect((h.json[0] as { counts: unknown }).counts).toMatchObject({ rows: 12, labelled: 4, kept: 2, takenOut: 2, none: 8 });
    for (const s of [...REAL_STRINGS, "Acme Desks"]) expect(text).not.toContain(s);
  });

  it("--out writes the labelled set, with its strings, and the shape, without them", async () => {
    const h = harness();
    const out = outDir();
    const { errors } = await h.run("judge", "corpus", "--out", out);
    expect(errors).toEqual([]);
    const labelled = JSON.parse(readFileSync(path.join(out, "labelled.json"), "utf8")) as { by: Actor; pairs: Array<Pair & { canvasTitle: string }> };
    expect(labelled.by.id).toBe(PERSON.id);
    expect(labelled.pairs).toHaveLength(12);
    expect(labelled.pairs.find((p) => p.itemId === "itm_acme_detail")).toMatchObject({ verdict: "kept", p: 0.41, request: "An Acme app for booking a desk", title: "Acme Detail", canvasTitle: "Acme Desks" });
    const shape = JSON.parse(readFileSync(path.join(out, "shape.json"), "utf8")) as unknown;
    expect(shape).toEqual(shapeOf(labelled.pairs));
    expect(fixtureProblems(shape)).toEqual([]);
    expect(printed.join("\n")).toContain("stays on this machine");
  });

  it("refuses an --out inside a git work tree, and writes nothing there", async () => {
    const h = harness();
    const inside = path.join(repo, "packages/modules/judge/test/never-written");
    expect(gitRootOf(inside)).toBe(repo);
    const { errors } = await h.run("judge", "corpus", "--out", inside);
    expect(errors.join("\n")).toMatch(/inside a git work tree/);
    expect(existsSync(inside)).toBe(false);
  });

  it("refuses an agent session: its keeps are not a person's labels", async () => {
    const h = harness({ harness: "claude-code", actor: { id: "act_acme_agent", name: "Acme Agent" } });
    const { errors } = await h.run("judge", "corpus");
    expect(errors.join("\n")).toMatch(/PERSON's own keeps.*agent session \(claude-code\)/);
    expect(printed).toEqual([]);
  });
});
