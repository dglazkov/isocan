import { describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { canvasItemOf, designSystemProperties, governingDesign, type CanvasContents, type CanvasSnapshotResponse, type Item, type PersonalReadResponse } from "@isocan/core";
import { classifyAutomaticSource, readInheritedCanvases, readLayeredContext, type ContextReadPort } from "../src/context-reader.ts";

const home = "https://acme.invalid";
const canvas = (items: Item[]): CanvasContents => ({ items: Object.fromEntries(items.map((item) => [item.id, item])), threads: {}, edges: {}, viewport: { x: 0, y: 0, zoom: 1 } } as unknown as CanvasContents);
const item = (id: string, properties: Record<string, string> = {}): Item => ({
  id, title: id, x: 0, y: 0, properties, versions: [], currentVersionId: "ver_none", reactions: {},
} as unknown as Item);
const link = (id: string, target: string, memory = "inherit", origin = home): Item => item(id, { ...canvasItemOf(origin, target).properties, memory });
const snapshot = (contents: CanvasContents, title = "Acme Library"): CanvasSnapshotResponse => ({ canvas: contents, project: { title } } as CanvasSnapshotResponse);

function fixture() {
  const summary: PersonalReadResponse = {
    kind: "personal", mode: "summary", owner: { id: "usr_maya", name: "Maya" }, home,
    sourceCanvasId: "prj_personal", itemId: "itm_personal", truncated: false,
    pieces: [{ kind: "pin", itemId: "itm_preference", title: "Phone preference", versionId: "ver_private", mimeType: "text/plain" }],
  };
  const io = {
    classifySource: vi.fn<ContextReadPort["classifySource"]>(async ({ canvasId }) => ({ kind: canvasId === "prj_personal" ? "personal" : "ordinary" })),
    sourceSnapshot: vi.fn<ContextReadPort["sourceSnapshot"]>(async () => snapshot(canvas([item("Acme inherited pin", { context: "pinned" })]))),
    readPersonal: vi.fn<ContextReadPort["readPersonal"]>(async () => summary),
    designText: vi.fn(async () => "design"),
  };
  return { io, summary };
}

describe("the automatic source gate", () => {
  it("refuses private inherited and plain cards before any snapshot", async () => {
    const { io } = fixture();
    for (const memory of ["inherit", ""]) {
      const target = link("itm_card", "prj_personal", memory);
      expect(await classifyAutomaticSource(io, { canvasId: "prj_personal", home, source: target.properties.source ?? null })).toMatchObject({ kind: "personal" });
    }
    const linked = await readInheritedCanvases(io, canvas([link("itm_copied", "prj_personal")]), home);
    expect(linked[0]).toMatchObject({ canvas: null, refused: expect.stringContaining("Personal") });
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
    expect(io.designText).not.toHaveBeenCalled();
    expect(io.readPersonal).not.toHaveBeenCalled();
  });

  it("does not call any source service for malformed, mismatched or foreign addresses", async () => {
    const { io } = fixture();
    for (const target of [
      { canvasId: "prj_x", home: "unknown" },
      { canvasId: "prj_x", home, source: `${home}/p/prj_other` },
      { canvasId: "prj_x", home, source: "https://elsewhere.invalid/p/prj_x" },
      { canvasId: "prj_x", home, source: `${home}/p/%FF` },
    ]) expect(await classifyAutomaticSource(io, target)).toMatchObject({ kind: "unavailable" });
    expect(io.classifySource).not.toHaveBeenCalled();
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });

  it("keeps failed classification redacted rather than trying a local snapshot", async () => {
    const { io } = fixture();
    io.classifySource.mockRejectedValue(new Error("Home did not answer"));
    expect(await readInheritedCanvases(io, canvas([link("itm_link", "prj_library")]), home)).toMatchObject([{ canvas: null, refused: "Home did not answer" }]);
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });

  it("removes excluded ancestor edges before even classifying their sources", async () => {
    const { io } = fixture();
    const group = item("itm_group", { kind: "group", context: "excluded" });
    const child = { ...link("itm_child", "prj_personal"), containerId: group.id };
    expect(await readInheritedCanvases(io, canvas([group, child]), home)).toEqual([]);
    expect(io.classifySource).not.toHaveBeenCalled();
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });

  it("cancels between classification and snapshot without turning cancellation into a refusal row", async () => {
    const { io } = fixture();
    const controller = new AbortController();
    io.classifySource.mockImplementation(async () => { controller.abort(new Error("identity changed")); return { kind: "ordinary" }; });
    await expect(readInheritedCanvases(io, canvas([link("itm_link", "prj_x")]), home, controller.signal)).rejects.toThrow("identity changed");
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });
});

describe("one shared layered Context reader", () => {
  it("reads ordinary then authorized personal summaries with no private snapshot or retained version/hash", async () => {
    const { io } = fixture();
    const local = canvas([link("itm_library", "prj_library"), link("itm_personal", "prj_personal", "personal")]);
    const layers = await readLayeredContext(io, { canvasId: "prj_here", home, canvas: local, personal: { actorId: "usr_maya" } });
    expect(layers.map((layer) => layer.kind)).toEqual(["local", "inherited", "personal"]);
    expect(io.sourceSnapshot.mock.calls.map(([source]) => source.canvasId)).toEqual(["prj_library"]);
    expect(io.sourceSnapshot).toHaveBeenCalledWith({ canvasId: "prj_library", expectedHome: home }, undefined);
    expect(io.readPersonal).toHaveBeenCalledWith("prj_here", { actorId: "usr_maya", itemId: "itm_personal", mode: "summary" }, undefined);
    expect(layers[2]).toMatchObject({ heading: "Maya's canvas", owner: { id: "usr_maya" }, pieces: [{ name: "Phone preference" }] });
    expect(JSON.stringify(layers)).not.toContain("ver_private");
    expect(io.designText).not.toHaveBeenCalled();
  });

  it("never asks for personal summaries on an ambient read and never changes governing design", async () => {
    const { io } = fixture();
    const local = canvas([link("itm_personal", "prj_personal", "personal")]);
    expect((await readLayeredContext(io, { canvasId: "prj_here", home, canvas: local, personal: "exclude" })).map((layer) => layer.kind)).toEqual(["local"]);
    expect(io.readPersonal).not.toHaveBeenCalled();
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
    expect(governingDesign(local, [])).toBeNull();
  });

  it("retains a refused heading without inventing a trusted owner or a successful empty result", async () => {
    const { io } = fixture();
    io.readPersonal.mockRejectedValue(new Error("Not delegated"));
    const layers = await readLayeredContext(io, { canvasId: "prj_here", home, canvas: canvas([link("itm_personal", "prj_personal", "personal")]), personal: { actorId: "usr_other" } });
    expect(layers[1]).toMatchObject({ kind: "personal", heading: "itm_personal", owner: null, pieces: [], refused: "Not delegated" });
    expect(io.sourceSnapshot).not.toHaveBeenCalled();
  });

  it("refuses malformed or wrong authoritative personal response homes without exposing pieces", async () => {
    const { io, summary } = fixture();
    const local = canvas([link("itm_personal", "prj_personal", "personal")]);
    for (const wrong of ["https://elsewhere.invalid", "not a home", "file:///private"]) {
      summary.home = wrong;
      const layers = await readLayeredContext(io, { canvasId: "prj_here", home, canvas: local, personal: { actorId: "usr_maya" } });
      expect(layers[1]).toMatchObject({ pieces: [], owner: null, refused: expect.stringContaining("different source") });
      expect(JSON.stringify(layers)).not.toContain("Phone preference");
    }
    summary.home = `${home.toUpperCase()}/`;
    expect((await readLayeredContext(io, { canvasId: "prj_here", home, canvas: local, personal: { actorId: "usr_maya" } }))[1]!.refused).toBeUndefined();
  });

  it("keeps personal design a contribution and reports a truncated summary explicitly", async () => {
    const { io, summary } = fixture();
    summary.pieces[0]!.kind = "design";
    summary.truncated = true;
    const design = item("Acme local design", designSystemProperties());
    const local = canvas([design, link("itm_personal", "prj_personal", "personal")]);
    const layers = await readLayeredContext(io, { canvasId: "prj_here", home, canvas: local, personal: { actorId: "usr_maya" } });
    expect(governingDesign(local, [])?.item.id).toBe(design.id);
    expect(layers[1]!.pieces[0]).toMatchObject({ name: "Design system", present: true });
    expect(layers[1]!.pieces[0]!.overridden).toBeUndefined();
    expect(layers[1]!.pieces[1]!.stale).toContain("truncated");
  });

  it("bundles the exact API subpath for a browser without Node shims", async () => {
    const result = await build({ entryPoints: [fileURLToPath(new URL("../src/context-reader.ts", import.meta.url))], bundle: true, platform: "browser", format: "esm", write: false, logLevel: "silent" });
    expect(result.outputFiles[0]!.text).not.toMatch(/node:fs|node:child_process|Buffer\.from/);
  });
});
