import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spaceCanvasRoute, spaceGrantsRoute, spaceLinkRoute, spaceRoute, SPACES_ROUTE } from "@isocan/core";
import {
  addToSpace,
  createSpace,
  createSpaceGrant,
  deleteSpace,
  listSpaces,
  removeFromSpace,
  setSpaceLink,
} from "../src/lib/api.ts";

/**
 * **The space, on the web surface** (roles phase 4). Two things worth holding
 * still without a browser: the calls the canvas list and the space's Share go
 * out on — the same routes `isocan space` and `isocan share --space` drive,
 * spelled by core — and the shape of the two components, read from source:
 * a heading per space with **No space** last, **Move to space…** on a card,
 * a drop on a heading, and the space's rows greyed under *from the space* on
 * a canvas's Share. The conductor drives the rest in Chrome.
 */

const realFetch = globalThis.fetch;
interface Seen {
  method: string;
  url: string;
  body: string | undefined;
}
let seen: Seen[];
let answer: unknown;

beforeEach(() => {
  seen = [];
  answer = { spaces: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body === undefined ? undefined : String(init.body),
    });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the space calls, on the wire", () => {
  it("lists, makes and deletes a space through core's routes", async () => {
    await listSpaces();
    await createSpace("Design", "usr_priya");
    await deleteSpace("spc_1", "usr_priya");
    expect(seen.map((s) => [s.method, s.url])).toEqual([
      ["GET", SPACES_ROUTE],
      ["POST", SPACES_ROUTE],
      // No body on the DELETE; the actor rides the query.
      ["DELETE", `${spaceRoute("spc_1")}?actorId=usr_priya`],
    ]);
    expect(JSON.parse(seen[1]!.body!)).toEqual({ name: "Design", actorId: "usr_priya" });
    expect(seen[2]!.body).toBeUndefined();
  });

  it("moves a canvas in and out with PUT and DELETE on the canvas route", async () => {
    await addToSpace("spc_1", "prj_a", "usr_priya");
    await removeFromSpace("spc_1", "prj_a", "usr_priya");
    expect(seen[0]).toMatchObject({ method: "PUT", url: spaceCanvasRoute("spc_1", "prj_a") });
    expect(JSON.parse(seen[0]!.body!)).toEqual({ actorId: "usr_priya" });
    expect(seen[1]).toMatchObject({ method: "DELETE", url: `${spaceCanvasRoute("spc_1", "prj_a")}?actorId=usr_priya` });
  });

  it("sends a space grant with the rung only when it narrows, and the every-canvas link as one POST", async () => {
    await createSpaceGrant("spc_1", "email:jordan@acme.test", "edit", "usr_priya");
    await createSpaceGrant("spc_1", "email:jordan@acme.test", "own", "usr_priya");
    await setSpaceLink("spc_1", "off", "usr_priya");
    expect(seen[0]!.url).toBe(spaceGrantsRoute("spc_1"));
    expect(JSON.parse(seen[0]!.body!)).toEqual({ subject: "email:jordan@acme.test", actorId: "usr_priya" });
    expect(JSON.parse(seen[1]!.body!)).toMatchObject({ capability: "own" });
    expect(seen[2]).toMatchObject({ method: "POST", url: spaceLinkRoute("spc_1") });
    expect(JSON.parse(seen[2]!.body!)).toEqual({ capability: "off", actorId: "usr_priya" });
  });
});

const list = readFileSync(fileURLToPath(new URL("../src/pages/CanvasListPage.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../src/components/ShareDialog.tsx", import.meta.url)), "utf8");
const bare = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");

describe("the canvas list", () => {
  const page = bare(list);
  it("joins the spaces list to the canvases and draws a heading per space, No space last", () => {
    expect(page).toMatch(/listSpaces\(\)/);
    expect(page).toMatch(/space \? space\.name : "No space"/);
    // The last group is the null one, after every space in name order.
    expect(page).toMatch(/\{ space: null, canvases: byGroup\.get\(null\)! \}\]/);
  });

  it("draws no heading at all when the home has no spaces", () => {
    expect(page).toMatch(/if \(spaces\.length === 0\) return null;/);
    expect(page).toMatch(/groups === null \? \(/);
  });

  it("has Move to space… on a card, and a drop on a heading does the same", () => {
    expect(page).toContain("Move to space…");
    expect(page).toMatch(/onDrop=\{dropOn\(space\)\}/);
    expect(page).toMatch(/dataTransfer\.setData\("text\/isocan-canvas", canvas\.id\)/);
    // Both reach one function: a remove and an add, in that order.
    expect(page).toMatch(/if \(from\) await removeFromSpace\(from\.id, canvas\.id, actor\.id\);\s*if \(to\) await addToSpace\(to\.id, canvas\.id, actor\.id\);/);
  });

  it("opens the space's Share from its heading, and gates the space controls on the owner", () => {
    expect(page).toMatch(/<ShareDialog[\s\S]*?space=\{space\}/);
    expect(page).toMatch(/disabled=\{!ownsSpace\(space, actor\.id\)\}/);
    expect(page).toMatch(/disabled=\{!ownsCanvas\(canvas, actor\.id\)\}/);
  });
});

describe("the Share dialog", () => {
  const source = bare(dialog);
  it("renders the space's rows first, greyed, under from the space, with a way to the space's Share", () => {
    expect(source).toContain("From the space {fromSpace.space.name}");
    expect(source).toMatch(/className="share-roster share-from-space"/);
    expect(source).toContain("Share the space");
    // Read from the spaces list joined on the canvas id — never from a field
    // on the canvas record, which carries no space.
    expect(source).toMatch(/answer\.spaces\.find\(\(s\) => s\.canvasIds\.includes\(canvasId\)\)/);
  });

  it("says when a canvas row is below what the space already gives", () => {
    expect(source).toContain("below what the space already gives");
  });

  it("is the same component with a space scope, with Every canvas in this space at the top", () => {
    expect(source).toMatch(/if \(space\) return <SpaceShare/);
    expect(source).toContain("Every canvas in this space");
    // Its one control is the link setting, off included, and never own.
    expect(source).toMatch(/\[\.\.\.LINK_RUNGS, "off" as const\]/);
    // And the canvases below, each marked when wider than the space.
    expect(source).toContain("wider than the space");
  });

  it("answers a removal the space would still admit with the space's Share, not a bar", () => {
    expect(source).toMatch(/stillIn\.by === "space"/);
  });
});
