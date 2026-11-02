import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLAUDE_TEXT_MODEL } from "@isocan/core/jev";
import { KEY_PROVIDERS } from "@isocan/core/keys";
import { TEXT_ROUTE } from "@isocan/core/text";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import { KEYS_HELP_PROVIDERS } from "../src/keys.ts";
import { mintTestBadge } from "./badge.ts";
import { cliEnv, runCli, runCliWithInput, type Run } from "./cli.ts";

/**
 * **`isocan keys`** (keys phase 1): `ls`, `set`, `rm`, `test` over
 * `~/.isocan/keys.json`, against the real binary — and the phase's proof: a
 * key set with `isocan keys set` (stdin) is used by a RUNNING daemon's
 * `POST /api/text` on the next request, with no restart.
 *
 * Every byte every run prints is checked for the key values: nothing here may
 * show one. Fixtures are synthetic: Acme, Priya, made-up keys.
 */

const ANTHROPIC = "sk-ant-fake_CLI_DO_NOT_PRINT_wxyz";
const GEMINI = "fake-gemini-acme_CLI_DO_NOT_PRINT_1234567890gemi";
const SECRETS = [ANTHROPIC, GEMINI];
const priya = { id: "usr_priya", name: "Priya" };
const CANVAS = "prj_acme_cli_keys";

let home: string;
let daemon: Daemon;
let base: string;
const asked: Array<{ url: string; key: string | null }> = [];
const runs: Run[] = [];
const saved: Record<string, string | undefined> = {};
const SPENDER_ENV = ["TYPESAFE_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL", "GEMINI_API_KEY"];

/** The child's environment: this home, and none of the runner's own keys. */
const env = (extra: NodeJS.ProcessEnv = {}) =>
  cliEnv({ ISOCAN_HOME: home, ...Object.fromEntries(SPENDER_ENV.map((n) => [n, undefined])), ...extra });

const keys = async (args: string[], extra: NodeJS.ProcessEnv = {}) => {
  const run = await runCli(["keys", ...args], { env: env(extra), cwd: home });
  runs.push(run);
  return run;
};
const setFromStdin = async (provider: string, input: string) => {
  const run = await runCliWithInput(["keys", "set", provider], input, { env: env(), cwd: home });
  runs.push(run);
  return run;
};

beforeAll(async () => {
  for (const name of SPENDER_ENV) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-cli-keys-"));
  // Priya is this machine's person: its stored keys pay for her (owner-only spend, keys phase 3).
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  const fake = (async (url: string, init: RequestInit) => {
    asked.push({ url, key: new Headers(init.headers).get("x-api-key") });
    return new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: CLAUDE_TEXT_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ heading: "Acme" }) }] }), { status: 200 });
  }) as unknown as typeof fetch;
  // The daemon is given a transport and NO key: its key is whatever its home's keys.json says, per call.
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", text: { fetch: fake } });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await daemon?.close();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const name of SPENDER_ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  // The rule of the whole project, checked over everything every run printed.
  for (const run of runs) for (const secret of SECRETS) {
    expect(run.stdout).not.toContain(secret);
    expect(run.stderr).not.toContain(secret);
  }
});

