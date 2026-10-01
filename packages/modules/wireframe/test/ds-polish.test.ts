import { describe, expect, it } from "vitest";
import {
  CONTRAST_BODY,
  checkDesign,
  contrastRatio,
  parseDesign,
  type CanvasContents,
  type Operation,
} from "@isocan/core";
import {
  DS_DIRECTIONS,
  POLISH_BUDGETS,
  POLISH_TOKENS,
  applyWirePolish,
  composeFlow,
  planPolishWithJev,
  polishCss,
  polishIntensityBudget,
  polishWireOnCanvas,
  proposeThenPick,
  readWire,
  renderWire,
  repairContrast,
  stubAnswerer,
  synthesizeDesignSystem,
  validateWire,
  verifyWireContract,
  wireDsOnCanvas,
  wireframe,
  wiresOn,
  type ContrastRepair,
  type DsDirectionCandidate,
  type PickedDirection,
  type PlannedPolish,
  type PolishBudget,
  type PolishCanvasResult,
  type PolishToken,
  type SynthesizeDsOptions,
  type SynthesizedDesignSystem,
  type WireContractVerification,
  type WireDsCanvasResult,
  type WirePolishPatch,
  type WirePort,
} from "../src/core.ts";
import { modeOf } from "../src/dialog.tsx";

function memoryPort(): {
  port: WirePort;
  sent: Array<{ op: Operation; group?: string }>;
  blobs: Map<string, string>;
} {
  const items = new Map<
    string,
    {
      id: string;
      title: string;
      properties: Record<string, string>;
      x: number;
      y: number;
      width: number;
      height: number;
      currentVersionId: string;
      versions: Array<{ id: string; blobHash: string; mimeType: string; filename?: string }>;
    }
  >();
  const blobs = new Map<string, string>();
  const sent: Array<{ op: Operation; group?: string }> = [];
  const port: WirePort = {
    canvasId: "c-test",
    actor: { id: "u-test", name: "Test" },
    async put(text: string) {
      const blobHash = `blob-${blobs.size + 1}`;
      blobs.set(blobHash, text);
      return { blobHash, size: text.length };
    },
    async send(op: Operation, group?: string) {
      sent.push({ op, ...(group ? { group } : {}) });
      if (op.type === "item.add") {
        const at = op.placement as { x: number; y: number };
        items.set(op.itemId, {
          id: op.itemId,
          title: op.title ?? "",
          properties: op.properties ?? {},
          x: at.x,
          y: at.y,
          width: op.width,
          height: op.height,
          currentVersionId: op.version.id,
          versions: [op.version],
        });
      } else if (op.type === "item.addVersion") {
        const item = items.get(op.itemId)!;
        item.versions.push(op.version);
        item.currentVersionId = op.version.id;
      } else if (op.type === "item.update") {
        const item = items.get(op.itemId)!;
        if (op.patch.title !== undefined) item.title = op.patch.title;
        if (op.patch.properties) {
          for (const [k, v] of Object.entries(op.patch.properties)) {
            if (v === null) delete item.properties[k];
            else item.properties[k] = v;
          }
        }
      } else if (op.type === "item.resize") {
        const item = items.get(op.itemId)!;
        item.width = op.width;
        item.height = op.height;
      }
    },
    async canvas(): Promise<CanvasContents> {
      return { items: Object.fromEntries(items) } as unknown as CanvasContents;
    },
    async readText(blobHash: string): Promise<string> {
      return blobs.get(blobHash) ?? "";
    },
  };
  return { port, sent, blobs };
}

