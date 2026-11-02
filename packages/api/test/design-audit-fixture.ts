import { canvasItemOf, designSystemProperties, emptyCanvas, type CanvasContents, type Item } from "@isocan/core";

export const auditHome = "https://acme.invalid";
export const auditHtml = '<p style="color:var(--missing);padding:13px">A prose #ff0000</p>';
export const auditDesign = (name = "Acme", spacing = "16px") => `---\nname: ${name}\ncolors:\n  ink: "#112233"\nspacing:\n  md: ${spacing}\ntypography:\n  body:\n    fontSize: 16px\nrounded:\n  card: 8px\n---\n## Usage\nSynthetic fixture.\n`;
/** Two policies share token values so a lane difference can only come from its governing contract. */
export function auditContractDesign(literals: "allow" | "require-references" = "allow", extension?: unknown): string {
  const isocan = extension ?? { lint: { version: 1, literals, recipes: {
    Button: { owns: { padding: "{spacing.md}", "border-radius": "{rounded.card}" }, allow: ["margin", "align-self"], treatments: { compact: { padding: "{spacing.sm}" } } },
    Title: { owns: { "font-weight": "{typography.body.fontWeight}" }, allow: ["font-size"] },
  }, exceptions: { "hero-spacing": { recipe: "Button", properties: ["padding"], reason: 'Acme #1 needs room for its "two-line" label.' } } } };
  return auditDesign(`Acme ${literals}`).replace("  md: 16px", "  md: 16px\n  sm: 8px").replace("    fontSize: 16px", "    fontSize: 16px\n    fontWeight: 700").replace("---\nname:", `---\nisocan: ${JSON.stringify(isocan)}\nname:`);
}

/** Explicit markers and inline ownership exercise policy without unknown selector paths. */
export const auditContractHtml = '<button data-isocan-recipe="Button" style="padding:16px;border-radius:8px;margin:16px;align-self:center">Acme</button><h1 data-isocan-recipe="Title" style="font-size:16px;font-weight:700">Acme title</h1>';
export function auditItem(id: string, mime = "text/html", properties: Record<string, string> = {}, parent?: string): Item {
  const actor = { id: "usr_acme", name: "Acme" };
  const ts = "2026-09-14T12:00:00.000Z";
  return { id, title: `Acme ${id}`, description: "", x: 100, y: 100, width: 400, height: 300,
    properties, ...(parent ? { containerId: parent } : {}),
    versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: mime, filename: `${id}.${mime === "text/html" ? "html" : "md"}`, size: 10, createdAt: ts, createdBy: actor }],
    currentVersionId: `ver_${id}`, createdAt: ts, createdBy: actor, updatedAt: ts, updatedBy: actor };
}
export function auditCanvas(items: Item[]): CanvasContents {
  return { ...emptyCanvas(), items: Object.fromEntries(items.map(item => [item.id, item])) };
}
export function auditFixture() {
  const outer = auditItem("outer", "text/markdown", { kind: "group" });
  const inner = auditItem("inner", "text/markdown", { kind: "group" }, outer.id);
  const design = auditItem("design", "text/markdown", designSystemProperties(), outer.id);
  const nested = auditItem("nested", "text/html", {}, inner.id);
  const outside = auditItem("outside");
  const link = auditItem("link", "text/plain", { ...canvasItemOf(auditHome, "prj_library").properties, memory: "inherit" });
  const inherited = auditItem("inherited", "text/markdown", designSystemProperties());
  const canvas = auditCanvas([outer, inner, design, nested, outside, link]);
  const library = auditCanvas([inherited]);
  const blobs: Record<string, string> = { hash_design: auditDesign("Acme lane"), hash_inherited: auditDesign("Acme library", "13px"), hash_nested: auditHtml, hash_outside: auditHtml };
  return { canvas, library, blobs, outer, inner, design, nested, outside, link, inherited };
}
