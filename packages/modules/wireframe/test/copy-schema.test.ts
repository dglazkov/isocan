import { describe, expect, it } from "vitest";
import type { CanvasContents, Operation } from "@isocan/core";
import {
  COMPONENTS,
  blockContentSchema,
  composeFlow,
  copyAiOnCanvas,
  ensureFleshedForCopy,
  flowNameSchema,
  generateWireCopy,
  httpTextGenerator,
  nameFlow,
  nameFlowOnCanvas,
  readWire,
  renderWire,
  requireScopedScreens,
  resolveTextGenerator,
  sanitizeFlowTitle,
  scopeFlowScreens,
  stubAnswerer,
  stubTextGenerator,
  validateCopyPayload,
  wireframe,
  wiresOn,
  wordsOf,
  type CopyCanvasResult,
  type GenerateWireCopyOptions,
  type HttpTextGeneratorOptions,
  type JsonSchema,
  type NamedFlow,
  type ScopedFlow,
  type ScopeFlowOptions,
  type ScopeFlowResult,
  type TextGenerator,
  type WirePort,
  type WireSpec,
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

describe("schema-driven AI copy and flow naming (Phase 12)", () => {
  it("builds blockContentSchema across all 50 catalog components and variants, validates payloads, and preserves actionable intents", async () => {
    expect(COMPONENTS.size).toBe(50);
    for (const comp of COMPONENTS.values()) {
      const variantOptions =
        comp.props.variant && comp.props.variant.kind === "choice"
          ? comp.props.variant.values
          : ["default"];
      for (const variantId of variantOptions) {
        const base = wireframe("home");
        const defaultProps = Object.fromEntries(
          Object.entries(comp.props).map(([k, v]) => [k, v.default]),
        );
        if (comp.props.variant) defaultProps.variant = variantId;
        const customSpec: WireSpec = {
          ...base,
          request: "Fleet dispatch operations platform",
          slots: [
            {
              slot: "main.1",
              block: comp.id,
              props: defaultProps,
              ...(Object.keys(comp.elements ?? {}).length > 0
                ? {
                    intents: Object.fromEntries(
                      Object.entries(comp.elements!).map(([el, def]) => [el, def.default]),
                    ),
                  }
                : {}),
            },
          ],
        };
        const fleshed = ensureFleshedForCopy(customSpec, `${comp.id}-${variantId}`);
        const schema: JsonSchema = blockContentSchema(fleshed);
        expect(schema.type).toBe("object");
        if (Object.keys(wordsOf(fleshed.slots[0]?.fill)).length > 0) {
          expect(schema.properties?.slots?.properties?.["main.1"]?.type).toBe("object");
        }

        const copyOpts: GenerateWireCopyOptions = {
          brief: "concise logistics dispatch terminology",
        };
        const copySpec = await generateWireCopy(fleshed, stubTextGenerator(3), copyOpts);
        expect(copySpec.content?.source).toBe("copy");
        expect(copySpec.slots[0]?.intents).toEqual(fleshed.slots[0]?.intents);
      }
    }

    const listSpec = ensureFleshedForCopy(wireframe("list"), "list-1");
    expect(() => validateCopyPayload(listSpec, null)).toThrow(/must be a JSON object/);
    expect(() => validateCopyPayload(listSpec, { intents: { submit: "hack" } })).toThrow(
      /cannot modify actionable intents/,
    );
    expect(() => validateCopyPayload(listSpec, { slots: { unknownSlot: {} } })).toThrow(
      /no slot "unknownSlot"/,
    );
    expect(() =>
      validateCopyPayload(listSpec, { slots: { "main.3": { "items.999.title": "nope" } } }),
    ).toThrow(/no word at "items\.999\.title"/);
  });

  it("sanitizes conversational filler from generated titles and names a flow with shared navigation labels", async () => {
    expect(sanitizeFlowTitle('Sure! Here is the flow title: **"Acme Dispatch"**.\nLet me know!')).toBe(
      "Acme Dispatch",
    );
    expect(sanitizeFlowTitle("Title: 'Courier Operations Hub;'")).toBe("Courier Operations Hub");

    const s1 = ensureFleshedForCopy(
      { ...wireframe("home"), flow: "f1", request: "Courier dispatch" },
      "s-home",
    );
    const s2 = ensureFleshedForCopy(
      { ...wireframe("list"), flow: "f1", request: "Courier dispatch" },
      "s-list",
    );
    const schema = flowNameSchema([s1, s2]);
    expect(schema.required).toEqual(["brand", "titles", "navLabels"]);

    const named: NamedFlow = await nameFlow(
      [s1, s2],
      "Courier dispatch and route tracking",
      stubTextGenerator(7),
    );
    expect(named.brand.length).toBeGreaterThan(0);
    expect(named.navLabels.length).toBeGreaterThan(0);
    expect(named.specs).toHaveLength(2);

    const navActions1 = Object.values(named.specs[0]!.slots.find((s) => s.slot === "nav")?.fill?.actions ?? {});
    const navActions2 = Object.values(named.specs[1]!.slots.find((s) => s.slot === "nav")?.fill?.actions ?? {});
    expect(navActions1).toEqual(navActions2);
    expect(navActions1.slice(0, named.navLabels.length)).toEqual(named.navLabels.slice(0, navActions1.length));
  });

  it("runs copyAiOnCanvas and nameFlowOnCanvas in one op group and rebuilds the prototype", async () => {
    const { port, blobs } = memoryPort();
    await composeFlow(port, "Warehouse parcel tracking", stubAnswerer(2), { noAsk: true });
    const canvas1 = await port.canvas();
    const all1 = await wiresOn(port, canvas1);
    expect(all1.length).toBeGreaterThan(0);

    const gen: TextGenerator = resolveTextGenerator({ seed: 5, useStub: true });
    const copyRes: CopyCanvasResult = await copyAiOnCanvas(port, canvas1, all1, all1, gen, {
      brief: "freight warehouse terminology",
    });
    expect(copyRes.changed.length).toBeGreaterThan(0);
    expect(copyRes.prototypes.length).toBe(1);

    const canvas2 = await port.canvas();
    const all2 = await wiresOn(port, canvas2);
    const nameRes = await nameFlowOnCanvas(port, canvas2, all2, all2, gen, {
      request: "Freight Hub",
    });
    expect(nameRes.changed.length).toBeGreaterThan(0);
    expect(nameRes.brand.length).toBeGreaterThan(0);

    const updatedItem = canvas2.items[nameRes.changed[0]!.itemId]!;
    const html = blobs.get(updatedItem.versions.at(-1)!.blobHash)!;
    const parsed = readWire(html);
    expect(parsed?.content?.source).toBe("copy");
    expect(renderWire(parsed!).length).toBeGreaterThan(100);

    expect(modeOf("copy concise fintech tone")).toEqual({ kind: "copy", brief: "concise fintech tone" });
    expect(modeOf("name Acme Treasury")).toEqual({ kind: "name", request: "Acme Treasury" });
  });

  it("supports httpTextGenerator over standard fetch with JSON schema", async () => {
    let capturedBody = "";
    const httpOpts: HttpTextGeneratorOptions = {
      apiKey: "test-key",
      model: "test-json-model",
      endpoint: "https://example.test/v1/chat/completions",
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ brand: "Atlas", titles: {}, navLabels: ["Home"] }) } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof globalThis.fetch,
    };
    const gen = httpTextGenerator(httpOpts);
    expect(gen.name).toBe("test-json-model");
    const out = await gen.generateJson<{ brand: string }>("Name flow", {
      type: "object",
      properties: { brand: { type: "string" } },
      required: ["brand"],
    });
    expect(out.brand).toBe("Atlas");
    expect(capturedBody).toContain("json_schema");
  });

  it("batches screens with > 20 word paths across > 3 wordy slots into <= 3-slot calls and merges validated payloads", async () => {
    const base = wireframe("home", { platform: "web", request: "Enterprise fleet dispatch", flow: "f-batch" });
    const heavySpec = ensureFleshedForCopy(
      {
        ...base,
        slots: [
          { slot: "header", block: "page-header", props: {} },
          { slot: "main.1", block: "stats-row", props: { count: 4 } },
          { slot: "main.2", block: "data-table", props: { rows: 5, columns: 4 } },
          { slot: "main.3", block: "stacked-list", props: { rows: 4 } },
          { slot: "main.4", block: "card-grid", props: { count: 4 } },
        ],
      },
      "heavy-1",
    );
    const totalWordPaths = heavySpec.slots.reduce((sum, s) => sum + Object.keys(wordsOf(s.fill)).length, 0);
    expect(totalWordPaths).toBeGreaterThan(20);

    const inner = stubTextGenerator(9);
    const batchSchemas: JsonSchema[] = [];
    const trackingGen: TextGenerator = {
      name: "batch-tracker",
      async generateJson<T>(prompt: string, schema: JsonSchema): Promise<T> {
        batchSchemas.push(schema);
        return inner.generateJson<T>(prompt, schema);
      },
    };

    const result = await generateWireCopy(heavySpec, trackingGen, { brief: "concise logistics tone" });
    expect(batchSchemas.length).toBeGreaterThanOrEqual(2);
    for (const s of batchSchemas) {
      const slotCount = Object.keys(s.properties?.slots?.properties ?? {}).length;
      expect(slotCount).toBeLessThanOrEqual(3);
    }
    expect(result.content?.source).toBe("copy");
  });

  it("completes all generateWireCopy calls in memory before emitting ops so a mid-flow error writes nothing", async () => {
    const { port, sent } = memoryPort();
    await composeFlow(port, "Warehouse parcel tracking", stubAnswerer(2), { noAsk: true });
    const canvas = await port.canvas();
    const all = await wiresOn(port, canvas);
    expect(all.length).toBeGreaterThanOrEqual(2);

    const beforeOps = sent.length;
    const inner = stubTextGenerator(4);
    let callCount = 0;
    const failingGen: TextGenerator = {
      name: "failing-second",
      async generateJson<T>(prompt: string, schema: JsonSchema): Promise<T> {
        callCount += 1;
        if (callCount === 2) throw new Error("LLM failed on screen 2");
        return inner.generateJson<T>(prompt, schema);
      },
    };

    await expect(copyAiOnCanvas(port, canvas, all, all, failingGen)).rejects.toThrow("LLM failed on screen 2");
    expect(sent.length).toBe(beforeOps);
  });

  it("scopes flows cleanly via scopeFlowScreens and requireScopedScreens, refusing ambiguous multi-flow canvases and excluding unkept variants", async () => {
    const { port } = memoryPort();
    const f1 = await composeFlow(port, "Courier dispatch", stubAnswerer(2), { noAsk: true });
    const f2 = await composeFlow(port, "Warehouse inventory", stubAnswerer(3), { noAsk: true });
    const canvas = await port.canvas();
    const all = await wiresOn(port, canvas);

    const optsAmbiguous: ScopeFlowOptions = { wholeFlow: true, excludeUnkeptVariants: true };
    const resAmbiguous: ScopeFlowResult = scopeFlowScreens(canvas, all, optsAmbiguous);
    expect(resAmbiguous.ambiguousFlows?.length).toBe(2);
    const firstAmbiguous: ScopedFlow = resAmbiguous.ambiguousFlows![0]!;
    expect(firstAmbiguous.flow).toBeDefined();
    expect(() => requireScopedScreens(resAmbiguous)).toThrow(/2 wireframe flows/);

    const scopedByFlow = requireScopedScreens(
      scopeFlowScreens(canvas, all, { flow: f1.flow, wholeFlow: true, excludeUnkeptVariants: true }),
    );
    expect(scopedByFlow.every((s) => s.spec.flow === f1.flow)).toBe(true);
    expect(scopedByFlow.every((s) => !s.spec.variantOf || canvas.items[s.item]?.properties?.wireKeep === "yes")).toBe(true);

    const scopedBySelection = requireScopedScreens(
      scopeFlowScreens(canvas, all, {
        itemIds: [f2.screens[0]!.item],
        wholeFlow: false,
        excludeUnkeptVariants: true,
      }),
    );
    expect(scopedBySelection.map((s) => s.item)).toEqual([f2.screens[0]!.item]);
  });
});
