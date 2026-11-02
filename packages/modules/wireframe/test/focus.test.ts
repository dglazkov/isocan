// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  applyOperation,
  invertOperation,
  nodeCapabilitiesFor,
  type CanvasContents,
  type CanvasState,
  type FocusFacts,
  type FocusSubtarget,
  type Item,
  type Operation,
} from "@isocan/core";
import { PROTOTYPE_PROP, readWire, recipe, renderWire, wireframe, type WireSpec } from "../src/core.ts";
import {
  WireframeFocusEdit,
  WireframeFocusView,
  applyWireStudioLayoutChange,
  applyWireStudioSlotCopy,
  applyWireStudioSlotPolish,
  applyWireStudioSlotSwap,
  isWireframeFocusMatch,
  saveWireStudioSpec,
  slotSubtargetFor,
} from "../src/web.tsx";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeWireItem(spec: WireSpec, id = "it_wire_1"): { item: Item; html: string } {
  const html = renderWire(spec);
  const version = {
    id: "v_wire_1",
    blobHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    mimeType: "text/html",
    filename: "acme-wire.html",
    size: html.length,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  const item: Item = {
    id,
    title: spec.title,
    description: "",
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    properties: { fidelity: "wireframe" },
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
    updatedAt: "2026-10-15T00:00:00.000Z",
    updatedBy: { id: "u_test", name: "Test" },
  };
  return { item, html };
}

describe("Wireframe Focus (node-focus phase 5)", () => {
  it("matches wireframe screens on module.wireframe (priority 20) and skips prototype items", () => {
    const spec = wireframe("home", {
      platform: "web",
      title: "Acme Metrics",
      flow: "flow_acme",
      request: "Acme metrics home",
    });
    const { item } = makeWireItem(spec);
    expect(isWireframeFocusMatch(item, item.versions[0]!)).toBe(true);

    // Prototype items must NOT match the wireframe composer studio
    const protoItem: Item = {
      ...item,
      id: "it_proto",
      properties: { fidelity: "wireframe", [PROTOTYPE_PROP]: "flow_acme" },
    };
    expect(isWireframeFocusMatch(protoItem, protoItem.versions[0]!)).toBe(false);
  });

  it("swaps a [data-wf] slot catalog block and stacks a valid ItemVersion without raw HTML corruption", async () => {
    const baseSpec = wireframe("home", {
      platform: "web",
      title: "Acme Home",
      flow: "flow_acme",
      request: "Acme analytics home",
    });
    const { item, html } = makeWireItem(baseSpec);

    const homeRecipe = recipe("home");
    const targetSection = homeRecipe.sections.find(
      (sec) => sec.options.length > 1 && baseSpec.slots.some((s) => s.slot === sec.slot),
    )!;
    const targetSlot = baseSpec.slots.find((s) => s.slot === targetSection.slot)!;
    const nextBlock = targetSection.options.find((opt) => opt !== targetSlot.block)!;
    const swappedSpec = applyWireStudioSlotSwap(baseSpec, targetSlot.slot, nextBlock);
    expect(swappedSpec.slots.find((s) => s.slot === targetSlot.slot)?.block).toBe(nextBlock);

    const withPolish = applyWireStudioSlotPolish(swappedSpec, targetSlot.slot, "wf-elevated");
    expect(withPolish.polish).toEqual([{ target: targetSlot.slot, add: ["wf-elevated"] }]);
    const withCopy = applyWireStudioSlotCopy(withPolish, targetSlot.slot, {
      heading: "Acme Revenue Overview",
      sub: "Updated Q4 projection",
    });

    const sentOps: Operation[] = [];
    const canvas: CanvasContents = {
      items: { [item.id]: item },
      trash: [],
      threads: {},
    };

    const saved = await saveWireStudioSpec(
      {
        canvasId: "c_acme",
        canvas,
        item,
        version: item.versions[0]!,
        actor: { id: "u_test", name: "Test" },
        readText: async () => html,
        host: {
          viewer: { id: "u_test", name: "Test" },
          putBlob: async (blob) => {
            const text = await blob.text();
            return {
              blobHash: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
              size: text.length,
            };
          },
          send: async (ops) => {
            sentOps.push(...ops);
          },
          enrol: async () => ({ actorId: "usr_agent" }),
          select: () => {},
          commands: () => [],
          runCommand: async () => "posted",
          retract: async () => {},
          reveal: () => {},
        },
      },
      withCopy,
      baseSpec,
    );

    expect(sentOps.length).toBeGreaterThanOrEqual(1);
    const addVerOp = sentOps.find((op) => op.type === "item.addVersion");
    expect(addVerOp).toBeDefined();

    const reparsed = readWire(saved.html);
    expect(reparsed).not.toBeNull();
    expect(reparsed?.archetype).toBe("home");
    expect(reparsed?.slots.find((s) => s.slot === targetSlot.slot)?.block).toBe(nextBlock);
    expect(reparsed?.polish).toEqual([{ target: targetSlot.slot, add: ["wf-elevated"] }]);
    expect(reparsed?.slots.find((s) => s.slot === targetSlot.slot)?.fill?.heading).toBe(
      "Acme Revenue Overview",
    );

    const actor = { id: "u_test", name: "Test" };
    const state: CanvasState = {
      project: {
        id: "c_acme",
        title: "Acme Canvas",
        description: "",
        properties: {},
        createdAt: "2026-10-15T00:00:00.000Z",
        createdBy: actor,
        updatedAt: "2026-10-15T00:00:00.000Z",
        updatedBy: actor,
      },
      canvas,
    };
    const inverse = invertOperation(state, addVerOp!);
    expect(inverse).not.toBeNull();
    const applied = applyOperation(state, {
      id: "op_wire_1",
      canvasId: "c_acme",
      ts: "2026-10-15T00:01:00.000Z",
      actor,
      op: addVerOp!,
    })!;
    expect(applied.canvas.items[item.id]!.versions).toHaveLength(2);
    const reverted = applyOperation(applied, {
      id: "op_wire_2",
      canvasId: "c_acme",
      ts: "2026-10-15T00:02:00.000Z",
      actor,
      op: inverse!,
    })!;
    expect(reverted.canvas.items[item.id]!.currentVersionId).toBe("v_wire_1");
  });

  it("renders WireframeFocusEdit, selects a [data-wf] slot, sets FocusSubtarget (wf-slot), and toggles Why rail in View", async () => {
    const baseSpec: WireSpec = {
      ...wireframe("list", {
        platform: "web",
        title: "Acme Deliveries",
        flow: "flow_acme",
        request: "Delivery list for Acme",
      }),
      need: 0.92,
      by: { answerer: "jev", model: "jev-1.13.0" },
    };
    const { item, html } = makeWireItem(baseSpec);
    const canvas: CanvasContents = {
      items: { [item.id]: item },
      trash: [],
      threads: {},
    };

    const recordedSubtargets: (FocusSubtarget | null)[] = [];
    const baseFacts: FocusFacts = {
      canvasId: "c_acme",
      canvas,
      item,
      version: item.versions[0]!,
      actor: { id: "u_test", name: "Test" },
      canEdit: true,
      capabilities: nodeCapabilitiesFor(item, item.versions[0]!),
      readText: async () => html,
      subtarget: null,
      setSubtarget: (sub) => {
        recordedSubtargets.push(sub);
      },
      askAgent: () => {},
      host: {
        viewer: { id: "u_test", name: "Test" },
        putBlob: async (b) => ({
          blobHash: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
          size: b.size,
        }),
        send: async () => {},
        enrol: async () => ({ actorId: "usr_agent" }),
        select: () => {},
        commands: () => [],
        runCommand: async () => "posted",
        retract: async () => {},
        reveal: () => {},
      },
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(WireframeFocusEdit, baseFacts));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="wireframe-focus-edit"]')).not.toBeNull();
    const secondSlot = baseSpec.slots[1] ?? baseSpec.slots[0]!;
    const slotChip = container.querySelector<HTMLButtonElement>(
      `[data-slot-chip="${secondSlot.slot}"]`,
    );
    expect(slotChip).not.toBeNull();

    await act(async () => {
      slotChip!.click();
    });

    const activeSubtarget = recordedSubtargets.at(-1) ?? null;
    expect(activeSubtarget).toEqual(slotSubtargetFor(secondSlot));
    expect(activeSubtarget?.kind).toBe("wf-slot");
    expect(activeSubtarget?.id).toBe(secondSlot.slot);

    await act(async () => {
      root.render(createElement(WireframeFocusView, baseFacts));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const whyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Why this layout?"),
    );
    expect(whyBtn).toBeDefined();
    expect(container.querySelector('[data-testid="wireframe-why-rail"]')).toBeNull();

    await act(async () => {
      whyBtn!.click();
    });
    const whyRail = container.querySelector('[data-testid="wireframe-why-rail"]');
    expect(whyRail).not.toBeNull();
    expect(whyRail?.textContent).toContain("list");
    expect(whyRail?.textContent).toContain("jev-1.13.0");

    const compact = applyWireStudioLayoutChange(baseSpec, { density: "compact" });
    expect(compact.density).toBe("compact");
    const switchedArchetype = applyWireStudioLayoutChange(compact, { archetype: "home" });
    expect(switchedArchetype.archetype).toBe("home");
    expect(switchedArchetype.density).toBe("compact");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