describe("isocan keys", () => {
  it("spells the registry's providers in its help, which is written before the registry loads", () => {
    expect(KEYS_HELP_PROVIDERS).toBe(KEY_PROVIDERS.join(", "));
  });

  it("refuses a key on the command line, in a sentence, and stores nothing", async () => {
    const run = await keys(["set", "anthropic", ANTHROPIC]);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/refusing a key on the command line/);
    expect(run.stderr).toMatch(/nothing was stored/);
    await expect(fsp.stat(path.join(home, "keys.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a provider it does not know, naming the ones it does", async () => {
    const run = await keys(["rm", "acme-ai"]);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/anthropic, openai, gemini, typesafe/);
  });

  it("is the phase's proof: set from stdin, and a running daemon's /api/text spends it on the next request", async () => {
    const owner = await mintTestBadge(base);
    await owner.speakAs(priya);
    const made = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...owner.headers },
      body: JSON.stringify({ canvasId: null, actor: priya, op: { type: "project.create", canvasId: CANVAS, title: "Acme Keys" } }),
    });
    expect(made.ok).toBe(true);
    const ask = () =>
      fetch(`${base}${TEXT_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...owner.headers },
        body: JSON.stringify({ canvasId: CANVAS, prompt: "Acme's heading.", schema: { type: "object", properties: { heading: { type: "string" } }, required: ["heading"], additionalProperties: false } }),
      });

    expect((await ask()).status).toBe(503);

    const set = await setFromStdin("anthropic", `${ANTHROPIC}\n`);
    expect(set.code, set.stderr).toBe(0);
    expect(set.stdout).toContain("anthropic: stored …wxyz");
    expect((await fsp.stat(path.join(home, "keys.json"))).mode & 0o777).toBe(0o600);

    const res = await ask();
    const body = await res.text();
    expect(res.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual({ model: CLAUDE_TEXT_MODEL, value: { heading: "Acme" } });
    expect(asked.at(-1)!.key).toBe(ANTHROPIC);
    expect(body).not.toContain(ANTHROPIC);
  });

  it("share on lets a collaborator spend the stored key on the running daemon; off refuses them by the owner's name", async () => {
    const ravi = await mintTestBadge(base);
    await ravi.speakAs({ id: "usr_ravi", name: "Ravi" });
    const ask = async () => {
      const res = await fetch(`${base}${TEXT_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ravi.headers },
        body: JSON.stringify({ canvasId: CANVAS, prompt: "Acme's heading.", schema: { type: "object", properties: { heading: { type: "string" } }, required: ["heading"], additionalProperties: false } }),
      });
      return { status: res.status, body: (await res.json()) as { code?: string; error?: string } };
    };
    const askedBefore = asked.length;
    const refused = await ask();
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe("text-owner-only");
    expect(refused.body.error).toMatch(/^Priya's keys pay only for Priya here/);
    expect(asked.length).toBe(askedBefore);

    const on = await keys(["share", "on"]);
    expect(on.code, on.stderr).toBe(0);
    expect(on.stdout).toMatch(/^sharing on/);
    expect((await ask()).status).toBe(200);
    expect(asked.length).toBe(askedBefore + 1);
    expect(JSON.parse((await keys(["ls", "--json"])).stdout)).toMatchObject({ share: true });

    const off = await keys(["share", "off"]);
    expect(off.stdout).toMatch(/^sharing off/);
    expect((await ask()).status).toBe(403);
    expect((await keys(["ls"])).stdout).toMatch(/sharing off/);
    expect((await keys(["share", "maybe"])).code).toBe(1);
  });

  it("ls: set or not, the last four, what uses it — and never the value, in either output", async () => {
    await setFromStdin("gemini", GEMINI);
    const run = await keys(["ls"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/anthropic\s+…wxyz/);
    expect(run.stdout).toMatch(/gemini\s+…gemi/);
    expect(run.stdout).toMatch(/openai\s+not set/);
    expect(run.stdout).toMatch(/the text model/);
    const bare = await keys([]);
    expect(bare.stdout).toBe(run.stdout);

    const json = await keys(["ls", "--json"]);
    const parsed = JSON.parse(json.stdout) as { keys: Array<{ provider: string; stored: boolean; lastFour: string | null; inUse: string | null }> };
    expect(parsed.keys.find((k) => k.provider === "anthropic")).toMatchObject({ stored: true, lastFour: "…wxyz", inUse: "file" });
    expect(parsed.keys.find((k) => k.provider === "typesafe")).toMatchObject({ stored: false, inUse: null });
  });

  it("ls says when the environment overrides the stored key", async () => {
    const run = await keys(["ls", "--json"], { GEMINI_API_KEY: "fake-gemini-acme-env-override-9999" });
    const parsed = JSON.parse(run.stdout) as { keys: Array<{ provider: string; env: { variable: string; lastFour: string } | null; inUse: string }> };
    expect(parsed.keys.find((k) => k.provider === "gemini")).toMatchObject({ env: { variable: "GEMINI_API_KEY", lastFour: "…9999" }, inUse: "env" });
    expect(run.stdout).not.toContain("fake-gemini-acme-env-override-9999");
  });

  it("test with no key says how to set one", async () => {
    const run = await keys(["test", "typesafe"]);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/no typesafe key here — `isocan keys set typesafe`/);
  });

  it("rm removes one provider and keeps the rest", async () => {
    const run = await keys(["rm", "gemini"]);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("gemini: removed");
    expect((await keys(["rm", "gemini"])).stdout).toContain("nothing to remove");
    const parsed = JSON.parse((await keys(["ls", "--json"])).stdout) as { keys: Array<{ provider: string; stored: boolean }> };
    expect(parsed.keys.filter((k) => k.stored).map((k) => k.provider)).toEqual(["anthropic"]);
  });

  it("ls refuses a keys.json that leaked its mode — exit 1, and the sentence says why", async () => {
    await fsp.chmod(path.join(home, "keys.json"), 0o644);
    const run = await keys(["ls"]);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/mode 644, not 600 — refusing to read it/);
    await fsp.chmod(path.join(home, "keys.json"), 0o600);
  });
});
