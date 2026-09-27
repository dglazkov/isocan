import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { WS_CLOSE_REASON_BYTES } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { closeReason } from "../src/ws.ts";
import { currentSocketUrl, mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **One bad input costs one connection, never the process** (cleanup phase 1,
 * TS-1 and TS-2).
 *
 * Node 24 exits on an unhandled rejection, and `ws.ts` is a file of voided
 * promises: the upgrade handler, the connection, the roster timer. Each case
 * here is a failure that used to escape one of them — a close reason too long
 * for the frame, a desk that rejects mid-admission, a roster that cannot be
 * read — and each asserts what the failure costs NOW: a socket closed with a
 * code and words, or a line on stderr, and a process still standing.
 *
 * `rejections` is the process-level half of that. Vitest reports an escaped
 * rejection too, but only after the file; collecting them here makes the case
 * that caused one fail by name.
 */

const usrA = { id: "usr_a", name: "A" };
const CANVAS = "prj_acme";

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;
const rejections: unknown[] = [];
const onRejection = (reason: unknown) => void rejections.push(reason);

beforeEach(async () => {
  rejections.length = 0;
  process.on("unhandledRejection", onRejection);
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-socket-failures-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(usrA);
  const created = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId: null, actor: usrA, op: { type: "project.create", canvasId: CANVAS, title: "Acme" } }),
  });
  expect(created.status).toBe(200);
});

afterEach(async () => {
  process.off("unhandledRejection", onRejection);
  vi.restoreAllMocks();
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Dial the canvas and wait for the home to hang up — or say that it never did,
 * which is what a connection whose close threw looks like from outside. */
async function closeOf(ms = 5_000): Promise<{ code: number; reason: string } | "never closed"> {
  const ws = new WebSocket(currentSocketUrl(`${base.replace("http", "ws")}/ws?canvasId=${CANVAS}`), {
    headers: badge.headers,
  });
  ws.on("error", () => {});
  try {
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve("never closed"), ms);
      ws.on("close", (code, reason) => {
        clearTimeout(timer);
        resolve({ code, reason: String(reason) });
      });
    });
  } finally {
    ws.terminate();
  }
}

/** What Firestore says when it is having a bad minute: the shape that took a
 * Cloud Run instance down, well past the 123 bytes a close frame carries. */
const unavailable = () =>
  new Error(
    "14 UNAVAILABLE: No connection established. Last error: connect ETIMEDOUT 142.250.0.95:443 " +
      "(while reading projects/acme/databases/(default)/documents/canvases/prj_acme). ".repeat(3),
  );

describe("closeReason: whatever the words, the frame can carry them", () => {
  it("passes a short reason through untouched", () => {
    expect(closeReason("canvasId query parameter required")).toBe("canvasId query parameter required");
  });

  it("cuts a long one to the protocol's limit, and says it was cut", () => {
    const long = String(unavailable());
    expect(Buffer.byteLength(long)).toBeGreaterThan(WS_CLOSE_REASON_BYTES);
    const cut = closeReason(long);
    expect(Buffer.byteLength(cut)).toBeLessThanOrEqual(WS_CLOSE_REASON_BYTES);
    expect(cut.startsWith("Error: 14 UNAVAILABLE")).toBe(true);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("counts bytes, not characters, and never splits one", () => {
    // 60 characters, 240 bytes: a length check in characters would pass it.
    const wide = "🎨".repeat(30) + "é".repeat(30);
    const cut = closeReason(wide);
    expect(Buffer.byteLength(cut)).toBeLessThanOrEqual(WS_CLOSE_REASON_BYTES);
    // A split code point would not survive the round trip through UTF-8.
    expect(Buffer.from(cut, "utf8").toString("utf8")).toBe(cut);
    expect(cut).not.toContain("�");
  });
});

describe("a failure while a socket opens costs that socket", () => {
  it("a long store error closes 4500 with a reason the frame can carry (TS-1)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    daemon.engine.getSnapshot = async () => {
      throw unavailable();
    };
    const closed = await closeOf();
    expect(rejections.map(String)).toEqual([]);
    expect(closed).toMatchObject({ code: 4500, reason: expect.stringMatching(/^Error: 14 UNAVAILABLE/) });
    if (closed !== "never closed") expect(Buffer.byteLength(closed.reason)).toBeLessThanOrEqual(WS_CLOSE_REASON_BYTES);
  });

  it("a desk that rejects during admission closes 4500, and says so on stderr (TS-2)", async () => {
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    daemon.desk.touch = async () => {
      throw new Error("the desk is unavailable");
    };
    const closed = await closeOf();
    expect(rejections.map(String)).toEqual([]);
    expect(closed).toMatchObject({ code: 4500, reason: expect.stringContaining("the desk is unavailable") });
    expect(said.mock.calls.flat().map(String).join("\n")).toContain("the desk is unavailable");
  });
});

describe("a roster that cannot be read is skipped, and said once (TS-2)", () => {
  it("does not escape the timer that builds it", async () => {
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    daemon.engine.actorColors = async () => {
      throw unavailable();
    };
    // Three changes, three rosters attempted (40 ms apart, past the coalescing).
    for (let i = 0; i < 3; i++) {
      daemon.presence.createSession(CANVAS, usrA, "web", { sessionId: `ses_${i}` });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    expect(rejections.map(String)).toEqual([]);
    const lines = said.mock.calls.map((call) => call.map(String).join(" ")).filter((line) => line.includes("roster"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("14 UNAVAILABLE");
  });
});
