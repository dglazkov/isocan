import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **The product's voice and the copy lint, against a real daemon** (copy-edit
 * phase 4, journey scene 4).
 *
 * A canvas's DESIGN.md says *sign in*, never *log in*, and avoids *seamless*.
 * `words vary` puts that voice in the text model's question and refuses a
 * voice — a model's or an agent's `--from` file — that writes a banned form,
 * landing nothing. `words lint` reads the same Voice section and flags the
 * screen that says *Log in*, the copy tells, and length by character count
 * (said as a count: the CLI has no renderer); it exits 1 when it finds
 * something. Synthetic: Acme's sign-in flow.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-words-lint-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  client = new DaemonClient(`http://127.0.0.1:${port}`, home);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(args: string[], env: Record<string, string | undefined> = {}): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ISOCAN_TEXT_API_KEY: "", ...env }) });
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(args);
  expect(run.code, run.stderr).toBe(0);
  return run.stdout;
}

const DESIGN = `---
name: Acme
colors:
  primary: "#116633"
---

## Overview

Acme ships parcels.

## Voice

Plain and direct, second person.

Avoid: seamless

Glossary:
- sign in — never log in, login
`;

const WELCOME = `<!doctype html><html><head><title>Acme welcome</title></head><body><h1>Your parcels, in one place</h1><button>Sign in</button></body></html>`;
const HELP = `<!doctype html><html><head><title>Acme help</title></head><body><h1>Need a hand?</h1><p>Log in to see your parcels.</p><button>Get Started</button></body></html>`;

async function setUp(name: string) {
  const canvas = JSON.parse(await ok("--json", "canvas", "create", name)).canvasId as string;
  const design = path.join(home, `${name}-DESIGN.md`);
  await fs.writeFile(design, DESIGN);
  await ok("--canvas", canvas, "design", "set", design);
  const add = async (file: string, html: string, title: string, at: string) => {
    await fs.writeFile(path.join(home, file), html);
    return JSON.parse(await ok("--canvas", canvas, "--json", "add", path.join(home, file), "--title", title, "--at", at)).itemId as string;
  };
  const welcome = await add(`${name}-welcome.html`, WELCOME, "Acme welcome", "0,600");
  const help = await add(`${name}-help.html`, HELP, "Acme help", "500,600");
  return { canvas, welcome, help };
}

describe("isocan words — the product's voice and the copy lint", () => {
  it("vary puts the voice in the question and refuses a voice that breaks it, landing nothing", async () => {
    const { canvas, welcome } = await setUp("Acme voice");
    const deck = JSON.parse(await ok("--canvas", canvas, "--json", "words", welcome)) as { strings: Array<{ address: string; text: string }> };
    const button = deck.strings.find((s) => s.text === "Sign in")!.address;
    const before = Object.keys((await client.snapshot(canvas)).canvas.items).length;

    // An agent's file that says "Log in" is refused by the voice, by name.
    const bad = path.join(home, "bad-voices.json");
    await fs.writeFile(bad, JSON.stringify({ variants: [{ stance: "Casual", why: "Relaxed.", edits: [{ address: button, to: "Log in" }] }] }));
    const refused = await isocan(["--canvas", canvas, "words", "vary", welcome, "--from", bad]);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain(`variant 1 (Casual) says "Log in" — the voice says "sign in", never "log in" at ${button} (button) — DESIGN.md's Voice section`);
    expect(Object.keys((await client.snapshot(canvas)).canvas.items)).toHaveLength(before);

    // A text model is asked with the voice in the question; its answer is held to it too.
    const prompts: string[] = [];
    const answer = { variants: [{ stance: "Smooth", why: "Easy.", edits: [{ address: button, to: "A seamless sign in" }] }] };
    const fake = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        prompts.push(JSON.stringify(JSON.parse(body).messages));
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: "claude-acme", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answer) }] }));
      });
    });
    await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
    const address = fake.address();
    try {
      const endpoint = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1/messages`;
      const asked = await isocan(["--canvas", canvas, "words", "vary", welcome, "--n", "1"], { ISOCAN_TEXT_API_KEY: "sk-ant-fake_test_key_0000000000", ISOCAN_TEXT_ENDPOINT: endpoint });
      expect(asked.code).not.toBe(0);
      expect(asked.stderr).toContain(`the text model's answer: variant 1 (Smooth) says "seamless" — the voice avoids it`);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("The product's voice, from its DESIGN.md");
      expect(prompts[0]).toContain("Words to avoid — never write them: seamless.");
      expect(prompts[0]).toContain('Say \\"sign in\\", never \\"log in\\" or \\"login\\".');
    } finally {
      await new Promise<void>((resolve) => fake.close(() => resolve()));
    }
    expect(Object.keys((await client.snapshot(canvas)).canvas.items)).toHaveLength(before);
  });

  it("lint flags the screen that says Log in, the copy tells, and length by count — and exits 1", async () => {
    const { canvas, welcome, help } = await setUp("Acme lint");
    const run = await isocan(["--canvas", canvas, "--json", "words", "lint", welcome, help]);
    expect(run.code).toBe(1);
    const out = JSON.parse(run.stdout) as { screens: string[]; voice: boolean; fit: string; findings: Array<{ kind: string; itemId?: string; text?: string; what: string }> };
    expect(out.screens).toEqual([welcome, help]);
    expect(out.voice).toBe(true);
    expect(out.fit).toContain("character count");
    expect(out.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "glossary", itemId: help, text: "Log in to see your parcels.", what: 'body says "Log in" — the voice says "sign in", never "log in"' }),
        expect.objectContaining({ kind: "tell", itemId: help, text: "Get Started", what: 'Generic call to action: says "Get Started"' }),
      ]),
    );
    expect(out.findings.filter((f) => f.itemId === welcome)).toEqual([]);

    // The screen that keeps to the voice, alone: nothing to fix, exit 0, said in words.
    const clean = await isocan(["--canvas", canvas, "words", "lint", welcome]);
    expect(clean.code, clean.stderr).toBe(0);
    expect(clean.stdout).toContain("1 screen: nothing to fix (held to DESIGN.md's Voice)");

    // A flow that is not there is refused by name.
    const flow = await isocan(["--canvas", canvas, "words", "lint", "--flow", "acme-nowhere"]);
    expect(flow.code).not.toBe(0);
    expect(flow.stderr).toContain('no wireframe flow "acme-nowhere" on this canvas');
  });
});
