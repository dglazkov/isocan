import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ActorRegistry } from "@isocan/core";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";

/**
 * **A roster from another home changes one field and keeps the rest.**
 *
 * `mergeRemoteIdentity` is how a name or colour chosen at one home reaches a
 * replica that talks to it. It used to rebuild the registry as
 * `{ names, colors }`, so the first roster that changed anything dropped every
 * other field — marks, joins, harnesses — in memory and in `actors.json`, and
 * a restart could not bring them back because the snapshot's `lastSeq` said
 * the log had already been folded. The same shape as the cloud store's
 * `saveActors` dropping `marks`: a writer that lists the fields it knows.
 */

let home: string;
let store: FileStore;
let desk: FileDesk;

const seeded = (): ActorRegistry => ({
  names: { usr_a: { name: "Acme", at: "2026-01-01T00:00:00.000Z" }, usr_b: { name: "Test", at: "2026-01-01T00:00:00.000Z" } },
  colors: { usr_a: "#112233" },
  marks: { usr_a: "🦊" },
  joined: { usr_old: "usr_a" },
  harnesses: { usr_b: "claude-code" },
});

async function open(): Promise<Engine> {
  store = new FileStore(home);
  await store.init();
  desk = new FileDesk(home);
  await desk.init();
  return new Engine(store, desk);
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-remote-identity-"));
  const first = new FileStore(home);
  await first.init();
  await first.saveActors(seeded(), 0);
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("mergeRemoteIdentity", () => {
  it("changes the colour it was sent and keeps every other field, across a restart", async () => {
    const engine = await open();
    await engine.mergeRemoteIdentity({ usr_a: "#445566" }, { usr_b: "Test 2" });

    const expectWhole = async (reader: Engine) => {
      expect((await reader.actorColors())["usr_a"]).toBe("#445566");
      expect((await reader.actorNames())["usr_b"]).toBe("Test 2");
      // The folded id wears the person's mark too — the join is read back.
      expect(await reader.actorMarks()).toEqual({ usr_a: "🦊", usr_old: "🦊" });
      expect(await reader.actorJoins()).toEqual({ usr_old: "usr_a" });
      expect(await reader.actorKinds()).toEqual({ usr_b: "agent" });
    };
    await expectWhole(engine);

    // On disk, every field of the registry the seed wrote is still there.
    const { registry } = await new FileStore(home).loadActors();
    expect(Object.keys(registry).sort()).toEqual(Object.keys(seeded()).sort());
    expect(registry.marks).toEqual(seeded().marks);
    expect(registry.joined).toEqual(seeded().joined);
    expect(registry.harnesses).toEqual(seeded().harnesses);

    // And a restarted engine reads them back.
    await expectWhole(await open());
  });
});
