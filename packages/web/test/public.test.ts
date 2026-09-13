import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PUBLIC_CANVASES_ROUTE, publicListingRoute, type PublicCanvas } from "@isocan/core";
import { PublicRows } from "../src/components/PublicCatalogue.tsx";
import { ApiError, publicCanvases, setPublicListing } from "../src/lib/api.ts";

afterEach(() => vi.unstubAllGlobals());
describe("the Public client wire", () => {
  it("reads only the separate catalogue and sends a concrete grant decision with its actor", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json(url === PUBLIC_CANVASES_ROUTE ? { canvases: [] } : { grant: { id: "grant_captured" } });
    }));
    const signal = new AbortController().signal;
    expect(await publicCanvases(signal)).toEqual({ canvases: [] });
    await setPublicListing("canvas / 1", "grant_captured", true, "actor_owner");
    await setPublicListing("canvas / 1", "grant_captured", false, "actor_owner");
    expect(calls.map((call) => [call.url, call.init?.method])).toEqual([
      [PUBLIC_CANVASES_ROUTE, "GET"], [publicListingRoute("canvas / 1", "grant_captured"), "PUT"], [publicListingRoute("canvas / 1", "grant_captured"), "PUT"],
    ]);
    expect(calls[0]!.init?.signal).toBe(signal);
    expect(calls[0]!.init?.body).toBeUndefined();
    expect(JSON.parse(String(calls[1]!.init?.body))).toEqual({ listed: true, actorId: "actor_owner" });
    expect(JSON.parse(String(calls[2]!.init?.body))).toEqual({ listed: false, actorId: "actor_owner" });
  });
  it("preserves old-home and owner refusal instead of reporting empty or successful publication", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "not-found", error: "Unknown catalogue" }, { status: 404 })));
    await expect(publicCanvases()).rejects.toMatchObject({ status: 404, message: "Unknown catalogue" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "not-owner", error: "Only an owner can publish" }, { status: 403 })));
    await expect(setPublicListing("canvas", "grant", true, "editor")).rejects.toBeInstanceOf(ApiError);
  });
});

it("renders only declared title, home and access as a canonical entry link, never rich previews or extra record fields", () => {
  const row = { id: "prj_public", title: "<Acme example>", home: "https://home.example", capability: "read", description: "PRIVATE_DESCRIPTION", createdBy: { name: "PRIVATE_OWNER" }, agent: "PRIVATE_AGENT", thumbnail: "https://other.example/private.png" };
  const html = renderToStaticMarkup(createElement(PublicRows, { rows: [row as PublicCanvas] }));
  expect(html).toContain('href="https://home.example/p/prj_public"');
  expect(html).toContain("&lt;Acme example&gt;");
  expect(html).toContain("Canvas Viewer");
  expect(html).not.toMatch(/PRIVATE_|<img|<iframe|<canvas|other\.example/);
});
