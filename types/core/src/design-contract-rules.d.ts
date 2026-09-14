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
