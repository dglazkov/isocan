import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { actorKinds } from "@isocan/core";
import { FileStore } from "../src/file-store.ts";
import * as p from "../src/paths.ts";

/**
 * **A home from before `harnesses` learns them from its own claims log.**
 * The registry snapshot on disk names its actors and knows nothing of how
 * they claimed; the log beside it has every claim with its session key. On
 * first load the store folds the harness back in and saves — once — so a
 * Canny who spoke last week reads as an agent today without claiming again.
 */
let home: string;

const claim = (seq: number, id: string, name: string, sessionKey: string) =>
  JSON.stringify({
    seq,
    envelope: {
      id: `op_${seq}`,
      canvasId: null,
      actor: { id, name },
      ts: `2026-09-0${seq}T00:00:00.000Z`,
      op: { type: "actor.claim", sessionKey, name },
    },
    inverse: null,
  });

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-backfill-"));
  await fs.mkdir(path.dirname(p.actorsFile(home)), { recursive: true });
  await fs.writeFile(
    p.actorsFile(home),
    JSON.stringify({
      lastSeq: 2,
      names: { usr_c: { name: "Canny", at: "2026-09-01T00:00:00.000Z" }, usr_d: { name: "Di", at: "2026-09-02T00:00:00.000Z" } },
      colors: {},
      marks: {},
      joined: {},
    }),
  );
  await fs.writeFile(p.actorsLogFile(home), `${claim(1, "usr_c", "Canny", "claude-code:s-1")}\n${claim(2, "usr_d", "Di", "web:per-1")}\n`);
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe("the harness backfill", () => {
  it("folds every logged claim's harness into a registry that never had the field, and saves it", async () => {
    const { registry, lastSeq } = await new FileStore(home).loadActors();
    expect(lastSeq).toBe(2);
    expect(registry.harnesses).toEqual({ usr_c: "claude-code", usr_d: "web" });
    expect(actorKinds(registry)).toEqual({ usr_c: "agent" });
    // Names were not disturbed by replaying claims the snapshot had folded.
    expect(registry.names.usr_c?.name).toBe("Canny");
    const saved = JSON.parse(await fs.readFile(p.actorsFile(home), "utf8")) as { harnesses?: Record<string, string> };
    expect(saved.harnesses).toEqual({ usr_c: "claude-code", usr_d: "web" });
  });

  it("runs once: a registry that has the field, even empty, is not replayed", async () => {
    await fs.writeFile(
      p.actorsFile(home),
      JSON.stringify({ lastSeq: 2, names: { usr_c: { name: "Canny", at: "2026-09-01T00:00:00.000Z" } }, colors: {}, marks: {}, joined: {}, harnesses: {} }),
    );
    const { registry } = await new FileStore(home).loadActors();
    expect(registry.harnesses).toEqual({});
  });
});
