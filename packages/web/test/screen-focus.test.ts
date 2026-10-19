// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  DESIGN_SYSTEM_ROLE,
  nodeCapabilitiesFor,
  type CanvasContents,
  type FocusFacts,
  type FocusSubtarget,
  type Item,
  type Operation,
} from "@isocan/core";
import { copyDeck } from "@isocan/core/copy-deck";
import {
  ScreenFocusEdit,
  domElementSubtargetFor,
  extractDomElements,
  injectScreenStatePreview,
  isHtmlScreenFocusMatch,
  saveScreenCopyEdits,
} from "../src/components/ScreenFocus.tsx";
import { resolveNodeFocus } from "../src/lib/focusRegistry.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function makeItem(
  id: string,
  mimeType: string,
  filename: string,
  properties: Record<string, string> = {},
): Item {
  const version = {
    id: `${id}_v1`,
    blobHash: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
    mimeType,
    filename,
    size: 512,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  return {
    id,
    title: "Acme Checkout Screen",
    description: "",
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    properties,
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
    updatedAt: "2026-10-15T00:00:00.000Z",
    updatedBy: { id: "u_test", name: "Test" },
  };
}

const SAMPLE_SCREEN_HTML = `<!doctype html>
<html>
  <head><title>Acme Checkout</title></head>
  <body>
    <header id="top-bar"><h1>Acme Checkout</h1></header>
    <main data-testid="checkout-main">
      <section class="summary-card">
        <h2>Order Summary</h2>
        <p>Two Acme widgets ready to ship.</p>
      </section>
      <form id="payment-form">
        <button type="submit">Pay $49</button>
      </form>
    </main>
  </body>
</html>`;

describe("Phase 6 — Screen Studio (text/html) & Module Facets (documents, mermaid)", () => {
  it("matches ordinary HTML screens via builtin.screen and yields to DESIGN.md and wireframe facets", () => {
    const screen = makeItem("it_screen", "text/html", "checkout.html");
    expect(isHtmlScreenFocusMatch(screen, screen.versions[0]!)).toBe(true);
    expect(resolveNodeFocus(screen)?.id).toBe("builtin.screen");

    const ds = makeItem("it_ds", "text/markdown", "DESIGN.md", { role: DESIGN_SYSTEM_ROLE });
    expect(isHtmlScreenFocusMatch(ds, ds.versions[0]!)).toBe(false);
    expect(resolveNodeFocus(ds)?.id).toBe("builtin.design-system");

    const wire = makeItem("it_wire", "text/html", "wire.html", { fidelity: "wireframe" });
    expect(isHtmlScreenFocusMatch(wire, wire.versions[0]!)).toBe(true);
    expect(resolveNodeFocus(wire)?.id).toBe("module.wireframe");
  });

  it("frames responsive viewports (390 / 768 / 1440 / Fit), previews state hints, and selects DOM FocusSubtargets", async () => {
    const screen = makeItem("it_screen_ui", "text/html", "checkout.html");
    const canvas: CanvasContents = {
      items: { [screen.id]: screen },
      trash: [],
      threads: {},
    };
    const recordedSubtargets: (FocusSubtarget | null)[] = [];
    const facts: FocusFacts = {
      canvasId: "c_acme",
      canvas,
      item: screen,
      version: screen.versions[0]!,
      actor: { id: "u_test", name: "Test" },
      canEdit: true,
      capabilities: nodeCapabilitiesFor(screen, screen.versions[0]!),
      readText: async () => SAMPLE_SCREEN_HTML,
      subtarget: null,
      setSubtarget: (sub) => {
        recordedSubtargets.push(sub);
      },
      askAgent: () => {},
      host: {
        viewer: { id: "u_test", name: "Test" },
        putBlob: async (b) => ({
          blobHash: "sha256:5555555555555555555555555555555555555555555555555555555555555555",
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

    const elements = extractDomElements(SAMPLE_SCREEN_HTML);
    expect(elements.some((e) => e.selector === "#top-bar")).toBe(true);
    expect(elements.some((e) => e.selector === '[data-testid="checkout-main"]')).toBe(true);
    expect(elements.some((e) => e.selector === "#payment-form")).toBe(true);

    const loadingHtml = injectScreenStatePreview(SAMPLE_SCREEN_HTML, "loading");
    expect(loadingHtml).toContain('<body data-state="loading">');

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // View is the screen itself, full bleed: no facet view, so the stage
    // falls through to the bare VersionContent (no toolbar under the header).
    expect(resolveNodeFocus(screen)?.view).toBeUndefined();

    await act(async () => {
      root.render(createElement(ScreenFocusEdit, facts));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector(".screen-focus-frame")?.getAttribute("data-viewport-width")).toBe(
      "fit",
    );
    const mobileBtn = container.querySelector<HTMLButtonElement>('[data-viewport-preset="mobile"]');
    expect(mobileBtn).not.toBeNull();
    await act(async () => {
      mobileBtn!.click();
    });
    expect(container.querySelector(".screen-focus-frame")?.getAttribute("data-viewport-width")).toBe(
      "390",
    );

    const formChip = container.querySelector<HTMLButtonElement>('[data-dom-target="#payment-form"]');
    expect(formChip).not.toBeNull();
    await act(async () => {
      formChip!.click();
    });

    const latestSub = recordedSubtargets.at(-1) ?? null;
    expect(latestSub?.kind).toBe("dom-element");
    expect(latestSub?.id).toBe("#payment-form");
    expect(latestSub).toEqual(
      domElementSubtargetFor(elements.find((e) => e.selector === "#payment-form")!),
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("saves copy-deck string edits on HTML screens as a new ItemVersion without markup drift", async () => {
    const screen = makeItem("it_screen_copy", "text/html", "checkout.html");
    const sentOps: Operation[] = [];
    const deck = copyDeck(SAMPLE_SCREEN_HTML);
    const btnEntry = deck.strings.find((s) => s.text === "Pay $49")!;
    const res = await saveScreenCopyEdits(
      {
        item: screen,
        version: screen.versions[0]!,
        host: {
          viewer: { id: "u_test", name: "Test" },
          putBlob: async (b) => ({
            blobHash: "sha256:6666666666666666666666666666666666666666666666666666666666666666",
            size: b.size,
          }),
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
      SAMPLE_SCREEN_HTML,
      [{ address: btnEntry.address, text: "Pay $49", to: "Complete Purchase ($49)" }],
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('<button type="submit">Complete Purchase ($49)</button>');
      expect(res.html).toContain('<header id="top-bar">');
    }
    expect(sentOps).toHaveLength(1);
    expect(sentOps[0]!.type).toBe("item.addVersion");
  });

  it("resolves module.documents and module.mermaid ModuleFocus facets with clean removability guards", () => {
    const doc = makeItem("it_doc", "text/markdown", "architecture.md");
    expect(resolveNodeFocus(doc)?.id).toBe("module.documents");

    const diagram = makeItem("it_mmd", "text/vnd.mermaid", "flow.mmd");
    expect(resolveNodeFocus(diagram)?.id).toBe("module.mermaid");

    const docsWebSrc = read("../../modules/documents/src/web.tsx");
    const mermaidWebSrc = read("../../modules/mermaid/src/web.tsx");
    for (const src of [docsWebSrc, mermaidWebSrc]) {
      expect(src).not.toContain("@isocan/web");
      expect(src).not.toContain("canvasStore");
      expect(src).not.toContain("uiStore");
      expect(src).not.toContain("focusStore");
    }
    expect(mermaidWebSrc).not.toMatch(/from\s+["']mermaid["']/);
  });
});
