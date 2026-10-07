import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cliEnv, runCli } from "./cli.ts";

/**
 * **`isocan model`** (local-judge phase 0), against the real binary: `ls`
 * reads the manifest and this home's `models/`, and `fetch` refuses a name
 * the manifest does not know before it touches the network. The download
 * itself — atomic, hash-checked, partial deleted — is `fetchModelFile`'s, and
 * is tested in `packages/core/test/local-judge.test.ts` with a synthetic
 * model, so nothing here downloads 164 MB.
 */

let home: string;
beforeAll(async () => {
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-cli-model-"));
});
afterAll(async () => {
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
const env = () => cliEnv({ ISOCAN_HOME: home });

describe("isocan model", () => {
  it("lists the manifest model as absent in a fresh home, as JSON and as a table", async () => {
    const json = await runCli(["model", "ls", "--json"], { env: env() });
    expect(json.code, json.stderr).toBe(0);
    const out = JSON.parse(json.stdout) as { dir: string; models: Array<{ name: string; present: boolean; expected: number }> };
    expect(out.dir).toBe(path.join(home, "models"));
    expect(out.models).toEqual([expect.objectContaining({ name: "embeddinggemma-2-text-270m", present: false, expected: 164_626_432 })]);

    const table = await runCli(["model"], { env: env() });
    expect(table.code, table.stderr).toBe(0);
    expect(table.stdout).toContain("embeddinggemma-2-text-270m");
    expect(table.stdout).toContain("isocan model fetch embeddinggemma-2-text-270m");
  });

  it("refuses an unknown name in words, naming the models there are, and writes nothing", async () => {
    const run = await runCli(["model", "fetch", "acme-unknown"], { env: env() });
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('no model called "acme-unknown" — the models isocan knows are embeddinggemma-2-text-270m');
    await expect(fsp.readdir(path.join(home, "models"))).rejects.toThrow();
  });
});
