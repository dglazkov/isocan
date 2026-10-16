import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  itemPath,
  nodeCapabilitiesFor,
  workbenchItemPath,
  type CanvasContents,
  type Item,
  type ItemVersion,
} from "@isocan/core";
import {
  buildNodeAnchoredMessageOp,
  formatSubtargetPrefix,
  itemThreadsFor,
  parseSubtargetPrefix,
} from "../src/lib/nodechat.ts";
import {
  defaultAgentPromptsFor,
  registerBuiltinFocus,
  resolveNodeFocus,
} from "../src/lib/focusRegistry.ts";
import { addModule, moduleFocusFor } from "../src/modules.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function makeItem(
  id: string,
  mimeType: string,
  filename = "acme.html",
  properties: Record<string, string> = {},
): Item {
  const version = {
    id: "v1",
    blobHash: "sha256:0000000000000000000000000000000000000000000000000000000000000001",
    mimeType,
    filename,
    size: 120,
    createdAt: "2026-10-14T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  return {
    id,
    title: "Acme Artifact",
    description: "",
    x: 100,
    y: 200,
    width: 640,
    height: 420,
    properties,
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.createdAt,
    updatedBy: version.createdBy,
  };
}

function makeCanvas(item: Item): CanvasContents {
  return {
    items: { [item.id]: item },
    trash: [],
    threads: {},
  };
}

describe("Phase 2 — Unified FocusHeader & [ View | Edit ] routing", () => {
  const full = read("../src/components/FullScreen.tsx");
  const bench = read("../src/components/Workbench.tsx");
  const header = read("../src/components/FocusHeader.tsx");

  it("mounts the shared FocusHeader on both View (/i/:itemId) and Edit (/w/:itemId) routes", () => {
    expect(full).toContain("<FocusHeader");
    expect(full).toContain('mode="view"');
    expect(bench).toContain("<FocusHeader");
    expect(bench).toContain('mode="edit"');
  });

  it("round-trips [ View | Edit ] between itemPath and workbenchItemPath", () => {
    expect(header).toContain('aria-label="Focus mode"');
    expect(header).toContain("navigate(itemPath(canvasId, item.id))");
    expect(header).toContain("navigate(workbenchItemPath(canvasId, item.id))");
    expect(itemPath("prj_acme", "itm_hero")).toBe("/p/prj_acme/i/itm_hero");
    expect(workbenchItemPath("prj_acme", "itm_hero")).toBe("/p/prj_acme/w/itm_hero");
  });

  it("answers ⌘J in View Focus and Edit Focus to open or toggle the Node-Anchored Chat Drawer", () => {
    expect(full).toContain('e.key.toLowerCase() === "j"');
    expect(bench).toContain('e.key.toLowerCase() === "j"');
    expect(bench).toContain("<NodeFocusChat");
  });
});

describe("Phase 2 — File vs Non-File Edit Focus stage", () => {
  const stage = read("../src/components/ArtifactStage.tsx");

  it("renders non-file nodes (e.g. image/png) in Edit Focus without CodeMirror", () => {
    const png = makeItem("itm_png", "image/png", "hero.png");
    const caps = nodeCapabilitiesFor(png);
    expect(caps.edit).toBe(true);
    expect(caps.file).toBe(false);

    // ArtifactStage branches on `surface === "workbench" && !caps.file` before
    // ever reaching StageEditor (CodeMirror).
    const nonFileBranch = stage.indexOf('if (surface === "workbench" && !caps.file)');
    const editorSlot = stage.indexOf("<StageEditor");
    expect(nonFileBranch).toBeGreaterThan(0);
    expect(nonFileBranch).toBeLessThan(editorSlot);
    expect(stage.slice(nonFileBranch, nonFileBranch + 900)).toContain('data-focus-file="false"');
    expect(stage.slice(nonFileBranch, nonFileBranch + 900)).not.toContain("<StageEditor");
  });

  it("offers [ Studio | Code | Split ] file tools when caps.file is true", () => {
    const html = makeItem("itm_screen", "text/html", "home.html");
    expect(nodeCapabilitiesFor(html).file).toBe(true);
    expect(stage).toContain('aria-label="File edit layout"');
    expect(stage).toContain('setFileMode("studio")');
    expect(stage).toContain('setFileMode("code")');
    expect(stage).toContain('setFileMode("split")');
  });
});

