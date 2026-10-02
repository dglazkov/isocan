import { describe, expect, it } from "vitest";
import type { CanvasContents, Operation } from "@isocan/core";
import {
  classifyTurn,
  compactDecisions,
  composeFlow,
  EDIT_KINDS,
  editWireOnCanvas,
  explainWireDecision,
  JEV_MODEL,
  planEditWithJev,
  recordDecisions,
  routeTurn,
  scopeEdit,
  stubAnswerer,
  TURN_MODES,
  validateWire,
  wireframe,
  type DecisionExplanation,
  type EditedWire,
  type EditKind,
  type EditOperation,
  type JevRequest,
  type JevResponse,
  type TurnMode,
  type WirePort,
  type WireSpec,
} from "../src/core.ts";
import { rewriteSlotCopy } from "../src/copy-schema.ts";
import { stubTextGenerator, type Answerer, type JevResponse as Response, type JsonSchema, type TextGenerator } from "../src/answerer.ts";
import { wordsOf } from "../src/content/flesh-spec.ts";

function memoryPort(): {
  port: WirePort;
  sent: Array<{ op: Operation; group?: string }>;
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
      return {
        items: Object.fromEntries(items.entries()) as unknown as CanvasContents["items"],
      } as CanvasContents;
    },
    async readText(blobHash: string): Promise<string> {
      return blobs.get(blobHash) ?? "";
    },
  };
  return { port, sent };
}

