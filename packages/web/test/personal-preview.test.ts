import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DOOR_ROUTE, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { automaticSource, sourceSnapshot, sourcePicture, personalApi } from "../src/lib/personal.ts";

import { sourceRecap } from "../src/lib/context-recap.ts";

import { onReBadge } from "../src/lib/api.ts";

beforeEach(() => vi.stubGlobal("window", { location: { origin: "http://replica.test" } }));
afterEach(() => { onReBadge(async () => {}); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("automatic edges use destination authority and actual source GETs retain exclusion and expected home", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: "http://authority.test" }, links: [], birth: null });
    if (url.startsWith("/api/source-classification")) return Response.json({ kind: "ordinary" });
    return Response.json({ canvas: { items: {} }, project: { id: "prj_source" } });
  }));
  expect(await automaticSource("prj_source", "http://authority.test/p/prj_source", "prj_dest")).toEqual({ kind: "ordinary", expectedHome: "http://authority.test" });
  expect(new URL(calls[1]!.url, "http://replica.test").searchParams.get("expectedHome")).toBe("http://authority.test");
  await sourceSnapshot({ canvasId: "prj_source", expectedHome: "http://authority.test" });
  const headers = calls.at(-1)!.init?.headers as Record<string, string>;
  expect(parseSourcePolicyHeader(headers[SOURCE_POLICY_HEADER]!)).toEqual({ policy: { mode: "exclude" }, expectedHome: "http://authority.test" });
});
it("unknown authority and foreign/forged addresses cannot fall through to a local successful preview", async () => {
  const fetch = vi.fn(async () => Response.json({ canvases: {}, links: [], birth: null })); vi.stubGlobal("fetch", fetch);
  await expect(automaticSource("prj_private", null, "prj_dest")).rejects.toThrow("authoritative home is unknown");
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockImplementation(async () => Response.json({ canvases: { prj_dest: null }, links: [], birth: null }));
  expect((await automaticSource("prj_private", "http://foreign.test/p/prj_private", "prj_dest")).kind).toBe("unavailable");
  expect((await automaticSource("prj_private", "http://replica.test/p/prj_other", "prj_dest")).kind).toBe("unavailable");
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("destination-scoped birth and personal reading carry only the explicit caller and abort signal", async () => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({})); vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await personalApi.ensurePersonal("usr_rowan", signal, "prj_remote");
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ actorId: "usr_rowan", destinationCanvasId: "prj_remote" });
  expect(fetch.mock.calls[0]![1]!.signal).toBe(signal);
  await personalApi.readPersonal("prj_remote", { actorId: "usr_rowan", itemId: "itm_link", mode: "content" }, signal);
  expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({ actorId: "usr_rowan", itemId: "itm_link", mode: "content" });
});

it.each(["snapshot", "picture", "recap"] as const)("source %s recovers its badge and claim once without dropping exclusion or cancellation", async (kind) => {
  const control = new AbortController();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const reclaim = vi.fn(async () => {}); onReBadge(reclaim);
  let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (url === DOOR_ROUTE) return Response.json({});
    if (++reads === 1) return Response.json({ error: "badge expired" }, { status: 401 });
    return kind === "recap" ? Response.json({ canvasId: "prj_source", head: { count: 1 } }) : kind === "snapshot" ? Response.json({ project: { id: "prj_source" }, canvas: { items: {} } }) : new Response("ordinary image");
  }));
  const result = kind === "recap" ? await sourceRecap({ canvasId: "prj_source", expectedHome: "http://authority.test" }, control.signal) : kind === "snapshot" ? await sourceSnapshot({ canvasId: "prj_source", expectedHome: "http://authority.test" }, control.signal) : await sourcePicture("prj_source", "hash_image", "http://authority.test", control.signal);
  expect(result).toBeTruthy(); expect(reclaim).toHaveBeenCalledTimes(1);
  const requests = calls.filter((call) => call.url !== DOOR_ROUTE); expect(requests).toHaveLength(2);
  if (kind === "recap") expect(requests.map((request) => request.url)).toEqual(["/api/projects/prj_source/context/recap", "/api/projects/prj_source/context/recap"]);
  for (const request of requests) {
    expect(request.init?.signal).toBe(control.signal);
    expect(parseSourcePolicyHeader((request.init?.headers as Record<string, string>)[SOURCE_POLICY_HEADER]!)).toEqual({ policy: { mode: "exclude" }, expectedHome: "http://authority.test" });
  }
});
it.each(["snapshot", "picture", "recap"] as const)("aborting a source %s during badge recovery prevents its retry", async (kind) => {
  const control = new AbortController();
  let release!: (response: Response) => void, reached!: () => void;
  const entered = new Promise<void>((resolve) => { reached = resolve; });
  const fetch = vi.fn((url: string) => url === DOOR_ROUTE ? new Promise<Response>((resolve) => { release = resolve; reached(); }) : Promise.resolve(Response.json({}, { status: 401 })));
  vi.stubGlobal("fetch", fetch);
  const pending = kind === "recap" ? sourceRecap({ canvasId: "prj_source", expectedHome: "http://authority.test" }, control.signal) : kind === "snapshot" ? sourceSnapshot({ canvasId: "prj_source", expectedHome: "http://authority.test" }, control.signal) : sourcePicture("prj_source", "hash_image", "http://authority.test", control.signal);
  const outcome = pending.then(() => null, (error: Error) => error);
  await Promise.race([entered, outcome.then((error) => { throw error ?? new Error("Source completed without recovery"); })]);
  control.abort(); release(Response.json({}));
  expect((await outcome)?.message).toMatch(/abort/i);
  expect(fetch.mock.calls.filter(([url]) => url !== DOOR_ROUTE)).toHaveLength(1);
});
