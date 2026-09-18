import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { rules } from "./cssrules.ts";

/**
 * **Copy a piece here, in a browser** (memory phase 6,
 * `docs/projects/memory/pin-from-source.md`).
 *
 * The decisions are proved in `packages/api/test/context-pin.test.ts`; this is
 * that the browser reaches them through the SAME leaf, that its transport
 * carries the automatic-source restriction on every actual source request, and
 * that the picker says the things somebody needs at the moment of the choice —
 * on a desktop rail and on a 390px phone.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

/** React slots, so the real component and its real handlers can be invoked. */
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real,
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [hooks.slots[index], (value: T | ((old: T) => T)) => { hooks.slots[index] = typeof value === "function" ? (value as (old: T) => T)(hooks.slots[index] as T) : value; }];
    },
    useRef: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
  };
});
vi.mock("../src/lib/capability.ts", () => ({ useCanEdit: () => true }));
vi.mock("@isocan/api/context-pin", async (original) => {
  const real = await original<typeof import("@isocan/api/context-pin")>();
  return { ...real, readPinSource: vi.fn(), pinFromSource: vi.fn() };
});

import { PinFromSource } from "../src/components/PinFromSource.tsx";
import { pinFromSource, readPinSource } from "@isocan/api/context-pin";
import { contextPinIO } from "../src/lib/context-pin.ts";

const canvas = { items: {}, threads: {}, trash: [] } as never;
const props = {
  canvasId: "prj_local", canvas, actor: { id: "usr_theo", name: "Theo" },
  home: "https://acme.invalid", from: "itm_link", refresh: vi.fn(),
};
const offer = {
  itemId: "itm_link", canvasId: "prj_design", title: "Acme Design System", home: "https://acme.invalid",
  pieces: [
    { kind: "pin" as const, itemId: "itm_checklist", title: "Review checklist", count: 1 },
    { kind: "pin" as const, itemId: "itm_pack", title: "Acme review pack", count: 3 },
    { kind: "design" as const, itemId: "itm_secret", title: "Acme sealed note", count: 2, refused: "“Acme inner” is kept out of context on the source" },
  ],
};