describe("Phase 2 — ModuleFocus slot & priority resolution", () => {
  it("resolves built-in and module-contributed focus facets by priority", () => {
    const FakeBuiltinEdit = () => null;
    const FakeModuleEdit = () => null;

    registerBuiltinFocus({
      id: "builtin-test-acme",
      priority: 0,
      matches: (_item, v) => v.mimeType === "application/x-acme-focus",
      edit: FakeBuiltinEdit,
    });

    const item = makeItem("itm_acme", "application/x-acme-focus", "acme.focus");
    const current = item.versions[0]!;
    expect(resolveNodeFocus(item, current)?.id).toBe("builtin-test-acme");

    addModule({
      core: { name: "@isocan/acme-focus-mod" },
      focus: [
        {
          id: "module-test-acme",
          priority: 20,
          matches: (_it: Item, v: ItemVersion) => v.mimeType === "application/x-acme-focus",
          edit: FakeModuleEdit,
          agentPrompts: [{ label: "Acme polish", prompt: "Polish Acme focus" }],
        },
      ],
    });

    expect(moduleFocusFor(item, current)?.id).toBe("module-test-acme");
    expect(resolveNodeFocus(item, current)?.id).toBe("module-test-acme");
  });

  it("supplies kind-aware default agent prompt chips", () => {
    const img = makeItem("itm_img", "image/png", "hero.png");
    expect(defaultAgentPromptsFor(img, img.versions[0]!).length).toBeGreaterThan(0);
    const screen = makeItem("itm_scr", "text/html", "home.html");
    expect(defaultAgentPromptsFor(screen, screen.versions[0]!).some((p) => p.label.includes("DESIGN.md"))).toBe(true);
  });
});

describe("Phase 2 — Node-Anchored Chat (anchorItemId === item.id & FocusSubtarget)", () => {
  it("creates an anchored thread at anchorOffset(item) when the node has no thread yet", () => {
    const item = makeItem("itm_card", "text/html", "pricing.html");
    const canvas = makeCanvas(item);
    const op = buildNodeAnchoredMessageOp({
      canvas,
      item,
      body: "Make the CTA button larger.",
      subtarget: {
        kind: "wf-slot",
        id: "main.pricing-cards",
        label: "Slot: Pricing Cards",
      },
    });

    expect(op.type).toBe("thread.create");
    if (op.type !== "thread.create") throw new Error("expected thread.create");
    expect(op.anchorItemId).toBe(item.id);
    expect(op.main).toBe(false);
    expect(op.x).toBe(item.width);
    expect(op.y).toBe(0);
    expect(op.comment.items).toContain(item.id);
    expect(op.comment.body).toBe(
      "[focus: wf-slot:main.pricing-cards — Slot: Pricing Cards]\nMake the CTA button larger.",
    );

    const parsed = parseSubtargetPrefix(op.comment.body);
    expect(parsed.subtarget).toEqual({
      kind: "wf-slot",
      id: "main.pricing-cards",
      label: "Slot: Pricing Cards",
    });
    expect(parsed.rest).toBe("Make the CTA button larger.");
  });

  it("replies to the existing item-anchored thread rather than minting a duplicate", () => {
    const item = makeItem("itm_card", "text/html", "pricing.html");
    const canvas = makeCanvas(item);
    canvas.threads["thr_existing"] = {
      id: "thr_existing",
      x: item.width,
      y: 0,
      anchorItemId: item.id,
      main: false,
      createdAt: "2026-10-14T00:00:00.000Z",
      createdBy: { id: "u_test", name: "Test" },
      comments: [
        {
          id: "c_1",
          author: { id: "u_test", name: "Test" },
          body: "Initial question",
          createdAt: "2026-10-14T00:00:00.000Z",
        },
      ],
    };

    expect(itemThreadsFor(canvas, item.id).map((t) => t.id)).toEqual(["thr_existing"]);

    const op = buildNodeAnchoredMessageOp({
      canvas,
      item,
      body: "Follow-up request",
    });
    expect(op.type).toBe("thread.reply");
    if (op.type !== "thread.reply") throw new Error("expected thread.reply");
    expect(op.threadId).toBe("thr_existing");
    expect(op.comment.items).toContain(item.id);
    expect(op.comment.body).toBe("Follow-up request");
  });

  it("round-trips FocusSubtarget formatting and parsing cleanly", () => {
    const sub = { kind: "ds-token", id: "colors.primary", label: "Token: colors.primary" };
    const prefix = formatSubtargetPrefix(sub);
    expect(prefix).toBe("[focus: ds-token:colors.primary — Token: colors.primary]");
    const parsed = parseSubtargetPrefix(`${prefix}\nCheck contrast against surface.`);
    expect(parsed.subtarget).toEqual(sub);
    expect(parsed.rest).toBe("Check contrast against surface.");
  });
});