describe("concurrent design system synthesis and Jev-budgeted polish (Phase 13)", () => {
  it("repairs deliberately low-contrast token pairs to >= 4.5:1 AA and passes checkDesign with zero warnings", async () => {
    const candidate: DsDirectionCandidate = DS_DIRECTIONS[0]!;
    expect(candidate.id).toBe("nordic-slate");

    const badColors = {
      ground: "#ffffff",
      surface: "#f5f5f5",
      line: "#e0e0e0",
      ink: "#999999", // < 4.5:1 against white
      "ink-muted": "#aaaaaa", // < 4.5:1 against surface
      bar: "#e5e5e5",
      primary: "#7dd3fc", // < 4.5:1 against white
      "on-primary": "#e0f2fe", // < 4.5:1 against primary
    };

    const { colors: repaired, repairs }: { colors: Record<string, string>; repairs: ContrastRepair[] } =
      repairContrast(badColors, CONTRAST_BODY);
    expect(repairs.length).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(repaired.ink!, repaired.ground!)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
    expect(contrastRatio(repaired["ink-muted"]!, repaired.surface!)!).toBeGreaterThanOrEqual(
      CONTRAST_BODY,
    );
    expect(contrastRatio(repaired.primary!, repaired.ground!)!).toBeGreaterThanOrEqual(
      CONTRAST_BODY,
    );
    expect(contrastRatio(repaired["on-primary"]!, repaired.primary!)!).toBeGreaterThanOrEqual(
      CONTRAST_BODY,
    );

    const picked: PickedDirection = await proposeThenPick("Logistics dispatch portal", stubAnswerer(4));
    expect(picked.direction.name.length).toBeGreaterThan(0);

    const synthOpts: SynthesizeDsOptions = {
      name: "Logistics Slate",
      colors: badColors,
    };
    const synth: SynthesizedDesignSystem = await synthesizeDesignSystem(
      "Logistics dispatch portal",
      stubAnswerer(4),
      synthOpts,
    );
    expect(synth.repairs.length).toBeGreaterThanOrEqual(3);
    const findings = checkDesign(parseDesign(synth.markdown));
    expect(findings.filter((f) => f.severity === "error" || f.severity === "warning")).toEqual([]);
  });

  it("synthesizes DESIGN.md on canvas, sets governing scope, and restyles screens and prototype in one op group", async () => {
    const { port, sent } = memoryPort();
    await composeFlow(port, "Courier fleet dispatch", stubAnswerer(2), { noAsk: true });
    const canvas = await port.canvas();
    const all = await wiresOn(port, canvas);
    expect(all.length).toBeGreaterThan(0);

    const beforeOps = sent.length;
    const dsRes: WireDsCanvasResult = await wireDsOnCanvas(
      port,
      all,
      all,
      "Industrial high-contrast dispatch",
      stubAnswerer(3),
    );
    expect(dsRes.what).toBe("added");
    expect(dsRes.restyled.changed.length).toBeGreaterThan(0);
    expect(dsRes.restyled.prototypes.length).toBe(1);

    // Every op emitted by wireDsOnCanvas belongs to one opGroupId
    const groups = new Set(sent.slice(beforeOps).map((s) => s.group));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBe(dsRes.group);
  });

  it("maps polish_intensity to budgets 0 | 4 | 8 | 12 and enforces verifyWireContract", async () => {
    expect(POLISH_BUDGETS).toEqual([0, 4, 8, 12]);
    expect(POLISH_TOKENS.length).toBe(8);
    const b0: PolishBudget = polishIntensityBudget(0.1);
    const b4: PolishBudget = polishIntensityBudget(0.35);
    const b8: PolishBudget = polishIntensityBudget(0.6);
    const b12: PolishBudget = polishIntensityBudget(0.9);
    expect([b0, b4, b8, b12]).toEqual([0, 4, 8, 12]);

    const spec = wireframe("list");
    expect(polishCss(undefined)).toBe("");
    const token: PolishToken = "wf-elevated";
    const patch: WirePolishPatch = { target: "main.3", add: [token] };
    expect(polishCss([patch])).toContain(".wf-elevated");
    expect(validateWire({ ...spec, polish: [patch] })).toEqual([]);

    const { spec: polished, html } = applyWirePolish(spec, [patch]);
    expect(polished.polish).toEqual([patch]);
    expect(html).toContain("wf-elevated");
    expect(readWire(html)?.polish).toEqual([patch]);

    // Contract rejection when a patch targets a non-existent data-wf path
    expect(() => applyWirePolish(spec, [{ target: "nonexistent.slot", add: ["wf-bordered"] }])).toThrow(
      /does not match any data-wf or data-sec path/,
    );

    // Contract rejection when custom HTML drops a data-wf or data-intent attribute
    const baseHtml = renderWire(spec);
    const brokenHtml = baseHtml.replace(/data-intent="[^"]+"/, "");
    const check: WireContractVerification = verifyWireContract(baseHtml, brokenHtml, spec);
    expect(check.ok).toBe(false);
    expect(check.problems.some((p) => p.includes("missing actionable intent"))).toBe(true);
  });

  it("runs polishWireOnCanvas and rebuilds the prototype in one op group, and supports --clear", async () => {
    const { port } = memoryPort();
    await composeFlow(port, "Team analytics dashboard", stubAnswerer(5), { noAsk: true });
    const canvas1 = await port.canvas();
    const all1 = await wiresOn(port, canvas1);

    const planned: PlannedPolish = await planPolishWithJev(all1[0]!.spec, stubAnswerer(5), {
      intensity: 0.65,
    });
    expect(planned.budget).toBe(8);
    expect(planned.patches.length).toBeGreaterThan(0);

    const polishRes: PolishCanvasResult = await polishWireOnCanvas(
      port,
      canvas1,
      all1,
      all1,
      stubAnswerer(5),
      { intensity: 0.65 },
    );
    expect(polishRes.changed.length).toBeGreaterThan(0);
    expect(polishRes.prototypes.length).toBe(1);

    const canvas2 = await port.canvas();
    const all2 = await wiresOn(port, canvas2);
    expect(all2[0]!.spec.polish?.length).toBeGreaterThan(0);

    const clearedRes = await polishWireOnCanvas(port, canvas2, all2, all2, stubAnswerer(5), {
      clear: true,
    });
    expect(clearedRes.changed.length).toBe(polishRes.changed.length);

    expect(modeOf("ds high contrast industrial")).toEqual({
      kind: "ds",
      request: "high contrast industrial",
    });
    expect(modeOf("polish --clear")).toEqual({ kind: "polish", clear: true });
  });
});
