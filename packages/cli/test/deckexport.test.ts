import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **The deck as a document, over the wire.** `slides export deck.html` reads
 * every page's bytes from the daemon and writes core's self-contained file;
 * the pages are the deck's order; an extension the verb does not write is
 * refused by name; `slides show` prints the deck view's address.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-deck-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

async function canvasWithOneSlide(): Promise<{ C: string; itemId: string }> {
  const made = await json("canvas", "create", "Season planning");
  const C: string = made.canvasId;
  await fs.writeFile(path.join(home, "one.html"), "<h1>One</h1>");
  const a = await json("add", path.join(home, "one.html"), "--canvas", C);
  return { C, itemId: a.itemId };
}

describe("isocan slides export", () => {
  it("writes one self-contained HTML file holding every slide, in the deck's order", async () => {
    const made = await json("canvas", "create", "Season planning");
    const C: string = made.canvasId;
    const one = path.join(home, "one.html");
    const two = path.join(home, "two.html");
    await fs.writeFile(one, '<h1 class="a">Rest & "Play"</h1>');
    await fs.writeFile(two, "<h1>Second</h1>");
    // Placed right of the first, so reading order is one, two.
    const a = await json("add", one, "--at", "0,0", "--canvas", C);
    const b = await json("add", two, "--at", "1000,0", "--canvas", C);
    const out = path.join(home, "deck.html");
    const result = await json("slides", "export", out, "--canvas", C);
    expect(result.pages).toEqual([a.itemId, b.itemId]);
    expect(result.written).toEqual([out]);
    const html = await fs.readFile(out, "utf8");
    expect(html).toContain("<title>Season planning</title>");
    expect(html).toContain('srcdoc="<h1 class=&quot;a&quot;>Rest &amp; &quot;Play&quot;</h1>"');
    expect(html.indexOf("Rest &amp;")).toBeLessThan(html.indexOf("Second"));
  });

  it("refuses an extension it does not write, by name", async () => {
    const { C } = await canvasWithOneSlide();
    const run = await isocan("slides", "export", path.join(home, "deck.docx"), "--canvas", C);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("deck.pdf, deck.html or notes.md");
    expect(run.stderr).toContain(".docx");
  });

  it("writes speaker notes under a slide, re-words them, lists them, and carries them into the handout and the deck file", async () => {
    const { C, itemId } = await canvasWithOneSlide();
    await isocan("slides", "add", itemId, "--canvas", C);
    const made = await json("slides", "note", itemId, "Say", "hello", "first.", "--canvas", C);
    expect(made).toMatchObject({ slideId: itemId, created: true });
    // The note is a text item under the slide, the slide's width, and never a slide itself.
    const items = await json("ls", "--canvas", C);
    const note = items.find((i: { id: string }) => i.id === made.noteId);
    expect(note.properties).toMatchObject({ kind: "text", noteFor: itemId });
    expect(note.kind).toBe("text");
    const deckRows = await json("slides", "show", "--canvas", C);
    expect(deckRows.map((r: { id: string }) => r.id)).toEqual([itemId]);
    // Re-wording keeps the one note and stacks a version.
    const again = await json("slides", "note", itemId, "Say hello, then pause.", "--canvas", C);
    expect(again).toEqual({ noteId: made.noteId, slideId: itemId, created: false });
    const listed = await json("slides", "notes", "--canvas", C);
    expect(listed).toEqual([{ slide: { id: itemId, title: "one.html" }, note: { id: made.noteId, text: "Say hello, then pause." } }]);
    // The handout and the deck file carry the words.
    const md = path.join(home, "notes.md");
    await json("slides", "export", md, "--canvas", C);
    expect(await fs.readFile(md, "utf8")).toContain("## 1. one.html\n\nSay hello, then pause.");
    const html = path.join(home, "deck.html");
    await json("slides", "export", html, "--notes", "--canvas", C);
    const file = await fs.readFile(html, "utf8");
    expect(file).toContain('<aside class="notes">Say hello, then pause.</aside>');
    expect(file).toContain('<body class="notes">');
  });

  it("prints the deck view's address from slides show", async () => {
    const { C, itemId } = await canvasWithOneSlide();
    await isocan("slides", "add", itemId, "--canvas", C);
    const run = await isocan("slides", "show", "--canvas", C);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/The deck on paper[^\n]*\n\S+\/deck\n/);
  });
});
