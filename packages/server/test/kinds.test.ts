import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTOR_KINDS_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The canvas knows who is an agent.** A claim's session key names its
 * harness; the daemon now writes that into the registry and serves it, so
 * the fact outlives the session. People claim from `web:` and `home:`;
 * everything else is an agent.
 */
let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-kinds-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe(`GET ${ACTOR_KINDS_ROUTE}`, () => {
  it("names the agents by the harness they claimed from, and leaves people out", async () => {
    await badge.speakAs({ id: "usr_di", name: "Di" }, "web:per-1");
    await badge.speakAs({ id: "usr_canny", name: "Canny" }, "claude-code:s-1");
    await badge.speakAs({ id: "usr_board", name: "Board" }, "board:isocan-board");
    const res = await fetch(`${base}${ACTOR_KINDS_ROUTE}`, { headers: badge.headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ usr_canny: "agent", usr_board: "agent" });
  });

  it("survives a restart — the fact is in the registry, not the session", async () => {
    await badge.speakAs({ id: "usr_canny", name: "Canny" }, "codex:s-9");
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const again = await mintTestBadge(base);
    const res = await fetch(`${base}${ACTOR_KINDS_ROUTE}`, { headers: again.headers });
    expect(await res.json()).toEqual({ usr_canny: "agent" });
  });
});
