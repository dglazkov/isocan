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
  resolveTextGenerator,
  sanitizeFlowTitle,
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
});
