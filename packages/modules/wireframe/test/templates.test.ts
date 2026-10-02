import { describe, expect, it } from "vitest";
import {
  DENSITY_LEVELS,
  DENSITY_SPACE,
  TEMPLATES,
  TEMPLATE_BY_ID,
  TEMPLATE_IDS,
  applyProps,
  applyStructure,
  assemblePrototype,
  blueprint,
  decisions,
  defaultSlotRegion,
  densityFromScore,
  inferLinks,
  propsRequest,
  readWire,
  renderFrame,
  renderWire,
  stubAnswerer,
  structureRequest,
  template,
  templateCss,
  templatesFor,
  validateWire,
  vary,
  wireCss,
  wireframe,
  type TemplateId,
  type WireSpec,
} from "../src/core.ts";

describe("Phase 9 — multi-region layout templates, density, and data-wf paths", () => {
  it("defines all 7 layout templates with valid regions and platform constraints", () => {
    expect(TEMPLATE_IDS).toEqual([
      "single",
      "split",
      "master_detail",
      "grid",
      "bento",
      "hero_then_grid",
      "dashboard",
    ]);
    expect(TEMPLATES).toHaveLength(7);
    for (const id of TEMPLATE_IDS) {
      const tpl = template(id);
      expect(TEMPLATE_BY_ID.get(id)).toBe(tpl);
      expect(tpl.regions.length).toBeGreaterThan(0);
      expect(tpl.platforms.length).toBeGreaterThan(0);
    }
    expect(() => template("unknown-template")).toThrow(/no layout template/);

    // Mobile (`app`) only offers single-column or hero_then_grid.
    const appList = templatesFor("list", "app").map((t) => t.id);
    expect(appList).toEqual(["single", "hero_then_grid"]);
    const webList = templatesFor("list", "web").map((t) => t.id);
    expect(webList).toEqual(["single", "master_detail", "grid", "hero_then_grid"]);
    const webHome = templatesFor("home", "web").map((t) => t.id);
    expect(webHome).toEqual(["single", "split", "grid", "bento", "hero_then_grid", "dashboard"]);
  });

  it("maps 1..3 density scores onto compact (8px), default (12px), and spacious (16px)", () => {
    expect(DENSITY_LEVELS).toEqual(["compact", "default", "spacious"]);
    expect(DENSITY_SPACE).toEqual({ compact: "8px", default: "12px", spacious: "16px" });
    expect(densityFromScore(1)).toBe("compact");
    expect(densityFromScore("2")).toBe("default");
    expect(densityFromScore(3)).toBe("spacious");
    expect(densityFromScore(0)).toBe("compact");
    expect(densityFromScore(9)).toBe("spacious");
    expect(densityFromScore("not-a-number")).toBe("default");

    for (const density of DENSITY_LEVELS) {
      const spec: WireSpec = { ...wireframe("home", { platform: "web" }), density };
      const css = wireCss(spec);
      expect(css).toContain(`--w-space:${DENSITY_SPACE[density]}`);
    }
  });

  it("rejects multi-column templates on platform === 'app' and invalid template/density/region in validateWire", () => {
    const appSpec = wireframe("home", { platform: "app" });
    for (const forbidden of ["split", "master_detail", "grid", "bento", "dashboard"] as const) {
      const problems = validateWire({ ...appSpec, template: forbidden });
      expect(problems.some((p) => p.includes(`template "${forbidden}" is not available on platform "app"`))).toBe(true);
    }
    expect(validateWire({ ...appSpec, template: "single" })).toEqual([]);
    expect(validateWire({ ...appSpec, template: "hero_then_grid" })).toEqual([]);

    const webSpec = wireframe("home", { platform: "web" });
    expect(validateWire({ ...webSpec, template: "not-a-template" as TemplateId })[0]).toMatch(/template must be one of/);
    expect(validateWire({ ...webSpec, density: "ultra-dense" as never })[0]).toMatch(/density must be one of/);

    const badRegion: WireSpec = {
      ...webSpec,
      template: "split",
      slots: webSpec.slots.map((s, i) => (i === 1 ? { ...s, region: "nonexistent" } : s)),
    };
    expect(validateWire(badRegion)[0]).toMatch(/is not one of split's regions/);
  });

  it("renders all 7 templates with @container (min-width: 640px) rules and sub-region containers", () => {
    expect(templateCss(undefined)).toBe("");
    expect(templateCss("single")).toBe("");
    expect(templateCss("split")).toContain("@container (min-width: 640px)");

    for (const id of TEMPLATE_IDS) {
      const spec: WireSpec = {
        ...wireframe("home", { platform: "web", title: "Operations" }),
        template: id,
        density: "spacious",
      };
      const html = renderWire(spec);
      expect(readWire(html)).toEqual(spec);

      if (id === "single") {
        expect(html).toContain('<div class="main">');
        expect(html).not.toContain("data-template=");
      } else {
        expect(html).toContain(`<div class="main tpl-${id}" data-template="${id}">`);
        expect(html).toContain("@container (min-width: 640px)");
        const tpl = template(id);
        for (const reg of tpl.regions) {
          // At least one region container from the template is emitted.
          expect(tpl.regions).toContain(reg);
        }
        const matchedRegions = [...html.matchAll(/data-tpl-region="([^"]+)"/g)].map((m) => m[1]!);
        expect(matchedRegions.length).toBeGreaterThan(0);
        for (const r of matchedRegions) expect(tpl.regions).toContain(r);
      }
    }
  });

  it("assigns deterministic defaultSlotRegion across every template", () => {
    const dummy = { slot: "main.1", block: "card-grid" };
    expect(defaultSlotRegion("single", dummy, 0, 3)).toBe("main");
    expect(defaultSlotRegion("grid", dummy, 1, 3)).toBe("grid");
    expect(defaultSlotRegion("bento", dummy, 2, 3)).toBe("bento");
    expect(defaultSlotRegion("hero_then_grid", dummy, 0, 3)).toBe("hero");
    expect(defaultSlotRegion("hero_then_grid", dummy, 1, 3)).toBe("grid");
    expect(defaultSlotRegion("split", dummy, 0, 2)).toBe("primary");
    expect(defaultSlotRegion("split", dummy, 1, 2)).toBe("secondary");
    expect(defaultSlotRegion("master_detail", dummy, 0, 2)).toBe("master");
    expect(defaultSlotRegion("master_detail", dummy, 1, 2)).toBe("detail");
    expect(defaultSlotRegion("dashboard", { slot: "main.1", block: "stat-row" }, 0, 3)).toBe("kpi");
    expect(defaultSlotRegion("dashboard", dummy, 1, 3)).toBe("primary");
    expect(defaultSlotRegion("dashboard", dummy, 2, 3)).toBe("secondary");
  });

  it("stamps data-sec and data-wf on every <section> and data-wf + data-intent on every hotspot", () => {
    const spec = wireframe("list", { platform: "web", title: "Deliveries" });
    const frame = renderFrame(spec);
    for (const slot of spec.slots) {
      expect(frame).toContain(`data-slot="${slot.slot}" data-region="`);
      expect(frame).toContain(`data-sec="${slot.slot}" data-wf="${slot.slot}"`);
    }
    // Every hotspot carries data-hot="<slot>#<el>", data-wf="<slot>.<el>", and data-intent="<intent>".
    const hots = [...frame.matchAll(/data-hot="([^"#]+)#([^"]+)" data-wf="([^"]+)" data-intent="([^"]+)"/g)];
    expect(hots.length).toBeGreaterThan(0);
    for (const [, slotId, elId, wfPath, intentId] of hots) {
      expect(wfPath).toBe(`${slotId}.${elId}`);
      expect(intentId!.length).toBeGreaterThan(0);
    }
  });

  it("selects template, density, and slot regions in Round 2 when layout is enabled and preserves region through Round 3 and vary", async () => {
    const bp = blueprint("home", { platform: "web", request: "Courier ops dashboard", flow: "ops", title: "Dashboard" });
    const stub = stubAnswerer(7);

    // 1. Automatic template + density choice when spec.template is unset
    const autoReq2 = structureRequest(bp, ["Dashboard", "List"], { layout: true });
    expect(autoReq2.questions.template).toBeDefined();
    expect(autoReq2.questions.density).toBeDefined();
    const { response: autoRes2 } = await stub.answer(autoReq2);
    const autoAfter2 = applyStructure(bp, autoReq2, autoRes2);
    expect(TEMPLATE_IDS).toContain(autoAfter2.template);
    expect(DENSITY_LEVELS).toContain(autoAfter2.density);
    expect(validateWire(autoAfter2)).toEqual([]);

    // 2. Explicit dashboard template with per-slot region selection
    const dashBp: WireSpec = { ...bp, template: "dashboard" };
    const req2 = structureRequest(dashBp, ["Dashboard", "List"], { layout: true });
    expect(req2.questions.template).toBeUndefined();
    expect(req2.questions.density).toBeDefined();
    expect(req2.questions["main.1:region"]).toBeDefined();

    const { response: res2 } = await stub.answer(req2);
    const after2 = applyStructure(dashBp, req2, res2);
    expect(after2.template).toBe("dashboard");
    expect(DENSITY_LEVELS).toContain(after2.density);
    expect(validateWire(after2)).toEqual([]);

    const req3 = propsRequest(after2);
    const { response: res3 } = await stub.answer(req3);
    const after3 = applyProps(after2, req3, res3);
    expect(validateWire(after3)).toEqual([]);
    for (const s of after3.slots.filter((x) => x.slot.startsWith("main."))) {
      expect(["kpi", "primary", "secondary"]).toContain(s.region);
    }

    const decs = decisions(after3).filter((d) => d.kind === "block");
    if (decs.length > 0) {
      const varied = vary(after3, decs[0]!, "it_dash");
      expect(validateWire(varied)).toEqual([]);
      const flipped = varied.slots.find((s) => s.slot === decs[0]!.slot)!;
      const original = after3.slots.find((s) => s.slot === decs[0]!.slot)!;
      expect(flipped.region).toBe(original.region);
    }

    // Prototype includes templateCss and per-screen density when any screen uses a multi-region template.
    const listSpec = wireframe("list", { platform: "web", flow: "ops", title: "List" });
    const screens = [
      { id: "it_list", title: "List", spec: listSpec },
      { id: "it_dash", title: "Dashboard", spec: after3 },
    ];
    const protoHtml = assemblePrototype(screens, inferLinks(screens));
    expect(protoHtml).toContain("@container (min-width: 640px)");
    expect(protoHtml).toContain(`data-template="dashboard"`);
  });
});