describe("surgical section editing and decision Q&A (Phase 11)", () => {
  it("classifies and routes turn modes deterministically and via Answerer", async () => {
    const modes: readonly TurnMode[] = TURN_MODES;
    expect(modes).toEqual(["create", "edit", "why", "ds", "polish"]);
    expect(classifyTurn("why did you pick data-table?")).toBe("why");
    expect(classifyTurn("swap main.2 to card-grid")).toBe("edit");
    expect(classifyTurn("ds dark fintech palette")).toBe("ds");
    expect(classifyTurn("polish the spacing")).toBe("polish");
    expect(await routeTurn("explain the list screen")).toBe("why");
    const routed = await routeTurn("an inventory management portal", stubAnswerer(1));
    expect(TURN_MODES).toContain(routed);
  });

  it("applies content, variant, remove, add, and restyle to a single slot while leaving siblings untouched", () => {
    const kinds: readonly EditKind[] = EDIT_KINDS;
    expect(kinds).toEqual(["content", "add", "remove", "variant", "restyle"]);

    const base: WireSpec = {
      ...wireframe("list", { platform: "web", request: "Acme orders", flow: "flow-1" }),
      pinned: { platform: "web" },
    };
    const headerBefore = base.slots.find((s) => s.slot === "header")!;
    const main3Before = base.slots.find((s) => s.slot === "main.3")!;

    // 1. content edit on main.3
    const contentEdit: EditOperation = {
      kind: "content",
      slot: "main.3",
      fill: { heading: "Active Shipments" },
    };
    const afterContent = scopeEdit(base, contentEdit);
    expect(afterContent.slots.find((s) => s.slot === "main.3")?.fill?.heading).toBe("Active Shipments");
    expect(afterContent.slots.find((s) => s.slot === "header")).toEqual(headerBefore);
    expect(afterContent.flow).toBe("flow-1");
    expect(afterContent.pinned).toEqual({ platform: "web" });

    // 2. variant edit swapping main.3 from stacked-list to data-table
    const afterVariant = scopeEdit(afterContent, {
      kind: "variant",
      slot: "main.3",
      block: "data-table",
    });
    expect(afterVariant.slots.find((s) => s.slot === "main.3")?.block).toBe("data-table");
    expect(afterVariant.slots.find((s) => s.slot === "header")).toEqual(headerBefore);
    expect(validateWire(afterVariant)).toEqual([]);

    // 3. remove optional slot main.1 (search-field)
    const afterRemove = scopeEdit(afterVariant, {
      kind: "remove",
      slot: "main.1",
    });
    expect(afterRemove.slots.some((s) => s.slot === "main.1")).toBe(false);
    expect(afterRemove.declined?.some((d) => d.slot === "main.1")).toBe(true);
    expect(afterRemove.slots.find((s) => s.slot === "main.3")?.block).toBe(
      afterVariant.slots.find((s) => s.slot === "main.3")?.block ?? main3Before.block,
    );

    // 4. add optional slot main.1 back
    const afterAdd = scopeEdit(afterRemove, {
      kind: "add",
      slot: "main.1",
      block: "search-field",
    });
    expect(afterAdd.slots.find((s) => s.slot === "main.1")?.block).toBe("search-field");
    expect(afterAdd.declined ?? []).toHaveLength(0);

    // 5. restyle density and template
    const afterRestyle = scopeEdit(afterAdd, {
      kind: "restyle",
      slot: "main.3",
      density: "compact",
      template: "master_detail",
      region: "detail",
    });
    expect(afterRestyle.density).toBe("compact");
    expect(afterRestyle.template).toBe("master_detail");
    expect(afterRestyle.slots.find((s) => s.slot === "main.3")?.region).toBe("detail");
    expect(validateWire(afterRestyle)).toEqual([]);
  });

  it("edits a screen on the canvas and rebuilds its prototype in the same op group", async () => {
    const { port, sent } = memoryPort();
    const composed = await composeFlow(port, "Acme courier tracker", stubAnswerer(2));
    const target = composed.screens[0]!;
    const beforeCount = sent.length;

    const planned = await planEditWithJev(composed.screens, "make density compact", stubAnswerer(2), target.item);
    expect(planned.screen.item).toBe(target.item);

    const edited: EditedWire = await editWireOnCanvas(port, "tighten spacing", stubAnswerer(2), {
      screenId: target.item,
      edit: { kind: "restyle", slot: target.spec.slots[0]!.slot, density: "compact" },
    });
    expect(edited.screen.spec.density).toBe("compact");
    expect(edited.prototype).toBeDefined();

    const editOps = sent.slice(beforeCount);
    expect(editOps.length).toBeGreaterThanOrEqual(2);
    const groups = new Set(editOps.map((e) => e.group));
    expect(groups.size).toBe(1);
    expect(groups.has(edited.group)).toBe(true);
  });

  it("records compact decisions and explains why a screen and its slots were chosen", () => {
    const req: JevRequest = {
      model: JEV_MODEL,
      state: { request: "Acme courier dispatch" },
      questions: {
        "main.3": {
          type: "choice",
          instructions: "Which block?",
          criteria: { "data-table": "Table", "stacked-list": "List", "card-grid": "Grid" },
        },
      },
    };
    const res: JevResponse = {
      answers: {
        "main.3": {
          type: "choice",
          choice: "data-table",
          probabilities: { "data-table": 0.624, "stacked-list": 0.281, "card-grid": 0.095 },
        },
      },
    };
    const compact = compactDecisions(req, res);
    expect(compact["main.3"]).toEqual({
      "data-table": 0.62,
      "stacked-list": 0.28,
      "card-grid": 0.1,
    });

    const spec: WireSpec = recordDecisions(
      {
        ...wireframe("list", { platform: "web", request: "Acme courier dispatch", flow: "f-1" }),
        need: 0.84,
        template: "master_detail",
        density: "compact",
        pinned: { platform: "web" },
        slots: [
          { slot: "header", block: "page-header", props: {}, p: 0.91 },
          {
            slot: "main.3",
            block: "data-table",
            props: {},
            p: 0.62,
            alternatives: [
              { block: "stacked-list", p: 0.28 },
              { block: "card-grid", p: 0.1 },
            ],
            region: "detail",
          },
        ],
        declined: [{ slot: "main.1", block: "search-field", p: 0.72 }],
      },
      req,
      res,
    );
    expect(validateWire(spec)).toEqual([]);

    const explanation: DecisionExplanation = explainWireDecision(spec);
    expect(explanation.screenTitle).toBe(spec.title);
    expect(explanation.need).toBe(0.84);
    expect(explanation.lines.join("\n")).toContain("need P(yes)=84%");
    expect(explanation.lines.join("\n")).toContain("template=master_detail");
    expect(explanation.lines.join("\n")).toContain("pinned: platform=web");
    expect(explanation.lines.join("\n")).toContain("main.3: data-table (62%) [detail] — runners-up: stacked-list 28%, card-grid 10%");
    expect(explanation.lines.join("\n")).toContain("declined optional slots: main.1 (search-field, P(omit)=72%)");
  });

  describe("a content edit writes words, never the instruction (copy-edit phase 0)", () => {
    const INSTRUCTION = "make the heading about overdue Acme refunds";

    /** A text generator double: the stub's words, with every call it was asked recorded. */
    function recordingGenerator(): { gen: TextGenerator; calls: Array<{ prompt: string; schema: JsonSchema }> } {
      const inner = stubTextGenerator(3);
      const calls: Array<{ prompt: string; schema: JsonSchema }> = [];
      return {
        calls,
        gen: {
          name: "recording",
          async generateJson<T>(prompt: string, schema: JsonSchema): Promise<T> {
            calls.push({ prompt, schema });
            return inner.generateJson<T>(prompt, schema);
          },
        },
      };
    }

    /** An answerer that always plans a `content` edit on `slot`, else the stub's picks. */
    function contentAnswerer(slot: string): Answerer {
      const stub = stubAnswerer(2);
      return {
        name: "stub",
        async answer(request) {
          const got = await stub.answer(request);
          const answers: Response["answers"] = { ...got.response.answers };
          if (request.questions.kind) answers.kind = { type: "choice", choice: "content", probabilities: { content: 1 } };
          if (request.questions.slot) answers.slot = { type: "choice", choice: slot, probabilities: { [slot]: 1 } };
          return { ...got, response: { answers } };
        },
      };
    }

    const wordySlot = (spec: WireSpec) => spec.slots.find((s) => s.block && Object.keys(wordsOf(s.fill)).length > 0)!;

    it("refuses a content edit that carries no words, rather than writing the instruction", () => {
      const base = wireframe("list", { platform: "web", request: "Acme orders", flow: "flow-1" });
      expect(() => scopeEdit(base, { kind: "content", slot: "main.3", instruction: INSTRUCTION })).toThrow(/needs words/);
    });

    it("the planner carries the instruction as a request, not as a fill", async () => {
      const { port } = memoryPort();
      const composed = await composeFlow(port, "Acme refunds desk", stubAnswerer(2));
      const target = composed.screens[0]!;
      const planned = await planEditWithJev(composed.screens, INSTRUCTION, contentAnswerer(wordySlot(target.spec).slot), target.item);
      expect(planned.edit.kind).toBe("content");
      expect(planned.edit.instruction).toBe(INSTRUCTION);
      expect(planned.edit.fill).toBeUndefined();
    });

    it("a planned content edit asks the generator for the slot's words and never lands the instruction as text", async () => {
      const { port } = memoryPort();
      const composed = await composeFlow(port, "Acme refunds desk", stubAnswerer(2));
      const target = composed.screens[0]!;
      const slot = wordySlot(target.spec);
      const { gen, calls } = recordingGenerator();
      const edited = await editWireOnCanvas(port, INSTRUCTION, contentAnswerer(slot.slot), { screenId: target.item, generator: gen });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.prompt).toContain(INSTRUCTION);
      // The schema is narrowed to the one slot: no title, no bar, no other slot can change.
      expect(Object.keys(calls[0]!.schema.properties ?? {})).toEqual(["slots"]);
      expect(Object.keys(calls[0]!.schema.properties!.slots!.properties ?? {})).toEqual([slot.slot]);

      const after = edited.screen.spec;
      const words = Object.values(wordsOf(after.slots.find((s) => s.slot === slot.slot)!.fill));
      expect(words.length).toBeGreaterThan(0);
      expect(words).not.toContain(INSTRUCTION);
      expect(JSON.stringify(after)).not.toContain(INSTRUCTION);
      // Intents stay bound, and every sibling slot is untouched.
      for (const s of target.spec.slots) {
        const a = after.slots.find((x) => x.slot === s.slot)!;
        expect(a.intents).toEqual(s.intents);
        if (s.slot !== slot.slot) expect(a.fill).toEqual(s.fill);
      }
    });

    it("an explicit `--kind content` edit (the CLI's shape) goes through the generator too — the stub's words by default", async () => {
      const { port } = memoryPort();
      const composed = await composeFlow(port, "Acme refunds desk", stubAnswerer(2));
      const target = composed.screens[0]!;
      const slot = wordySlot(target.spec);
      const edited = await editWireOnCanvas(port, INSTRUCTION, stubAnswerer(2), {
        screenId: target.item,
        edit: { kind: "content", slot: slot.slot, instruction: INSTRUCTION },
      });
      const fill = edited.screen.spec.slots.find((s) => s.slot === slot.slot)!.fill;
      expect(Object.values(wordsOf(fill))).not.toContain(INSTRUCTION);
      expect(fill).not.toEqual(slot.fill);
      expect(edited.edit.fill).toEqual(fill);
    });

    it("refuses an answer that reaches past its slot or tries to move an intent", async () => {
      const { port } = memoryPort();
      const composed = await composeFlow(port, "Acme refunds desk", stubAnswerer(2));
      const spec = composed.screens[0]!.spec;
      const slot = wordySlot(spec);
      const greedy: TextGenerator = { name: "greedy", generateJson: async <T>() => ({ title: "Elsewhere", slots: {} }) as T };
      await expect(rewriteSlotCopy(spec, slot.slot, INSTRUCTION, greedy)).rejects.toThrow(/only slot/);
      const intents: TextGenerator = { name: "intents", generateJson: async <T>() => ({ intents: {}, slots: {} }) as T };
      await expect(rewriteSlotCopy(spec, slot.slot, INSTRUCTION, intents)).rejects.toThrow(/only slot|intents/);
    });
  });
});
