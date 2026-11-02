import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ApiError } from "@isocan/api";
import { spawn } from "node:child_process";
import { adoptRcAgent, readRcAgents, setRcSessionId, upsertRcAgent, withPreparedRcAgent, type RcAgentRow } from "../src/rc.ts";

let home: string;
const row: RcAgentRow = { canvasId: "prj_test", actorId: "usr_test", name: "Acme designer", harness: "fake", cwd: "/prepared", sessionId: null };
beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-records-")); });
afterEach(async () => { await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

describe("prepared enrolment configuration", () => {
  it("publishes only after adoption and dispatch can read the prepared directory", async () => {
    await withPreparedRcAgent(home, row, async () => {
      expect(await adoptRcAgent(home, { ...row, cwd: "/rc-default", harness: null })).toBe(false);
      expect(await readRcAgents(home)).toMatchObject([{ cwd: "/prepared", harness: "fake" }]);
    });
    expect(await readRcAgents(home)).toEqual([row]);
  });

  it("refusal removes a new row and restores the previous configuration", async () => {
    const refuse = async () => { throw new ApiError(403, "enrolment refused"); };
    await expect(withPreparedRcAgent(home, row, refuse)).rejects.toThrow("enrolment refused");
    expect(await readRcAgents(home)).toEqual([]);
    const previous = { ...row, cwd: "/previous", sessionId: "session-old" };
    await upsertRcAgent(home, previous);
    await expect(withPreparedRcAgent(home, row, refuse)).rejects.toThrow("enrolment refused");
    expect(await readRcAgents(home)).toEqual([previous]);
  });

  it("refusal cannot replace a concurrent configuration or session update", async () => {
    await expect(withPreparedRcAgent(home, row, async () => {
      await upsertRcAgent(home, { ...row, cwd: "/newer" });
      throw new ApiError(403, "refused");
    })).rejects.toThrow("refused");
    expect(await readRcAgents(home)).toEqual([{ ...row, cwd: "/newer" }]);
    await expect(withPreparedRcAgent(home, row, async () => {
      await setRcSessionId(home, row.canvasId, row.actorId, "session-new");
      throw new ApiError(403, "refused");
    })).rejects.toThrow("refused");
    expect(await readRcAgents(home)).toEqual([{ ...row, sessionId: "session-new" }]);
  });

  it("an uncertain receipt preserves prepared configuration and a missing home is created", async () => {
    const nested = path.join(home, "new-home");
    await expect(withPreparedRcAgent(nested, row, async () => { throw new TypeError("socket closed"); })).rejects.toThrow("socket closed");
    expect(await readRcAgents(nested)).toEqual([row]);
    await expect(withPreparedRcAgent(nested, { ...row, cwd: "/remote-accepted" }, async () => { throw new ApiError(409, "local replica append fenced"); })).rejects.toThrow("fenced");
    expect(await readRcAgents(nested)).toEqual([{ ...row, cwd: "/remote-accepted" }]);
  });

  it("independent CLI processes updating the file preserve every row", async () => {
    const source = new URL("../src/rc.ts", import.meta.url).href;
    await Promise.all(Array.from({ length: 6 }, async (_, n) => {
      const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
        `import { upsertRcAgent } from ${JSON.stringify(source)}; await upsertRcAgent(${JSON.stringify(home)}, ${JSON.stringify({ ...row, actorId: `usr_${n}` })});`], { stdio: "pipe" });
      let stderr = "";
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
      expect(code, stderr).toBe(0);
    }));
    expect((await readRcAgents(home)).map((r) => r.actorId).sort()).toEqual(Array.from({ length: 6 }, (_, n) => `usr_${n}`));
  });
});
