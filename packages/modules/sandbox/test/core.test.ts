import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import {
  SANDBOX_OF_PROP,
  SANDBOX_RUN_PROP,
  isSandboxItem,
  runOf,
  sandboxModule,
  sandboxesOn,
  transcriptFor,
  argvOf,
  statusLine,
  transcriptFilename,
  transcriptOf,
} from "../src/core.ts";

function item(id: string, properties: Record<string, string> = {}, updatedAt = "2026-09-12T00:00:00.000Z"): Item {
  return {
    id,
    title: id,
    description: "",
    properties,
    createdAt: updatedAt,
    updatedAt,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    currentVersionId: `${id}_v1`,
    versions: [
      {
        id: `${id}_v1`,
        blobHash: "sha256:abc",
        mimeType: "text/plain",
        filename: `${id}.mjs`,
        size: 1,
        createdAt: updatedAt,
        actor: "act_x",
      },
    ],
  } as unknown as Item;
}

function canvas(items: Item[]): CanvasContents {
  return { items: Object.fromEntries(items.map((i) => [i.id, i])) } as unknown as CanvasContents;
}

describe("what makes an item a program", () => {
  it("is the property, and nothing else — no kind, no mime", () => {
    expect(isSandboxItem(item("a"))).toBe(false);
    expect(isSandboxItem(item("a", { [SANDBOX_RUN_PROP]: "node a.mjs" }))).toBe(true);
    // A blank argv is not a program: it would refuse at run time, and a list
    // that showed it would be promising something.
    expect(isSandboxItem(item("a", { [SANDBOX_RUN_PROP]: "   " }))).toBe(false);
    expect(runOf(item("a", { [SANDBOX_RUN_PROP]: "  node a.mjs  " }))).toBe("node a.mjs");
  });

  it("lists programs newest edit first, and finds each one's transcript", () => {
    const older = item("old", { [SANDBOX_RUN_PROP]: "node old.mjs" }, "2026-09-10T00:00:00.000Z");
    const newer = item("new", { [SANDBOX_RUN_PROP]: "node new.mjs" }, "2026-09-11T00:00:00.000Z");
    const out = item("out", { [SANDBOX_OF_PROP]: "old" });
    const c = canvas([older, newer, out, item("plain")]);
    expect(sandboxesOn(c).map((i) => i.id)).toEqual(["new", "old"]);
    expect(transcriptFor(c, "old")?.id).toBe("out");
    expect(transcriptFor(c, "new")).toBeNull();
  });
});

describe("the argv, split without a shell", () => {
  it("groups with quotes and escapes with a backslash", () => {
    expect(argvOf("node build.mjs --fast")).toEqual(["node", "build.mjs", "--fast"]);
    expect(argvOf(`node -e "console.log('hi there')"`)).toEqual(["node", "-e", "console.log('hi there')"]);
    expect(argvOf("node my\\ file.mjs")).toEqual(["node", "my file.mjs"]);
    expect(argvOf("   ")).toEqual([]);
  });

  it("treats a shell's own punctuation as ordinary characters", () => {
    // There is no shell, so these are arguments rather than operators. The
    // guide says so; this is the guard that keeps it true.
    expect(argvOf("node a.mjs | tee out")).toEqual(["node", "a.mjs", "|", "tee", "out"]);
    expect(argvOf("node a.mjs && rm -rf /")).toEqual(["node", "a.mjs", "&&", "rm", "-rf", "/"]);
    expect(argvOf("echo $HOME")).toEqual(["echo", "$HOME"]);
  });
});

describe("the transcript is a file, not a record only we can read", () => {
  const base = { argv: ["node", "a.mjs"], ms: 1200, engine: "Seatbelt", code: 0 };

  it("opens with the command and closes with how it went", () => {
    const text = transcriptOf({ ...base, stdout: "hello\n", stderr: "" });
    expect(text.split("\n")[0]).toBe("$ node a.mjs");
    expect(text).toContain("hello");
    expect(text.trimEnd().split("\n").at(-1)).toBe("exit 0 · 1.2 s · fenced by Seatbelt");
  });

  it("keeps stderr, and says when there was nothing at all", () => {
    expect(transcriptOf({ ...base, code: 1, stdout: "", stderr: "boom\n" })).toContain("--- stderr ---");
    expect(transcriptOf({ ...base, stdout: "", stderr: "" })).toContain("(printed nothing)");
    expect(transcriptOf({ ...base, stdout: "x", stderr: "", truncated: true })).toContain("(output truncated)");
  });

  it("says which way a run ended", () => {
    expect(statusLine({ ...base, stdout: "", stderr: "", timedOut: true })).toContain("timed out");
    expect(statusLine({ ...base, stdout: "", stderr: "", code: 2 })).toContain("exit 2");
    expect(statusLine({ ...base, stdout: "", stderr: "", code: null, signal: "SIGKILL" })).toContain("killed by SIGKILL");
  });

  it("names itself after the program", () => {
    expect(transcriptFilename("build.mjs")).toBe("build.out.txt");
    expect(transcriptFilename("run")).toBe("run.out.txt");
  });
});

describe("the module's record", () => {
  it("adds no kind and no op — only two namespaced keys", () => {
    expect(sandboxModule.kinds).toBeUndefined();
    expect(sandboxModule.propertyKeys).toEqual([SANDBOX_RUN_PROP, SANDBOX_OF_PROP]);
    for (const key of sandboxModule.propertyKeys!) expect(key.startsWith("sandbox.")).toBe(true);
  });

  it("contributes a context row only when there is something to say", () => {
    expect(sandboxModule.contextPieces!(canvas([item("plain")]))).toEqual([]);
    const rows = sandboxModule.contextPieces!(canvas([item("a", { [SANDBOX_RUN_PROP]: "node a.mjs" })]));
    expect(rows[0]!.name).toBe("Sandboxes");
    expect(rows[0]!.size).toContain("none run yet");
  });
});

/**
 * **The trust line, checked rather than promised.** A module is trusted like
 * the CLI you installed; the bytes it runs came off a canvas and are a
 * collaborator's. The fence that separates them is the app's, reached through
 * `CliHost.runFenced` — so this module must have no way to start a process of
 * its own. Nothing stops a module importing `node:child_process`; what stops
 * THIS one is this test, and a reviewer who reads it.
 */
describe("the module cannot start a process of its own", () => {
  const source = (name: string): string =>
    readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), "utf8");

  it("reaches no spawning API, on any surface", () => {
    for (const file of ["core.ts", "cli.ts", "web.tsx", "page.tsx"]) {
      const text = source(file);
      for (const forbidden of ["node:child_process", "child_process", "node:worker_threads", "node:vm", "eval("]) {
        expect(text, `${file} must not reach ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("runs things exactly one way — through the host's fence", () => {
    const cli = source("cli.ts");
    expect(cli).toContain("host.runFenced(");
    expect(cli.match(/runFenced\(/g)?.length).toBe(1);
  });

  it("renders no frame and no canvas code in the browser", () => {
    // The shape the extension-actors gate still binds (phases.md, 12 Sep).
    for (const file of ["web.tsx", "page.tsx"]) {
      const text = source(file);
      expect(text).not.toContain("<iframe");
      expect(text).not.toContain("dangerouslySetInnerHTML");
      expect(text).not.toContain("postMessage");
    }
  });
});
