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
import type { CssNode } from "css-tree";
import type { DefaultTreeAdapterMap } from "parse5";
type Element = DefaultTreeAdapterMap["element"];
/** Match only direct static selectors; unsupported relationships never masquerade as a non-match. */
export declare function matchContractSelector(selector: CssNode, element: Element): {
    matches: boolean;
    specificity: number;
} | null;
/** Expand every physical axis, retaining the values that prove reference use and source ownership. */
export declare function expandContractValues<T>(property: string, values: T[], spelling: (value: T) => string): Map<string, T[]> | null;
export {};
