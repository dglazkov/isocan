import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { googleDocExportUrl, googleDriveExportUrl, googleDriveMetaUrl } from "@isocan/core";
import {
  DocRefusal,
  clearGoogleToken,
  driveModifiedTime,
  fetchGoogleDoc,
  googleTokenFile,
  readGoogleToken,
  writeGoogleToken,
} from "../src/google.ts";

/**
 * **A Drive token on the machine, never on the canvas** (Google Docs stage
 * 3). The file is one secret under the home with a tight mode; the fetch
 * spends it only after the anonymous door refused; a refusal says what to
 * do, and says how old the token is when that is the likely reason.
 */
const ID = "1PrivateDocPrivateDocPrivateDoc";
let home: string;
const realFetch = globalThis.fetch;
const html = () => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } });
const md = (text: string) => new Response(text, { headers: { "content-type": "text/markdown" } });

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-google-"));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(home, { recursive: true, force: true });
});

describe("the token file", () => {
  it("is written mode 600, read back trimmed, and cleared", async () => {
    expect(await readGoogleToken(home)).toBeNull();
    await writeGoogleToken(home, "  ya29.secret  ", "di@example.com");
    const stat = await fs.stat(googleTokenFile(home));
    expect(stat.mode & 0o777).toBe(0o600);
    const read = await readGoogleToken(home);
    expect(read?.token).toBe("ya29.secret");
    expect(read?.account).toBe("di@example.com");
    expect(Date.parse(read!.savedAt)).not.toBeNaN();
    expect(await clearGoogleToken(home)).toBe(true);
    expect(await readGoogleToken(home)).toBeNull();
    expect(await clearGoogleToken(home)).toBe(false);
  });
});

describe("fetching a doc through whichever door opens", () => {
  const calls: { url: string; auth: string | null }[] = [];
  const stub = (answers: Record<string, () => Response>) =>
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, auth: headers.Authorization ?? null });
      const answer = answers[url];
      return answer ? Promise.resolve(answer()) : realFetch(input, init);
    });
  beforeEach(() => { calls.length = 0; });

  it("takes the anonymous export when it answers, and spends no token on it", async () => {
    stub({ [googleDocExportUrl(ID)]: () => md("# Public\n") });
    const doc = await fetchGoogleDoc(ID, { token: "t", savedAt: new Date().toISOString() });
    expect(doc.via).toBe("anonymous");
    expect(doc.title).toBe("Public");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.auth).toBeNull();
  });

  it("falls through to Drive with the bearer token when the anonymous door is a sign-in page", async () => {
    stub({ [googleDocExportUrl(ID)]: html, [googleDriveExportUrl(ID)]: () => md("# Private\n\nWords.\n") });
    const doc = await fetchGoogleDoc(ID, { token: "ya29.x", savedAt: new Date().toISOString() });
    expect(doc.via).toBe("drive");
    expect(doc.title).toBe("Private");
    expect(calls[1]!.auth).toBe("Bearer ya29.x");
  });

  it("refuses in words with no token, and names the token's age when Drive refuses it", async () => {
    stub({ [googleDocExportUrl(ID)]: html, [googleDriveExportUrl(ID)]: () => new Response("no", { status: 401 }) });
    await expect(fetchGoogleDoc(ID, null)).rejects.toMatchObject({ code: "doc-not-public" });
    const stale = { token: "old", savedAt: new Date(Date.now() - 3 * 3600e3).toISOString() };
    const err = await fetchGoogleDoc(ID, stale).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DocRefusal);
    expect((err as DocRefusal).code).toBe("token-refused");
    expect((err as DocRefusal).message).toMatch(/saved 18\d minutes ago/);
    expect((err as DocRefusal).message).toContain("isocan gdoc auth --stdin");
  });

  it("asks Drive when the doc last moved, and only with a token", async () => {
    stub({ [googleDriveMetaUrl(ID)]: () => new Response(JSON.stringify({ modifiedTime: "2026-09-03T10:00:00.000Z" }), { headers: { "content-type": "application/json" } }) });
    expect(await driveModifiedTime(ID, null)).toBeNull();
    expect(await driveModifiedTime(ID, { token: "t", savedAt: "" })).toBe("2026-09-03T10:00:00.000Z");
  });
});
