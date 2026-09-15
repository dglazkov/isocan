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
/** Discover the small kit without importing HTML, design prose or a browser runtime. */
export declare function designRecipes(): readonly DesignRecipeSummary[];
/** Load only the chosen installed example; unknown names are errors rather than a default recipe. */
export declare function readDesignRecipe(id: string): Promise<DesignRecipe>;
