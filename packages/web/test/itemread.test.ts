import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESIGN_SYSTEM_ROLE, TEXT_PROPERTIES, nodeCapabilitiesFor, type Item } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function itemOf(mimeType: string, properties: Record<string, string> = {}): Item {
  const version = {
    id: "v1",
    blobHash: "sha256:0000000000000000000000000000000000000000000000000000000000000001",
    mimeType,
    filename: "acme",
    size: 64,
    createdAt: "2026-10-14T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  return {
    id: "it_acme",
    title: "Acme",
    description: "",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
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

/**
 * **The top-left capability strip (`item-focus-strip`) replaces ad-hoc doors**
 * (`docs/projects/node-focus/design.md` §2.2).
 *
 * Selecting a single node (`soleSelection || entered`) renders a counter-scaled
 * top-left strip with `View`, `Edit` (when `caps.edit && canEdit`), and
 * `Enter` / `Leave` (only when `caps.enter` is true), retiring both the
 * Markdown `"Read / select text"` button (`item-read`) and the under-row
 * `"Full screen"` button (`fullscreen-btn`).
 */
describe("the top-left capability focus strip", () => {
  const view = read("../src/components/ItemView.tsx");

  it("renders only for the sole selection or the entered item, gated on capabilities", () => {
    const at = view.indexOf('className="item-focus-strip item-focus-strip-nw"');
    expect(at).toBeGreaterThan(0);
    const guard = view.slice(view.lastIndexOf("{roomy && !resize", at), at);
    expect(guard).toMatch(/\(soleSelection \|\| entered\)/);
    expect(guard).toMatch(/caps\.view \|\| \(caps\.edit && canEdit\) \|\| caps\.enter/);
  });

  it("retires the ad-hoc item-read and fullscreen-btn controls", () => {
    expect(view).not.toContain('className="btn item-read"');
    expect(view).not.toContain("fullscreen-btn");
  });

  it("offers Enter on an HTML screen or Markdown document, and omits Enter on a PNG image or design system", () => {
    expect(view).toContain("{caps.enter && (");
    expect(nodeCapabilitiesFor(itemOf("text/html")).enter).toBe(true);
    expect(nodeCapabilitiesFor(itemOf("text/markdown")).enter).toBe(true);
    expect(nodeCapabilitiesFor(itemOf("image/png")).enter).toBe(false);
    expect(nodeCapabilitiesFor(itemOf("text/markdown", { role: DESIGN_SYSTEM_ROLE })).enter).toBe(false);
  });

  it("is never offered on a canvas text node, where double-click already edits in place", () => {
    const textCaps = nodeCapabilitiesFor(itemOf("text/markdown", { ...TEXT_PROPERTIES }));
    expect(textCaps).toEqual({ view: false, edit: false, enter: false, file: false });
  });
});
