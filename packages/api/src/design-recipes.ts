/** The installed references are examples to inspect and adapt, never an automatic theme choice. */
export interface DesignRecipeSummary {
  id: "receiving" | "field-guide" | "campaign";
  title: string;
  surface: "operational" | "editorial" | "persuasive";
  summary: string;
  audience: string;
  primaryTask: string;
  states: readonly string[];
}

/** Exact runnable reference bytes and their accompanying native design document. */
export interface DesignRecipe extends DesignRecipeSummary {
  html: string;
  design: string;
  htmlFilename: string;
  designFilename: "DESIGN.md";
}

const catalogue: readonly DesignRecipeSummary[] = [
  { id: "receiving", title: "Receiving desk", surface: "operational", summary: "A compact shipment list and receiving form with saved receipts and corrections.", audience: "A warehouse operator checking an incoming delivery", primaryTask: "Record the quantities received and correct the same receipt", states: ["empty", "loading", "validation", "save-error", "saved", "correction", "long-label", "narrow", "keyboard"] },
  { id: "field-guide", title: "A field guide to slower streets", surface: "editorial", summary: "An authored long read with a clear contents rail, comfortable measure and a saved reading position.", audience: "A curious resident preparing for a neighbourhood street walk", primaryTask: "Read the guide, find a section and save a useful passage", states: ["long-content", "navigation", "saved-passage", "empty-saves", "narrow", "keyboard"] },
  { id: "campaign", title: "Make room for repair", surface: "persuasive", summary: "A specific repair-workshop invitation with supplied synthetic facts and a complete local reservation path.", audience: "A neighbour considering their first repair workshop", primaryTask: "Understand the offer and reserve an appropriate workshop place", states: ["evidence", "validation", "submitting", "save-error", "reserved", "correction", "no-imagery", "narrow", "keyboard"] },
];

/** Discover the small kit without importing HTML, design prose or a browser runtime. */
export function designRecipes(): readonly DesignRecipeSummary[] { return catalogue; }

/** Load only the chosen installed example; unknown names are errors rather than a default recipe. */
export async function readDesignRecipe(id: string): Promise<DesignRecipe> {
  const summary = catalogue.find((recipe) => recipe.id === id);
  if (!summary) throw new Error(`Unknown design reference: ${id}`);
  const content = id === "receiving" ? await import("./design-recipes/receiving.ts") : id === "field-guide" ? await import("./design-recipes/field-guide.ts") : await import("./design-recipes/campaign.ts");
  return { ...summary, html: content.html, design: content.design, htmlFilename: `${id}.html`, designFilename: "DESIGN.md" };
}