function draw(): { element: ReactElement; html: string } {
  hooks.cursor = 0;
  const element = PinFromSource(props) as ReactElement;
  return { element, html: renderToStaticMarkup(createElement(() => element)) };
}
function walk(node: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) { for (const one of node) walk(one, found); return found; }
  const element = node as ReactElement & { props?: { children?: unknown } };
  if (!element || typeof element !== "object" || !("props" in element)) return found;
  found.push(element);
  walk(element.props?.children, found);
  return found;
}
const button = (element: ReactElement, label: string) =>
  walk(element).find((one) => one.type === "button" && one.props.children === label)!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => { hooks.slots.length = 0; hooks.cursor = 0; vi.mocked(readPinSource).mockResolvedValue(offer); vi.mocked(pinFromSource).mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

describe("the picker on an inherited layer", () => {
  it("offers the source's pieces, says how many a group brings and why one refuses", async () => {
    expect(draw().html).toContain("Copy a piece here");
    button(draw().element, "Copy a piece here").props.onClick();
    await settle();
    expect(vi.mocked(readPinSource).mock.calls[0]![1]).toMatchObject({ home: props.home, from: "itm_link" });
    const html = draw().html;
    expect(html).toContain("Review checklist");
    // A group says how many items BEFORE the button, not after.
    expect(html).toContain("copies 3 items");
    // A refusal says why rather than disappearing, and cannot be chosen.
    expect(html).toContain("kept out of context on the source");
    expect(html).toMatch(/disabled="" value="itm_secret"/);
    // The sentence is on screen at the moment of the decision.
    expect(html).toContain("This copies the current version, including a group&#x27;s contents. Later edits on “Acme Design System” will not update it.");
  });

  it("copies through the same leaf the CLI uses, and reports the copy afterwards", async () => {
    vi.mocked(pinFromSource).mockResolvedValue({ dryRun: false, rootId: "itm_new", itemIds: ["itm_new"], count: 1, title: "Review checklist", source: { home: props.home, canvasId: "prj_design", canvasTitle: "Acme Design System", itemId: "itm_checklist", itemTitle: "Review checklist", versionId: "ver_one" } });
    button(draw().element, "Copy a piece here").props.onClick();
    await settle();
    button(draw().element, "Copy and pin").props.onClick();
    await settle();
    const [io, request] = vi.mocked(pinFromSource).mock.calls[0]!;
    expect(io).toBe(contextPinIO);
    expect(request).toMatchObject({ canvasId: "prj_local", home: props.home, from: "itm_link", piece: "itm_checklist" });
    expect(props.refresh).toHaveBeenCalled();
    expect(draw().html).toContain("is copied here and pinned");
  });

  it("shows a refusal instead of claiming a copy that did not happen", async () => {
    vi.mocked(pinFromSource).mockRejectedValue(new Error("“Acme Design System” is no longer a visible inherited source here — nothing was copied."));
    button(draw().element, "Copy a piece here").props.onClick();
    await settle();
    button(draw().element, "Copy and pin").props.onClick();
    await settle();
    const html = draw().html;
    expect(html).toContain("no longer a visible inherited source");
    expect(html).not.toContain("is copied here and pinned");
  });
});

describe("the browser's transport is the automatic-source one", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; vi.unstubAllGlobals(); });

  it("carries exclusion and the expected home on the actual source blob request, and uploads to the destination", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("window", { location: { origin: "https://acme.invalid" } });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, ...(init ? { init } : {}) });
      if (init?.method === "POST") return Response.json({ blobHash: "hash_one", size: 4, mimeType: "text/markdown" });
      return new Response(new Uint8Array([1, 2, 3, 4]));
    }));
    const bytes = await contextPinIO.copyBytes({ canvasId: "prj_design", expectedHome: "https://acme.invalid" }, "prj_local")
      .downloadBlob("hash_one");
    expect([...bytes]).toEqual([1, 2, 3, 4]);
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(calls[0]!.url).toContain("/api/projects/prj_design/blobs/hash_one");
    expect(parseSourcePolicyHeader(headers[SOURCE_POLICY_HEADER]!)).toEqual({ policy: { mode: "exclude" }, expectedHome: "https://acme.invalid" });

    await contextPinIO.copyBytes({ canvasId: "prj_design", expectedHome: "https://acme.invalid" }, "prj_local")
      .uploadBlob(new Uint8Array([1, 2, 3, 4]), "text/markdown", "checklist.md");
    expect(calls.at(-1)!.url).toContain("/api/projects/prj_local/blobs");
    // The destination upload carries no source policy: it is this caller's own
    // ordinary write, and borrowing the source's restriction would be a lie.
    expect((calls.at(-1)!.init?.headers as Record<string, string>)[SOURCE_POLICY_HEADER]).toBeUndefined();
  });

  it("verifies bytes with sha256 the same way the daemon addresses them", async () => {
    const io = contextPinIO.copyBytes({ canvasId: "prj_design", expectedHome: "https://acme.invalid" }, "prj_local");
    expect(await io.digest(new TextEncoder().encode("abc")))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("both surfaces, and both widths", () => {
  it("reaches the shared act rather than rolling a second copy in the browser", () => {
    const panel = read("components/ContextPanel.tsx");
    expect(panel).toMatch(/LazyPinFromSource\.tsx/);
    const picker = read("components/PinFromSource.tsx");
    expect(picker).toMatch(/from "@isocan\/api\/context-pin"/);
    // No second copy algorithm and no hand-rolled operation in the browser.
    expect(picker).not.toMatch(/groupCopyAction|group\.change|item\.update/);
  });

  it("shows where a copied pin came from beside it, in local Context", () => {
    const panel = read("components/ContextPanel.tsx");
    expect(panel).toMatch(/piece\.copied/);
    expect(panel).toMatch(/one\.source\.canvasTitle/);
  });

  it("lays the picker out for a 390px phone as well as the rail", () => {
    const sheet = rules(read("components/context-pin.css"));
    const piece = sheet.find((rule) => rule.selector === ".ctx-pin-piece")!;
    // One column: a radio, a title and a count in a row wrap into nonsense on
    // a phone, and this panel is read on a phone by design.
    expect(piece.body).toMatch(/grid-template-columns: auto minmax\(0, 1fr\)/);
    expect(sheet.find((rule) => rule.selector === ".ctx-copied-row")!.body).toContain("overflow-wrap: anywhere");
    expect(sheet.some((rule) => rule.at.some((at) => at.includes("max-width: 480px")))).toBe(true);
  });
});
