import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DOC_EXPORT_ROUTE, googleDocExportUrl } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **A Google Doc's markdown, fetched for the app**
 * (`docs/research/2026-09-02-google-docs-on-the-canvas.md`, stage 2). The
 * daemon reads docs.google.com because a browser cannot; it does so only
 * for an address core recognises as a doc, and it refuses a sign-in page —
 * what Google answers for a private doc — instead of handing it back as the
 * document. Google is stood in for here: the real fetch is kept for the
 * daemon's own address, and docs.google.com answers from the table below.
 */
const ID = "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE";
const PRIVATE = "1PrivateDocPrivateDocPrivateDoc";

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-docexport-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === googleDocExportUrl(ID)) {
      return Promise.resolve(
        new Response("# Sample doc\n\nHello.\n", { headers: { "content-type": "text/markdown; charset=utf-8" } }),
      );
    }
    if (url === googleDocExportUrl(PRIVATE)) {
      return Promise.resolve(new Response("<html>Sign in</html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
    }
    return realFetch(input, init);
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

const ask = (url: string) => fetch(`${base}${DOC_EXPORT_ROUTE}?url=${encodeURIComponent(url)}`, { headers: badge.headers });

describe("GET /api/docs/export", () => {
  it("hands back a public doc's markdown, its address and a title", async () => {
    const res = await ask(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; source: string; markdown: string; title: string; fetchedAt: string };
    expect(body.id).toBe(ID);
    expect(body.source).toBe(`https://docs.google.com/document/d/${ID}/edit`);
    expect(body.markdown).toContain("Hello.");
    expect(body.title).toBe("Sample doc");
    expect(Date.parse(body.fetchedAt)).not.toBeNaN();
  });

  it("refuses a sign-in page in words, rather than calling it the document", async () => {
    const res = await ask(`https://docs.google.com/document/d/${PRIVATE}/edit`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("doc-not-public");
    expect(body.error).toContain("share it by link");
  });

  it("is not a proxy: anything that is not a doc's address is refused before any fetch", async () => {
    const res = await ask("https://example.com/document/d/abcdefghijklmnopqrstuvwxyz/edit");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("not-a-doc");
  });
});
