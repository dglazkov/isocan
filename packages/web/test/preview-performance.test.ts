import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Item } from "@isocan/core";
import { ItemView } from "../src/components/ItemView.tsx";

// No intersection effect has run in this render: this is the real production
// state of cards outside the viewport. Their shells must remain selectable.
describe("the 1,000-item canvas mounts shells before document previews", () => {
  it("retains every item identity and no Markdown body or loading tree", () => {
    const actor = { id: "usr_acme", name: "Acme" };
    const stamp = { createdAt: "2026-09-12T00:00:00Z", createdBy: actor, updatedAt: "2026-09-12T00:00:00Z", updatedBy: actor };
    const cards = Array.from({ length: 1000 }, (_, i) => {
      const item: Item = { id: `itm_acme_${i}`, title: `Acme card ${i}`, description: "", x: i % 40 * 220, y: Math.floor(i / 40) * 160, width: 180, height: 120, properties: {}, currentVersionId: `ver_acme_${i}`, versions: [{ id: `ver_acme_${i}`, blobHash: `hash_acme_${i}`, mimeType: "text/markdown", filename: "acme.md", size: 1, ...stamp }], ...stamp };
      return h(ItemView, { key: item.id, item, canvasId: "prj_acme", actor });
    });
    const originalError = console.error;
    const errors = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      // Effects intentionally do not run here. Keep unrelated warnings visible.
      if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
      originalError(message, ...args);
    });
    let html: string;
    try { html = renderToStaticMarkup(h(MemoryRouter, null, cards)); }
    finally { errors.mockRestore(); }
    expect(html.match(/data-item-id=/g)).toHaveLength(1000);
    expect(html.match(/item-standby/g)).toHaveLength(1000);
    expect(html).not.toContain('class="md-view"');
    expect(html).not.toContain('class="file-view"');
    expect(html).not.toContain('<iframe');
  });
  it.each([["text/markdown", "image/png", "img-view"], ["application/json", "video/mp4", "video-view"]])("retains the %s source item's actual %s visual face offscreen", (sourceMime, visualMime, viewClass) => {
    const actor = { id: "usr_acme", name: "Acme" };
    const stamp = { createdAt: "2026-09-12T00:00:00Z", createdBy: actor, updatedAt: "2026-09-12T00:00:00Z", updatedBy: actor };
    const item: Item = { id: "itm_acme_visual", title: "Acme visual", description: "", x: 0, y: 0, width: 180, height: 120, properties: {}, currentVersionId: "ver_acme", versions: [{ id: "ver_acme", blobHash: "hash_acme_source", mimeType: sourceMime!, filename: "acme-source", size: 1, visual: { blobHash: "hash_acme_visual", mimeType: visualMime!, filename: "acme-visual", size: 1 }, ...stamp }], ...stamp };
    const originalError = console.error;
    const errors = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
      originalError(message, ...args);
    });
    let html: string;
    try { html = renderToStaticMarkup(h(MemoryRouter, null, h(ItemView, { item, canvasId: "prj_acme", actor }))); }
    finally { errors.mockRestore(); }
    expect(html).toContain(`class="${viewClass}"`);
    expect(html).toContain("hash_acme_visual");
    expect(html).not.toContain("item-standby");
    expect(item.versions[0]!.mimeType).toBe(sourceMime);
  });

});
