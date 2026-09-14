import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { readDesignAudit } from "../src/lib/design-audit.ts";
import { onReBadge } from "../src/lib/api.ts";
import { auditContractDesign, auditContractHtml, auditFixture, auditHome } from "../../api/test/design-audit-fixture.ts";

beforeEach(() => vi.stubGlobal("window", { location: { origin: auditHome } }));
afterEach(() => { onReBadge(async () => {}); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("browser I/O feeds the shared analyzer and carries source policy through inherited snapshot and blob reads", async () => {
  const { canvas, library, blobs } = auditFixture();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: null } });
    if (url.startsWith("/api/source-classification")) return Response.json({ kind: "ordinary" });
    if (url === "/api/projects/prj_dest/canvas") return Response.json({ canvas, project: { id: "prj_dest" } });
    if (url === "/api/projects/prj_library/canvas") return Response.json({ canvas: library, project: { id: "prj_library", title: "Acme library" } });
    const hash = url.split("/blobs/")[1];
    if (hash && blobs[hash]) return new Response(blobs[hash]);
    throw new Error(`Unexpected fixture request ${url}`);
  }));
  const report = await readDesignAudit("prj_dest");
  expect(report).toMatchObject({ screens: 2, audited: 2, offSystem: 1, unavailable: 0 });
  expect(report.items[0]).toMatchObject({ itemId: "nested", governing: { itemId: "design", canvasId: "prj_dest" }, diagnostics: [{ code: "design/missing-variable" }, { code: "design/off-scale-spacing" }] });
  expect(report.items[1]).toMatchObject({ itemId: "outside", governing: { itemId: "inherited", canvasId: "prj_library", inherited: true }, onSystem: 1 });
  const inherited = calls.filter(call => call.url.startsWith("/api/projects/prj_library/"));
  expect(inherited.map(call => call.url)).toEqual(["/api/projects/prj_library/canvas", "/api/projects/prj_library/blobs/hash_inherited"]);
  for (const call of inherited) expect(parseSourcePolicyHeader(new Headers(call.init?.headers).get(SOURCE_POLICY_HEADER)!)).toEqual({ policy: { mode: "exclude" }, expectedHome: auditHome });
});

it("browser denied source blobs produce unavailable evidence, never parsed error bodies", async () => {
  const { canvas, library } = auditFixture();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: null } });
    if (url.startsWith("/api/source-classification")) return Response.json({ kind: "ordinary" });
    if (url.includes("/canvas")) return Response.json({ canvas: library, project: { id: "prj_library", title: "Acme library" } });
    return Response.json({ error: "Source became private", code: "source_refused" }, { status: 403 });
  }));
  const report = await readDesignAudit("prj_dest", { itemIds: ["outside"] }, canvas);
  expect(report).toMatchObject({ audited: 0, unavailable: 1, items: [{ status: "unavailable", reason: "Source became private", governing: { canvasId: "prj_library" } }] });
  expect(report.items[0]).not.toHaveProperty("diagnostics");
});

it("a browser refresh reads a linked contract's new governing version without merging the destination lane policy", async () => {
  const { canvas, library, blobs, inherited } = auditFixture();
  blobs.hash_design = auditContractDesign("require-references");
  blobs.hash_inherited = auditContractDesign("allow");
  blobs.hash_outside = auditContractHtml;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: null } });
    if (url.startsWith("/api/source-classification")) return Response.json({ kind: "ordinary" });
    if (url === "/api/projects/prj_dest/canvas") return Response.json({ canvas, project: { id: "prj_dest" } });
    if (url === "/api/projects/prj_library/canvas") return Response.json({ canvas: library, project: { id: "prj_library", title: "Acme library" } });
    const hash = url.split("/blobs/")[1];
    if (hash && blobs[hash]) return new Response(blobs[hash]);
    throw new Error(`Unexpected fixture request ${url}`);
  }));
  const first = (await readDesignAudit("prj_dest", { itemIds: ["outside"] })).items[0]!;
  expect(first).toMatchObject({ governing: { canvasId: "prj_library", versionId: inherited.currentVersionId }, policy: { effective: { literals: "allow" } }, diagnostics: [] });
  inherited.versions.push({ ...inherited.versions[0]!, id: "ver_reference_policy", blobHash: "hash_reference_policy" });
  inherited.currentVersionId = "ver_reference_policy";
  blobs.hash_reference_policy = auditContractDesign("require-references");
  const refreshed = (await readDesignAudit("prj_dest", { itemIds: ["outside"] })).items[0]!;
  expect(refreshed).toMatchObject({ governing: { canvasId: "prj_library", versionId: "ver_reference_policy", blobHash: "hash_reference_policy" }, policy: { effective: { literals: "require-references" } } });
  if (refreshed.status !== "audited") throw new Error(refreshed.reason);
  expect(refreshed.diagnostics.map(({ code, property }) => ({ code, property }))).toEqual(["padding", "border-radius", "margin", "font-size", "font-weight"].map(property => ({ code: "design/reference-required", property })));
});
