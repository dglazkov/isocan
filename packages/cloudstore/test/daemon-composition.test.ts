import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "@isocan/server";
import { CloudDesk } from "../src/cloud-desk.ts";
import { CloudStore } from "../src/cloud-store.ts";
import { cloudGate, demoProjectId, requireEmulator } from "./cloud-fixture.ts";

/**
 * `ISOCAN_STORE=cloud` actually composes.
 *
 * The composition root reaches this package by DYNAMIC import, which is what
 * keeps ~43 MiB of Google client libraries out of every `npm i -g …#release`.
 * The price of that, stated in `daemon.ts`, is that a typo in the specifier
 * would be a runtime error at daemon start rather than a compile error. This
 * is the two-minute test that buys it back — and it also pins the rest of the
 * contract: environment selects the backing, not a flag, because an
 * innkeeper's choice of disk is configuration and a `--store` flag would be a
 * surface an agent could reach for and misuse.
 *
 * Deliberately narrow: it composes and it answers. It does NOT create a
 * canvas, because a snapshot flush would reach for a real bucket, and this
 * phase provisions nothing.
 */

const gate = cloudGate();

if (!gate.ok && requireEmulator()) {
  describe("ISOCAN_STORE=cloud", () => {
    it("the Firestore emulator is REQUIRED here and is not available", () => {
      throw new Error(`ISOCAN_REQUIRE_EMULATOR=1, but this suite cannot run: ${gate.skip}.`);
    });
  });
} else {
  const test = gate.ok ? it : it.skip;
  const title = gate.ok
    ? "ISOCAN_STORE=cloud — the composition root"
    : `ISOCAN_STORE=cloud — the composition root [SKIPPED: ${gate.skip}]`;

  describe(title, () => {
    let home: string;
    let daemon: Daemon | null = null;
    const saved = { ...process.env };

    beforeEach(async () => {
      home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cloud-daemon-"));
      process.env.ISOCAN_STORE = "cloud";
      process.env.ISOCAN_GCP_PROJECT = demoProjectId();
      process.env.ISOCAN_BUCKET = "isocan-test-bucket";
    });

    afterEach(async () => {
      await daemon?.close();
      daemon = null;
      process.env.ISOCAN_STORE = saved.ISOCAN_STORE ?? "";
      if (!saved.ISOCAN_STORE) delete process.env.ISOCAN_STORE;
      delete process.env.ISOCAN_GCP_PROJECT;
      delete process.env.ISOCAN_BUCKET;
      await fs.rm(home, { recursive: true, force: true });
    });

    test("builds a daemon on CloudStore and CloudDesk, and answers", async () => {
      daemon = await startDaemon({ port: await reservePort(), home });
      expect(daemon.store).toBeInstanceOf(CloudStore);
      expect(daemon.desk).toBeInstanceOf(CloudDesk);

      const address = daemon.app.server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      expect(((await health.json()) as { ok: boolean }).ok).toBe(true);
    });

    test("refuses to start a cloud home with no bucket, rather than guessing one", async () => {
      delete process.env.ISOCAN_BUCKET;
      await expect(startDaemon({ port: await reservePort(), home })).rejects.toThrow(/ISOCAN_BUCKET/);
    });

    test("without ISOCAN_STORE it is still a file home — the default never moved", async () => {
      delete process.env.ISOCAN_STORE;
      daemon = await startDaemon({ port: await reservePort(), home });
      expect(daemon.store).not.toBeInstanceOf(CloudStore);
      expect(daemon.desk).not.toBeInstanceOf(CloudDesk);
    });
  });
}
