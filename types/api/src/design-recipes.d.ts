/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
